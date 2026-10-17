/**
 * Préparation d'un déploiement (Vercel : script `vercel-build`, avant `next build`) :
 * 1. contrôle de la configuration obligatoire (noms des variables manquantes, jamais leurs valeurs) ;
 * 2. migrations SQL du dossier `drizzle/` (sans effet si la base est à jour) ;
 * 3. données de démonstration si SEED_DEMO_DATA=true (sans effet si la base contient déjà des données).
 * Avant tout, la marque d'environnement de la base est contrôlée (`src/server/domain/deployment.ts`) : le
 * développement (`develop`, VERCEL_ENV=preview) refuse la base de production, et la production refuse une base
 * de développement. La marque est posée après les migrations.
 * En production, une erreur arrête le déploiement : la version en ligne reste la précédente.
 *
 * Environnement de développement (VERCEL_ENV=preview, branche `develop`, workflow « Déploiement développement ») :
 * base distincte déclarée pour la portée Preview, avec PREVIEW_MIGRATIONS=true pour la migrer et la marquer.
 * Sans PREVIEW_MIGRATIONS, la base n'est jamais modifiée. Une prévisualisation sans base se construit quand même
 * (avertissement).
 */
import "dotenv/config";
import { spawnSync } from "node:child_process";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { withExplicitSslMode } from "../src/server/db/connection-string";
import { checkDatabaseForEnvironment, deploymentEnvironment, type DeploymentEnvironment } from "../src/server/domain/deployment";

function fail(message: string): never {
  console.error(`\n[predeploy] ${message}\n`);
  process.exit(1);
}

/**
 * Marque d'environnement de la base (lecture seule) : `platform_settings.environment`, et présence de données
 * (organisations). Les tables peuvent ne pas exister encore sur une base neuve.
 */
async function readDatabaseState(pool: Pool) {
  // Requêtes séparées : PostgreSQL refuse une requête qui nomme une table absente, même dans un `case`.
  const { rows } = await pool.query<{ settings: string | null; tenants: string | null }>(
    "select to_regclass('public.platform_settings')::text as settings, to_regclass('public.tenants')::text as tenants",
  );
  const marker = rows[0]?.settings
    ? ((await pool.query<{ value: string }>("select value from platform_settings where key = 'environment'")).rows[0]?.value ?? null)
    : null;
  const hasData = rows[0]?.tenants ? (await pool.query("select 1 from tenants limit 1")).rowCount! > 0 : false;
  return { marker, hasData };
}

async function main() {
  const preview = process.env.VERCEL_ENV === "preview";
  const target: DeploymentEnvironment = deploymentEnvironment(process.env.VERCEL_ENV) ?? "production";
  const missing = ["DATABASE_URL", "BETTER_AUTH_SECRET"].filter((name) => !process.env[name]);
  if (missing.length > 0) {
    const message = `Variables d'environnement manquantes : ${missing.join(", ")}. Les déclarer dans Vercel (Settings → Environment Variables), puis redéployer.`;
    if (!preview) fail(message);
    console.warn(`[predeploy] Prévisualisation sans base : ${message}`);
    return;
  }
  if ((process.env.BETTER_AUTH_SECRET ?? "").length < 32) fail("BETTER_AUTH_SECRET doit compter au moins 32 caractères.");

  // Migrations par une connexion directe quand elle existe (DATABASE_URL_UNPOOLED : intégration Neon de Vercel).
  const pool = new Pool({ connectionString: withExplicitSslMode(process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL), max: 1 });
  try {
    // Garde-fou : jamais l'environnement de développement sur la base de production, ni l'inverse.
    // Contrôlé avant toute écriture, y compris pour une prévisualisation qui ne migre pas.
    const check = checkDatabaseForEnvironment({ target, ...(await readDatabaseState(pool)) });
    if (!check.ok) fail(check.error);

    if (preview && process.env.PREVIEW_MIGRATIONS !== "true") {
      console.log("[predeploy] Prévisualisation : base non modifiée (ni migration ni démonstration).");
      return;
    }

    await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
    console.log("[predeploy] Migrations appliquées.");
    if (check.mark) {
      await pool.query(
        `insert into platform_settings (key, value) values ('environment', $1)
         on conflict (key) do update set value = excluded.value, updated_at = now()`,
        [target],
      );
      console.log(`[predeploy] Base marquée « ${target} ».`);
    }
  } catch (error) {
    fail(`Préparation de la base impossible : ${(error as Error).message || String(error)}`);
  } finally {
    await pool.end();
  }

  if (process.env.SEED_DEMO_DATA === "true") {
    const seed = spawnSync("npx", ["tsx", "--conditions=react-server", "scripts/seed.ts"], { stdio: "inherit", shell: true, env: process.env });
    if (seed.status !== 0) fail("Chargement des données de démonstration impossible.");
  }
}

main();

/**
 * Préparation d'un déploiement (Vercel : script `vercel-build`, avant `next build`) :
 * 1. contrôle de la configuration obligatoire (noms des variables manquantes, jamais leurs valeurs) ;
 * 2. migrations SQL du dossier `drizzle/` (sans effet si la base est à jour) ;
 * 3. données de démonstration si SEED_DEMO_DATA=true (sans effet si la base contient déjà des données).
 * En production, une erreur arrête le déploiement : la version en ligne reste la précédente.
 *
 * Prévisualisations (VERCEL_ENV=preview, une par branche et par PR) : la base n'est jamais modifiée, pour
 * qu'une branche non approuvée ne touche pas la base de production. Pour tester des migrations en
 * prévisualisation, déclarer pour l'environnement Preview une base distincte (branche Neon) et
 * PREVIEW_MIGRATIONS=true. Une prévisualisation sans configuration se construit quand même (avertissement).
 */
import "dotenv/config";
import { spawnSync } from "node:child_process";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

function fail(message: string): never {
  console.error(`\n[predeploy] ${message}\n`);
  process.exit(1);
}

async function main() {
  const preview = process.env.VERCEL_ENV === "preview";
  const missing = ["DATABASE_URL", "BETTER_AUTH_SECRET"].filter((name) => !process.env[name]);
  if (missing.length > 0) {
    const message = `Variables d'environnement manquantes : ${missing.join(", ")}. Les déclarer dans Vercel (Settings → Environment Variables), puis redéployer.`;
    if (!preview) fail(message);
    console.warn(`[predeploy] Prévisualisation sans base : ${message}`);
    return;
  }
  if ((process.env.BETTER_AUTH_SECRET ?? "").length < 32) fail("BETTER_AUTH_SECRET doit compter au moins 32 caractères.");

  if (preview && process.env.PREVIEW_MIGRATIONS !== "true") {
    console.log("[predeploy] Prévisualisation : base non modifiée (ni migration ni démonstration).");
    return;
  }

  // Migrations par une connexion directe quand elle existe (DATABASE_URL_UNPOOLED : intégration Neon de Vercel).
  const pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL, max: 1 });
  try {
    await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
    console.log("[predeploy] Migrations appliquées.");
  } catch (error) {
    fail(`Migrations impossibles : ${(error as Error).message}`);
  } finally {
    await pool.end();
  }

  if (process.env.SEED_DEMO_DATA === "true") {
    const seed = spawnSync("npx", ["tsx", "--conditions=react-server", "scripts/seed.ts"], { stdio: "inherit", shell: true, env: process.env });
    if (seed.status !== 0) fail("Chargement des données de démonstration impossible.");
  }
}

main();

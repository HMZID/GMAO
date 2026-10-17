import { sql } from "drizzle-orm";
import { connection } from "next/server";
import { db } from "@/server/db";
import { deploymentEnvironment } from "@/server/domain/deployment";

/**
 * Sonde de disponibilité (TEC-08) : accès à la base et configuration obligatoire.
 * En cas d'erreur, seuls les noms des variables manquantes sont indiqués, jamais une valeur.
 * `version` : commit déployé (APP_VERSION, posée par le workflow de mise en production), pour vérifier
 * après un déploiement que la version en ligne est bien la nouvelle. `environment` : production, development
 * (déploiement de `develop`) ou local.
 */
export async function GET() {
  await connection();
  const missing = ["DATABASE_URL", "BETTER_AUTH_SECRET"].filter((name) => !process.env[name]);
  if (missing.length > 0) return Response.json({ status: "error", reason: "configuration", missing }, { status: 503 });
  try {
    await db.execute(sql`select 1`);
    return Response.json({
      status: "ok",
      version: process.env.APP_VERSION ?? null,
      environment: deploymentEnvironment(process.env.VERCEL_ENV) ?? "local",
      time: new Date().toISOString(),
    });
  } catch {
    return Response.json({ status: "error", reason: "database" }, { status: 503 });
  }
}

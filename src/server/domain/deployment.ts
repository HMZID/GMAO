/**
 * Environnements de déploiement : production (`main`) et développement (`develop`, prévisualisation Vercel).
 * Chaque base porte la marque de son environnement (table `platform_settings`) : un déploiement refuse une
 * base marquée pour l'autre environnement, et le développement refuse une base existante non marquée, qui
 * pourrait être la production. Module pur, testé dans `__tests__/deployment.test.ts`.
 */

export type DeploymentEnvironment = "production" | "development";

/** Environnement visé par une construction Vercel (`VERCEL_ENV`) ; hors Vercel, aucun (poste local). */
export function deploymentEnvironment(vercelEnv: string | undefined): DeploymentEnvironment | null {
  if (vercelEnv === "production") return "production";
  if (vercelEnv === "preview") return "development";
  return null;
}

export const ENVIRONMENT_LABEL: Record<DeploymentEnvironment, string> = {
  production: "production",
  development: "développement",
};

export type DatabaseCheck = { ok: true; mark: boolean } | { ok: false; error: string };

/**
 * La base peut-elle servir cet environnement ? `mark` : poser la marque après les migrations.
 * Une base de production existante (avant la marque) est acceptée et marquée en production.
 */
export function checkDatabaseForEnvironment(input: { target: DeploymentEnvironment; marker: string | null; hasData: boolean }): DatabaseCheck {
  const { target, marker, hasData } = input;
  if (marker === target) return { ok: true, mark: false };
  if (marker === "production" || marker === "development") {
    return {
      ok: false,
      error: `Cette base est celle de l'environnement de ${ENVIRONMENT_LABEL[marker]} : elle ne peut pas servir l'environnement de ${ENVIRONMENT_LABEL[target]}. Vérifier DATABASE_URL dans Vercel (portée Production ou Preview).`,
    };
  }
  if (target === "development" && hasData) {
    return {
      ok: false,
      error:
        "Base existante sans marque d'environnement : c'est peut-être la production. L'environnement de développement exige une base vide ou déjà marquée « development » (DATABASE_URL de portée Preview).",
    };
  }
  return { ok: true, mark: true };
}

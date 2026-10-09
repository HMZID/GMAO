/**
 * Adresse publique de l'application (liens des courriels, authentification) : APP_URL ou BETTER_AUTH_URL,
 * sinon, sur Vercel, l'adresse de production du projet (VERCEL_PROJECT_PRODUCTION_URL), puis localhost.
 */
export function publicUrl() {
  const explicit = process.env.APP_URL || process.env.BETTER_AUTH_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

/** Origines acceptées pour la connexion : adresse publique, et adresses du déploiement Vercel en cours (prévisualisations). */
export function trustedOrigins() {
  const vercel = [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]
    .filter((host): host is string => !!host)
    .map((host) => `https://${host}`);
  return [...new Set([publicUrl(), ...vercel])];
}

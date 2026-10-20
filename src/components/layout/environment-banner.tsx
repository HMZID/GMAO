import { T } from "@/i18n/client";
import { deploymentEnvironment } from "@/server/domain/deployment";

/** Bandeau permanent de l'environnement de développement (déploiement de `develop`), jamais affiché en production. */
export function EnvironmentBanner() {
  if (deploymentEnvironment(process.env.VERCEL_ENV) !== "development") return null;
  return (
    <div role="note" className="bg-amber-400 px-4 py-1 text-center text-xs font-semibold text-amber-950">
      <T>Environnement de développement : données de test, versions en cours de recette.</T>
    </div>
  );
}

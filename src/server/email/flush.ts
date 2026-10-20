import "server-only";
import { after } from "next/server";
import { processEmailQueue } from "@/server/services/email";

/**
 * NOT-01 : sur Vercel, la tâche planifiée ne passe qu'une fois par jour (offre gratuite) ; sans cela, une DI P1
 * ou une validation en attente n'enverrait son courriel que le lendemain. Après une écriture réussie, la file
 * d'envoi est vidée une fois la réponse partie (les événements sont déjà validés : ils sont écrits dans la
 * transaction de l'événement). Ailleurs (poste local, CI), le processus `npm run worker` s'en charge.
 */
export function flushEmailQueueAfterResponse() {
  if (!process.env.VERCEL) return;
  try {
    after(() => processEmailQueue({ limit: 20 }).catch((error) => console.error("[courriel]", error)));
  } catch {
    // Hors d'une requête (script, traitement planifié) : rien à planifier.
  }
}

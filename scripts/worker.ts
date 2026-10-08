/**
 * Processus d'envoi des courriels (npm run worker), à lancer à côté de l'application (NOT-01) :
 * - toutes les EMAIL_WORKER_INTERVAL_SECONDS secondes (30 par défaut) : envoi des courriels dus, avec reprises ;
 * - toutes les EMAIL_ALERTS_INTERVAL_MINUTES minutes (15 par défaut) : alertes calculées (échéances, retards,
 *   stock, documents), sans doublon grâce aux clés d'événement.
 * Plusieurs processus peuvent tourner en parallèle : un courriel n'est pris en charge que par un seul.
 * `npm run worker -- --once` traite une seule fois puis s'arrête (tâche planifiée du système).
 */
import "dotenv/config";
import { processEmailQueue, runScheduledAlerts } from "@/server/services/email";

const queueEvery = Number(process.env.EMAIL_WORKER_INTERVAL_SECONDS ?? 30) * 1000;
const alertsEvery = Number(process.env.EMAIL_ALERTS_INTERVAL_MINUTES ?? 15) * 60_000;
const once = process.argv.includes("--once");

let stopping = false;
let lastAlerts = 0;

async function tick() {
  const now = Date.now();
  if (now - lastAlerts >= alertsEvery) {
    lastAlerts = now;
    const alerts = await runScheduledAlerts(new Date(now));
    if (alerts.queued > 0) console.info(`[worker] ${alerts.queued} alerte(s) mise(s) en file`);
  }
  const result = await processEmailQueue();
  if (result.sent + result.retried + result.failed > 0) {
    console.info(`[worker] envoyés ${result.sent}, à retenter ${result.retried}, en échec ${result.failed}`);
  }
}

async function main() {
  console.info(`[worker] démarré (file toutes les ${queueEvery / 1000} s, alertes toutes les ${alertsEvery / 60_000} min)`);
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => (stopping = true));
  do {
    try {
      await tick();
    } catch (error) {
      // Base indisponible, erreur imprévue : le processus continue et réessaie au tour suivant.
      console.error("[worker] erreur", error);
    }
    if (once) break;
    await new Promise((resolve) => setTimeout(resolve, queueEvery));
  } while (!stopping);
  process.exit(0);
}

main();

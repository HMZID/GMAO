import { connection } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { processEmailQueue, runScheduledAlerts } from "@/server/services/email";

/**
 * Déclenchement par une tâche planifiée externe (cron de l'hébergeur) quand le processus `npm run worker`
 * n'est pas utilisé : alertes calculées puis envoi de la file. Protégé par `Authorization: Bearer <CRON_SECRET>`.
 */
export async function POST(request: Request) {
  await connection();
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const ok = !!secret && secret.length >= 16 && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) return Response.json({ error: { code: "unauthorized", message: "Authentification requise." } }, { status: 401 });
  const alerts = await runScheduledAlerts();
  const queue = await processEmailQueue({ limit: 200 });
  return Response.json({ data: { ...alerts, ...queue } });
}

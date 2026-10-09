import { apiRoute, readJson } from "@/server/api/handler";
import { getMyEmailPreferences, updateMyEmailPreferences } from "@/server/services/email";

/** Préférences de notification par courriel de l'utilisateur connecté (les alertes obligatoires restent actives). */
export const GET = apiRoute(async (ctx) => getMyEmailPreferences(ctx));

/** { enabled: ["ASSIGNMENT", …] } : événements reçus par courriel. */
export const PUT = apiRoute(async (ctx, request) => {
  await updateMyEmailPreferences(ctx, await readJson(request));
  return getMyEmailPreferences(ctx);
});

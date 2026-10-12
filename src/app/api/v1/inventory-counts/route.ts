import { apiRoute, queryOf, readJson } from "@/server/api/handler";
import { createInventoryCount, listInventoryCounts } from "@/server/services/inventory";

export const GET = apiRoute(async (ctx, request) => listInventoryCounts(ctx, queryOf(request)));
/** Comptage d'inventaire : écart appliqué sous le seuil, « à valider » au-delà (STK-07) ; idempotent par `clientId`. */
export const POST = apiRoute(async (ctx, request) => createInventoryCount(ctx, await readJson(request)), { status: 201 });

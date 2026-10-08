import { apiRoute, queryOf, readJson } from "@/server/api/handler";
import { createMovement, listMovements } from "@/server/services/stock";

export const GET = apiRoute(async (ctx, request) => listMovements(ctx, queryOf(request)));
/** Réception, ajustement d'inventaire, rebut, transfert ; idempotent par `clientId` (règle 2 de §7.5). */
export const POST = apiRoute(async (ctx, request) => createMovement(ctx, await readJson(request)), { status: 201 });

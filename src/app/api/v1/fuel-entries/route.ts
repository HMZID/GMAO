import { apiRoute, queryOf, readJson } from "@/server/api/handler";
import { listFuelEntries, recordFuelEntry } from "@/server/services/fuel";

/** Pleins et appoints du périmètre ; saisie d'un plein (idempotente par clientId), anomalies renvoyées. */
export const GET = apiRoute(async (ctx, request) => listFuelEntries(ctx, queryOf(request)));
export const POST = apiRoute(async (ctx, request) => recordFuelEntry(ctx, await readJson(request)), { status: 201 });

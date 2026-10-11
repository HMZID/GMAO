import { apiRoute, readJson } from "@/server/api/handler";
import { createIndicator, listIndicators } from "@/server/services/indicators";

/** Indicateurs personnalisés (KPI-11) : liste calculée, composition. */
export const GET = apiRoute(async (ctx) => listIndicators(ctx));

export const POST = apiRoute(async (ctx, request) => createIndicator(ctx, await readJson(request)), { status: 201 });

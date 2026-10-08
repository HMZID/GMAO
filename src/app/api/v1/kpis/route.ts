import { apiRoute, queryOf } from "@/server/api/handler";
import { getIndicators } from "@/server/services/kpi";

/** Indicateurs de la période (?from=&to=&siteId=&categoryId=) — formules du CDC §9.2. */
export const GET = apiRoute(async (ctx, request) => getIndicators(ctx, queryOf(request)));

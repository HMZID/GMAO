import { apiRoute, queryOf } from "@/server/api/handler";
import { getWeekPlanning } from "@/server/services/planning";

export const GET = apiRoute(async (ctx, request) => getWeekPlanning(ctx, queryOf(request)));

import { apiRoute, queryOf } from "@/server/api/handler";
import { listStockLevels } from "@/server/services/stock";

export const GET = apiRoute(async (ctx, request) => listStockLevels(ctx, queryOf(request)));

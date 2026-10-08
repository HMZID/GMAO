import { apiRoute, queryOf } from "@/server/api/handler";
import { listDueItems } from "@/server/services/preventive";

export const GET = apiRoute(async (ctx, request) => listDueItems(ctx, queryOf(request)));

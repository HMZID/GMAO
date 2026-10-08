import { apiRoute, queryOf, readJson } from "@/server/api/handler";
import { createWorkOrder, listWorkOrders } from "@/server/services/work-orders";

export const GET = apiRoute(async (ctx, request) => listWorkOrders(ctx, queryOf(request)));
export const POST = apiRoute(async (ctx, request) => createWorkOrder(ctx, await readJson(request)), { status: 201 });

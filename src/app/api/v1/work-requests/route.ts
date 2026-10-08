import { apiRoute, queryOf, readJson } from "@/server/api/handler";
import { createWorkRequest, listWorkRequests } from "@/server/services/work-requests";

export const GET = apiRoute(async (ctx, request) => listWorkRequests(ctx, queryOf(request)));
export const POST = apiRoute(async (ctx, request) => createWorkRequest(ctx, await readJson(request)), { status: 201 });

import { apiRoute, queryOf, readJson } from "@/server/api/handler";
import { createPart, listParts } from "@/server/services/stock";

export const GET = apiRoute(async (ctx, request) => listParts(ctx, queryOf(request)));
export const POST = apiRoute(async (ctx, request) => createPart(ctx, await readJson(request)), { status: 201 });

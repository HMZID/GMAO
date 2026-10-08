import { apiRoute, readJson } from "@/server/api/handler";
import { createSupplier, listSuppliers } from "@/server/services/stock";

export const GET = apiRoute(async (ctx) => listSuppliers(ctx));
export const POST = apiRoute(async (ctx, request) => createSupplier(ctx, await readJson(request)), { status: 201 });

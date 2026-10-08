import { apiRoute, queryOf, readJson } from "@/server/api/handler";
import { createEquipment, listEquipment } from "@/server/services/equipment";

export const GET = apiRoute(async (ctx, request) => listEquipment(ctx, queryOf(request)));
export const POST = apiRoute(async (ctx, request) => createEquipment(ctx, await readJson(request)), { status: 201 });

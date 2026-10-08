import { apiRoute, readJson } from "@/server/api/handler";
import { getEquipment, updateEquipment } from "@/server/services/equipment";

type Ctx = RouteContext<"/api/v1/equipment/[id]">;

export const GET = apiRoute<Ctx>(async (ctx, _request, { params }) => getEquipment(ctx, (await params).id));
export const PATCH = apiRoute<Ctx>(async (ctx, request, { params }) => updateEquipment(ctx, (await params).id, await readJson(request)));

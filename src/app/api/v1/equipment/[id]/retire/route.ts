import { apiRoute, readJson } from "@/server/api/handler";
import { retireEquipment } from "@/server/services/equipment";

type Ctx = RouteContext<"/api/v1/equipment/[id]/retire">;

export const POST = apiRoute<Ctx>(async (ctx, request, { params }) => retireEquipment(ctx, (await params).id, await readJson(request)));

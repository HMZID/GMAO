import { apiRoute, readJson } from "@/server/api/handler";
import { assignEquipment } from "@/server/services/equipment";

type Ctx = RouteContext<"/api/v1/equipment/[id]/assignments">;

export const POST = apiRoute<Ctx>(async (ctx, request, { params }) => assignEquipment(ctx, (await params).id, await readJson(request)), {
  status: 201,
});

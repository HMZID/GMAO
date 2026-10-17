import { apiRoute, readJson } from "@/server/api/handler";
import { renewDeadline } from "@/server/services/fleet-deadlines";

type Ctx = RouteContext<"/api/v1/equipment-deadlines/[id]/renew">;

export const POST = apiRoute<Ctx>(async (ctx, request, { params }) => renewDeadline(ctx, (await params).id, await readJson(request)), {
  status: 201,
});

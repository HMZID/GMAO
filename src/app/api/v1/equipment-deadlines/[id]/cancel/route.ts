import { apiRoute, readJson } from "@/server/api/handler";
import { cancelDeadline } from "@/server/services/fleet-deadlines";

type Ctx = RouteContext<"/api/v1/equipment-deadlines/[id]/cancel">;

export const POST = apiRoute<Ctx>(async (ctx, request, { params }) => cancelDeadline(ctx, (await params).id, await readJson(request)));

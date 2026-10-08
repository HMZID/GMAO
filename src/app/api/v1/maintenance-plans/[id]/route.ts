import { apiRoute } from "@/server/api/handler";
import { getPlan } from "@/server/services/preventive";

type Ctx = RouteContext<"/api/v1/maintenance-plans/[id]">;

export const GET = apiRoute<Ctx>(async (ctx, _request, { params }) => getPlan(ctx, (await params).id));

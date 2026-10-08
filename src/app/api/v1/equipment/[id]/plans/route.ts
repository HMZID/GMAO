import { apiRoute, readJson } from "@/server/api/handler";
import { applyPlan } from "@/server/services/preventive";

type Ctx = RouteContext<"/api/v1/equipment/[id]/plans">;

export const POST = apiRoute<Ctx>(async (ctx, request, { params }) => applyPlan(ctx, (await params).id, await readJson(request)), { status: 201 });

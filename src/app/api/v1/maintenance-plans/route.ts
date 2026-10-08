import { apiRoute, readJson } from "@/server/api/handler";
import { createPlan, listPlans } from "@/server/services/preventive";

export const GET = apiRoute(async (ctx) => listPlans(ctx));
export const POST = apiRoute(async (ctx, request) => createPlan(ctx, await readJson(request)), { status: 201 });

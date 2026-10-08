import { apiRoute, readJson } from "@/server/api/handler";
import { getWorkOrder, updatePlanning } from "@/server/services/work-orders";

type Ctx = RouteContext<"/api/v1/work-orders/[id]">;

export const GET = apiRoute<Ctx>(async (ctx, _request, { params }) => getWorkOrder(ctx, (await params).id));
/** Planification et affectation (PLA-01) : renvoie les avertissements de conflit éventuels. */
export const PATCH = apiRoute<Ctx>(async (ctx, request, { params }) => updatePlanning(ctx, (await params).id, await readJson(request)));

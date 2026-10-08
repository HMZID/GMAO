import { apiRoute, readJson } from "@/server/api/handler";
import { transitionWorkOrder } from "@/server/services/work-orders";

type Ctx = RouteContext<"/api/v1/work-orders/[id]/transitions">;

/** Changement de statut contrôlé par la machine à états (COR-06) : 422 avec la liste des conditions manquantes. */
export const POST = apiRoute<Ctx>(async (ctx, request, { params }) => transitionWorkOrder(ctx, (await params).id, await readJson(request)));

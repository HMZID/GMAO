import { apiRoute, readJson } from "@/server/api/handler";
import { updateReport } from "@/server/services/work-orders";

type Ctx = RouteContext<"/api/v1/work-orders/[id]/report">;

export const PUT = apiRoute<Ctx>(async (ctx, request, { params }) => updateReport(ctx, (await params).id, await readJson(request)));

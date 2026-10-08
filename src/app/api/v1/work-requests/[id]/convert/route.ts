import { apiRoute } from "@/server/api/handler";
import { convertToWorkOrder } from "@/server/services/work-requests";

type Ctx = RouteContext<"/api/v1/work-requests/[id]/convert">;

export const POST = apiRoute<Ctx>(async (ctx, _request, { params }) => convertToWorkOrder(ctx, (await params).id), { status: 201 });

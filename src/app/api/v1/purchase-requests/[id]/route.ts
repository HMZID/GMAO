import { apiRoute } from "@/server/api/handler";
import { getPurchaseRequest } from "@/server/services/purchase-requests";

type Ctx = RouteContext<"/api/v1/purchase-requests/[id]">;

export const GET = apiRoute<Ctx>(async (ctx, _request, { params }) => getPurchaseRequest(ctx, (await params).id));

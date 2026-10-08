import { apiRoute } from "@/server/api/handler";
import { getWorkRequest } from "@/server/services/work-requests";

type Ctx = RouteContext<"/api/v1/work-requests/[id]">;

export const GET = apiRoute<Ctx>(async (ctx, _request, { params }) => getWorkRequest(ctx, (await params).id));

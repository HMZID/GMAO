import { apiRoute, readJson } from "@/server/api/handler";
import { rejectWorkRequest } from "@/server/services/work-requests";

type Ctx = RouteContext<"/api/v1/work-requests/[id]/reject">;

export const POST = apiRoute<Ctx>(async (ctx, request, { params }) => rejectWorkRequest(ctx, (await params).id, await readJson(request)));

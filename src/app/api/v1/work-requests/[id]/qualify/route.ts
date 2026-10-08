import { apiRoute, readJson } from "@/server/api/handler";
import { qualifyWorkRequest } from "@/server/services/work-requests";

type Ctx = RouteContext<"/api/v1/work-requests/[id]/qualify">;

export const POST = apiRoute<Ctx>(async (ctx, request, { params }) => qualifyWorkRequest(ctx, (await params).id, await readJson(request)));

import { apiRoute, readJson } from "@/server/api/handler";
import { replaceMeter } from "@/server/services/meters";

type Ctx = RouteContext<"/api/v1/meters/[id]/replacement">;

export const POST = apiRoute<Ctx>(async (ctx, request, { params }) => replaceMeter(ctx, (await params).id, await readJson(request)), { status: 201 });

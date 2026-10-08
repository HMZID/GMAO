import { apiRoute } from "@/server/api/handler";
import { getPart } from "@/server/services/stock";

type Ctx = RouteContext<"/api/v1/parts/[id]">;

export const GET = apiRoute<Ctx>(async (ctx, _request, { params }) => getPart(ctx, (await params).id));

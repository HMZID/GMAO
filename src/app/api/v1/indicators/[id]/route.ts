import { apiRoute } from "@/server/api/handler";
import { deleteIndicator, getIndicator } from "@/server/services/indicators";

type Ctx = RouteContext<"/api/v1/indicators/[id]">;

export const GET = apiRoute<Ctx>(async (ctx, _request, { params }) => getIndicator(ctx, (await params).id));

export const DELETE = apiRoute<Ctx>(async (ctx, _request, { params }) => {
  await deleteIndicator(ctx, (await params).id);
  return null;
});

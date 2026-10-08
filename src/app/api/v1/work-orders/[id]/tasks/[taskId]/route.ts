import { apiRoute, readJson } from "@/server/api/handler";
import { updateTask } from "@/server/services/work-orders";

type Ctx = RouteContext<"/api/v1/work-orders/[id]/tasks/[taskId]">;

export const PATCH = apiRoute<Ctx>(async (ctx, request, { params }) => {
  const { id, taskId } = await params;
  return updateTask(ctx, id, taskId, await readJson(request));
});

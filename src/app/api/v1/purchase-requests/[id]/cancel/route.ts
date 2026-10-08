import { apiRoute, readJson } from "@/server/api/handler";
import { cancelPurchaseRequest } from "@/server/services/purchase-requests";

type Ctx = RouteContext<"/api/v1/purchase-requests/[id]/cancel">;

/** { reason } : annulation par le demandeur ou un acheteur ; la validation en cours est close. */
export const POST = apiRoute<Ctx>(async (ctx, request, { params }) => {
  await cancelPurchaseRequest(ctx, (await params).id, await readJson(request));
  return null;
});

import { apiRoute, readJson } from "@/server/api/handler";
import { recordPart } from "@/server/services/work-orders";

type Ctx = RouteContext<"/api/v1/work-orders/[id]/parts">;

/** { action: "reserve" | "issue" | "return", partId, warehouseId, quantity, clientId? } (COR-10). */
export const POST = apiRoute<Ctx>(async (ctx, request, { params }) => recordPart(ctx, (await params).id, await readJson(request)), { status: 201 });

import { apiRoute, readJson } from "@/server/api/handler";
import { decideInventoryCount } from "@/server/services/inventory";

type Ctx = RouteContext<"/api/v1/inventory-counts/[id]/decision">;

/** { decision: "APPROVE" | "REJECT", comment } : motif obligatoire en cas de refus (STK-07). */
export const POST = apiRoute<Ctx>(async (ctx, request, { params }) => decideInventoryCount(ctx, (await params).id, await readJson(request)));

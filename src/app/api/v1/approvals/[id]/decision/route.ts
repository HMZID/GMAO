import { apiRoute, readJson } from "@/server/api/handler";
import { decideApproval } from "@/server/services/approvals";

type Ctx = RouteContext<"/api/v1/approvals/[id]/decision">;

/** { decision: "APPROVED" | "REJECTED", comment } : commentaire obligatoire en cas de refus (HAB-04). */
export const POST = apiRoute<Ctx>(async (ctx, request, { params }) => decideApproval(ctx, (await params).id, await readJson(request)));

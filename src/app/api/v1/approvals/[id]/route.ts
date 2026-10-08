import { apiRoute } from "@/server/api/handler";
import { getApprovalRequest } from "@/server/services/approvals";

type Ctx = RouteContext<"/api/v1/approvals/[id]">;

/** Demande de validation : étapes, décisions, droit de trancher. */
export const GET = apiRoute<Ctx>(async (ctx, _request, { params }) => getApprovalRequest(ctx, (await params).id));

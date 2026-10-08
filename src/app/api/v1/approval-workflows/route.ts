import { apiRoute } from "@/server/api/handler";
import { listWorkflows } from "@/server/services/approvals";

/** Circuits de validation paramétrés, avec leurs étapes (administrateur). */
export const GET = apiRoute(async (ctx) => listWorkflows(ctx));

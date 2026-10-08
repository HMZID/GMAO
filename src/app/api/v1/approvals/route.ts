import { apiRoute } from "@/server/api/handler";
import { listPendingForMe } from "@/server/services/approvals";

/** Demandes en attente que l'utilisateur peut trancher (valideur de l'étape ou suppléant). */
export const GET = apiRoute(async (ctx) => listPendingForMe(ctx));

import { apiRoute, queryOf, readJson } from "@/server/api/handler";
import { createPurchaseRequest, listPurchaseRequests } from "@/server/services/purchase-requests";

export const GET = apiRoute(async (ctx, request) => listPurchaseRequests(ctx, queryOf(request)));

/** Création puis soumission au circuit « demande d'achat » (ACH-01, ACH-02). */
export const POST = apiRoute(async (ctx, request) => createPurchaseRequest(ctx, await readJson(request)), { status: 201 });

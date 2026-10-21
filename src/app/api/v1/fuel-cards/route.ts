import { apiRoute, readJson } from "@/server/api/handler";
import { createFuelCard, listFuelCards } from "@/server/services/fuel";

/** Cartes carburant (4 derniers chiffres seulement) ; création par le responsable du parc. */
export const GET = apiRoute(async (ctx) => listFuelCards(ctx));
export const POST = apiRoute(async (ctx, request) => createFuelCard(ctx, await readJson(request)), { status: 201 });

import { apiRoute } from "@/server/api/handler";
import { listWarehouses } from "@/server/services/organization";

/** Magasins du périmètre (choix du magasin de sortie des pièces, application mobile). */
export const GET = apiRoute(async (ctx) => listWarehouses(ctx));

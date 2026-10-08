import { apiCatalog } from "@/server/api/catalog";

/** Catalogue public de l'API v1 : points d'entrée, droits requis et schémas JSON des corps et filtres. */
export function GET() {
  return Response.json(apiCatalog());
}

import { fileResponse } from "@/server/api/files";
import { apiRoute, queryOf } from "@/server/api/handler";
import { parseInput } from "@/server/services/_shared";
import { datasetSchema, exportFile, exportPage, exportQuery } from "@/server/services/exports";

type Ctx = RouteContext<"/api/v1/exports/[dataset]">;

/**
 * Un jeu de données :
 * - JSON (par défaut) paginé : ?limit=1000&offset=0, `page.next` donne le décalage suivant ;
 * - ?format=csv ou ?format=xlsx : fichier complet.
 * ?updatedSince=<ISO 8601> limite aux lignes créées ou modifiées depuis cette date (extraction incrémentale).
 */
export const GET = apiRoute<Ctx>(async (ctx, request, { params }) => {
  const dataset = parseInput(datasetSchema, (await params).dataset);
  const query = queryOf(request);
  const { format, updatedSince } = parseInput(exportQuery, query);
  if (format === "json") return exportPage(ctx, dataset, query);
  return fileResponse(await exportFile(ctx, dataset, format, updatedSince));
});

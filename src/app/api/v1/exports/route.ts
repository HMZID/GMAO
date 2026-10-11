import { xlsxResponse } from "@/server/api/files";
import { apiRoute } from "@/server/api/handler";
import { EXPORT_DEFINITIONS } from "@/server/domain/exports";
import { exportSummary, exportWorkbook } from "@/server/services/exports";

/**
 * Export des données de l'organisation (INT-01) :
 * - sans paramètre : catalogue des jeux de données exportables, avec leur nombre de lignes et leurs adresses ;
 * - ?format=xlsx : classeur Excel complet (un onglet par jeu de données) ;
 * - ?companyId=<uuid> : une seule société de l'organisation.
 */
export const GET = apiRoute(async (ctx, request) => {
  const params = new URL(request.url).searchParams;
  const companyId = params.get("companyId") || undefined;
  if (params.get("format") === "xlsx") return xlsxResponse(await exportWorkbook(ctx, companyId));
  const summary = await exportSummary(ctx, companyId);
  const suffix = companyId ? `companyId=${encodeURIComponent(companyId)}` : "";
  return summary.map((s) => ({
    ...s,
    columns: EXPORT_DEFINITIONS[s.dataset].columns.map(({ key, label, type }) => ({ key, label, type })),
    links: {
      json: `/api/v1/exports/${s.dataset}${suffix ? `?${suffix}` : ""}`,
      csv: `/api/v1/exports/${s.dataset}?format=csv${suffix ? `&${suffix}` : ""}`,
      xlsx: `/api/v1/exports/${s.dataset}?format=xlsx${suffix ? `&${suffix}` : ""}`,
    },
  }));
});

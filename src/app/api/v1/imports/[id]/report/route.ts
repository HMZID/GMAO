import { apiRoute } from "@/server/api/handler";
import { importReport } from "@/server/services/imports";
import { xlsxResponse } from "@/server/api/files";

type Ctx = RouteContext<"/api/v1/imports/[id]/report">;

/** Rapport Excel : statut et anomalies de chaque ligne. */
export const GET = apiRoute<Ctx>(async (ctx, _request, { params }) => xlsxResponse(await importReport(ctx, (await params).id)));

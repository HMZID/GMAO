import { apiRoute } from "@/server/api/handler";
import { xlsxResponse } from "@/server/api/files";
import { importTemplate } from "@/server/services/imports";

type Ctx = RouteContext<"/api/v1/imports/templates/[kind]">;

/** Modèle Excel : EQUIPMENT, PARTS ou INITIAL_STOCK (codes de l'organisation limités au périmètre). */
export const GET = apiRoute<Ctx>(async (ctx, _request, { params }) => xlsxResponse(await importTemplate(ctx, (await params).kind.toUpperCase())));

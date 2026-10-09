import { apiRoute } from "@/server/api/handler";
import { getImportJob } from "@/server/services/imports";

type Ctx = RouteContext<"/api/v1/imports/[id]">;

/** Diagnostic ligne par ligne d'un import (simulé ou exécuté). */
export const GET = apiRoute<Ctx>(async (ctx, _request, { params }) => getImportJob(ctx, (await params).id));

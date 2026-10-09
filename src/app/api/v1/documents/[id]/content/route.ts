import { apiRoute } from "@/server/api/handler";
import { getDocumentContent } from "@/server/services/documents";

type Ctx = RouteContext<"/api/v1/documents/[id]/content">;

/** Contenu du fichier après contrôle des droits ; ?download=1 force le téléchargement. */
export const GET = apiRoute<Ctx>(async (ctx, request, { params }) =>
  getDocumentContent(ctx, (await params).id, { download: new URL(request.url).searchParams.get("download") === "1" }),
);

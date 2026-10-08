import { apiRoute, readJson } from "@/server/api/handler";
import { deleteDocument, getDocument } from "@/server/services/documents";

type Ctx = RouteContext<"/api/v1/documents/[id]">;

export const GET = apiRoute<Ctx>(async (ctx, _request, { params }) => getDocument(ctx, (await params).id));

/** Retrait logique, motif facultatif { reason } ; le fichier est conservé pour l'audit. */
export const DELETE = apiRoute<Ctx>(async (ctx, request, { params }) => {
  const body = request.headers.get("content-length") && request.headers.get("content-length") !== "0" ? await readJson(request) : {};
  await deleteDocument(ctx, (await params).id, body);
  return null;
});

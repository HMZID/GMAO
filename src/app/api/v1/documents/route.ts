import { apiRoute, queryOf } from "@/server/api/handler";
import { ValidationError } from "@/server/errors";
import { listDocuments, uploadDocument } from "@/server/services/documents";

/** ?entityType=EQUIPMENT|WORK_ORDER&entityId=… : documents actifs de l'objet (EQP-07). */
export const GET = apiRoute(async (ctx, request) => listDocuments(ctx, queryOf(request)));

/**
 * Envoi multipart/form-data : `file` + entityType, entityId, kind, title?, description?, expiresAt?, clientId?.
 * Même service que l'écran ; un `clientId` déjà reçu renvoie le document existant (MOB-08).
 */
export const POST = apiRoute(
  async (ctx, request) => {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new ValidationError({}, "Corps multipart/form-data attendu avec un champ « file ».");
    }
    const file = form.get("file");
    const fields = Object.fromEntries([...form.entries()].filter(([key, value]) => key !== "file" && typeof value === "string" && value !== ""));
    return uploadDocument(
      ctx,
      fields,
      file instanceof File ? { name: file.name, type: file.type, bytes: new Uint8Array(await file.arrayBuffer()) } : null,
    );
  },
  { status: 201 },
);

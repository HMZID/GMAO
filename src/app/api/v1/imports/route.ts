import { apiRoute } from "@/server/api/handler";
import { ValidationError } from "@/server/errors";
import { listImportJobs, simulateImport } from "@/server/services/imports";

/** Derniers imports des types autorisés pour l'utilisateur. */
export const GET = apiRoute(async (ctx) => listImportJobs(ctx));

/** Simulation d'un import (multipart/form-data : kind, file .xlsx) ; rien n'est créé (§11.2). */
export const POST = apiRoute(
  async (ctx, request) => {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new ValidationError({}, "Corps multipart/form-data attendu avec les champs « kind » et « file ».");
    }
    const file = form.get("file");
    return simulateImport(ctx, form.get("kind"), file instanceof File ? { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) } : null);
  },
  { status: 201 },
);

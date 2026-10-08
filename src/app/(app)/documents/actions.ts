"use server";

import type { ActionState } from "@/lib/action-state";
import { act } from "@/server/actions";
import type { DocumentEntity } from "@/server/domain/documents";
import { deleteDocument, uploadDocument } from "@/server/services/documents";
import { formToObject } from "@/server/validation";

/** Pièces jointes des fiches équipement et OT (EQP-07) : mêmes services que l'API /api/v1/documents. */
export async function uploadDocumentAction(entityType: DocumentEntity, entityId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return act(async (ctx) => {
    const file = formData.get("file");
    const { file: _file, ...fields } = formToObject(formData);
    await uploadDocument(
      ctx,
      { ...fields, entityType, entityId },
      file instanceof File && file.size > 0 ? { name: file.name, type: file.type, bytes: new Uint8Array(await file.arrayBuffer()) } : null,
    );
  }, "Document ajouté.");
}

/** Retrait depuis la liste : l'identifiant est dans le formulaire (un seul panneau d'actions pour la carte). */
export async function deleteDocumentAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const { documentId, ...fields } = formToObject(formData);
  return act((ctx) => deleteDocument(ctx, String(documentId ?? ""), fields), "Document retiré.");
}

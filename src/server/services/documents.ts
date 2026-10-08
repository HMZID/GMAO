import "server-only";
import { createHash } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import type { AuthContext } from "@/server/authz/context";
import { db } from "@/server/db";
import { documents, equipment, user, workOrders } from "@/server/db/schema";
import {
  DOCUMENT_ENTITIES,
  DOCUMENT_KINDS,
  SIGNATURE_LENGTH,
  canDeleteDocument,
  checkFile,
  contentDisposition,
  maxSizeBytes,
  safeFileName,
  type DocumentEntity,
} from "@/server/domain/documents";
import { BusinessRuleError, ConflictError, ForbiddenError, NotFoundError } from "@/server/errors";
import { getStorage, storageKey } from "@/server/storage";
import { optionalDate, optionalText, text } from "@/server/validation";
import { assertCanOn, audit, parseInput } from "./_shared";
import { isUniqueViolation } from "./organization";

/* ------------------------------------------------------------------ */
/* Objet parent et droits                                               */
/* ------------------------------------------------------------------ */

type Parent = {
  entityType: DocumentEntity;
  id: string;
  companyId: string;
  siteId: string | null;
  /** Statut de l'OT ou de l'équipement : conditionne l'ajout et le retrait. */
  status: string;
};

/** Objet auquel le document est rattaché, dans le groupe de l'utilisateur. */
async function loadParent(ctx: AuthContext, entityType: DocumentEntity, entityId: string): Promise<Parent> {
  if (entityType === "EQUIPMENT") {
    const [row] = await db
      .select({ id: equipment.id, companyId: equipment.companyId, siteId: equipment.siteId, status: equipment.status })
      .from(equipment)
      .where(and(eq(equipment.id, entityId), eq(equipment.tenantId, ctx.tenantId)));
    if (!row) throw new NotFoundError("Équipement");
    return { entityType, ...row };
  }
  const [row] = await db
    .select({ id: workOrders.id, companyId: workOrders.companyId, siteId: workOrders.siteId, status: workOrders.status })
    .from(workOrders)
    .where(and(eq(workOrders.id, entityId), eq(workOrders.tenantId, ctx.tenantId)));
  if (!row) throw new NotFoundError("Ordre de travail");
  return { entityType, ...row };
}

/** Consultation : droit de lecture de l'objet parent ; factures réservées aux profils qui voient les fournisseurs. */
function canRead(ctx: AuthContext, parent: Parent, kind?: string) {
  const readPermission = parent.entityType === "EQUIPMENT" ? "equipment.read" : "workorder.read";
  if (!ctx.canOn(readPermission, parent)) return false;
  return kind !== "INVOICE" || ctx.canOn("supplier.read", parent);
}

/** Gestion des pièces jointes de l'objet : ajout sans restriction de statut et retrait de tout document. */
function isManager(ctx: AuthContext, parent: Parent) {
  return parent.entityType === "EQUIPMENT" ? ctx.canOn("equipment.write", parent) : ctx.canOn("workorder.manage", parent);
}

function assertCanUpload(ctx: AuthContext, parent: Parent, kind: string) {
  if (!canRead(ctx, parent)) throw new NotFoundError(parent.entityType === "EQUIPMENT" ? "Équipement" : "Ordre de travail");
  if (kind === "INVOICE" && !ctx.canOn("supplier.read", parent)) throw new ForbiddenError("Ajout de facture non autorisé sur ce périmètre.");
  if (parent.entityType === "EQUIPMENT") {
    assertCanOn(ctx, "equipment.write", parent);
    if (parent.status === "RETIRED") throw new BusinessRuleError(["Équipement réformé : fiche en lecture seule (EQP-14)."]);
    return;
  }
  if (isManager(ctx, parent)) return;
  assertCanOn(ctx, "workorder.execute", parent);
  if (["CLOSED", "CANCELLED"].includes(parent.status)) {
    throw new BusinessRuleError(["OT clôturé ou annulé : seul un gestionnaire peut encore y joindre un document."]);
  }
}

/* ------------------------------------------------------------------ */
/* Lecture                                                              */
/* ------------------------------------------------------------------ */

export const documentListInput = z.object({
  entityType: z.enum(DOCUMENT_ENTITIES, "Type d'objet attendu : EQUIPMENT ou WORK_ORDER"),
  entityId: z.uuid("Identifiant d'objet invalide"),
});

/**
 * Documents actifs d'un équipement ou d'un OT, avec le droit de retrait de chacun,
 * le droit d'ajout et la taille maximale acceptée (pour le formulaire d'envoi).
 */
export async function listDocuments(ctx: AuthContext, raw: unknown) {
  const input = parseInput(documentListInput, raw);
  const parent = await loadParent(ctx, input.entityType, input.entityId);
  if (!canRead(ctx, parent)) throw new NotFoundError(parent.entityType === "EQUIPMENT" ? "Équipement" : "Ordre de travail");

  const rows = await db
    .select({
      id: documents.id,
      kind: documents.kind,
      title: documents.title,
      description: documents.description,
      fileName: documents.fileName,
      contentType: documents.contentType,
      sizeBytes: documents.sizeBytes,
      expiresAt: documents.expiresAt,
      createdAt: documents.createdAt,
      uploadedById: documents.uploadedById,
      uploadedBy: user.name,
    })
    .from(documents)
    .leftJoin(user, eq(user.id, documents.uploadedById))
    .where(
      and(
        eq(documents.tenantId, ctx.tenantId),
        eq(documents.entityType, input.entityType),
        eq(documents.entityId, input.entityId),
        isNull(documents.deletedAt),
      ),
    )
    .orderBy(desc(documents.createdAt));

  const manager = isManager(ctx, parent);
  const items = rows
    .filter((d) => canRead(ctx, parent, d.kind))
    .map((d) => ({
      ...d,
      url: `/api/v1/documents/${d.id}/content`,
      canDelete: canDeleteDocument({
        isManager: manager,
        isUploader: d.uploadedById === ctx.userId,
        entityType: parent.entityType,
        workOrderStatus: parent.entityType === "WORK_ORDER" ? parent.status : null,
      }),
    }));
  return { items, canUpload: canUpload(ctx, parent), maxSizeBytes: maxSizeBytes(process.env.DOCUMENT_MAX_SIZE_MB) };
}

function canUpload(ctx: AuthContext, parent: Parent) {
  try {
    assertCanUpload(ctx, parent, "PHOTO");
    return true;
  } catch {
    return false;
  }
}

async function loadDocument(ctx: AuthContext, id: string) {
  if (!z.uuid().safeParse(id).success) throw new NotFoundError("Document");
  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.tenantId, ctx.tenantId), isNull(documents.deletedAt)));
  if (!doc) throw new NotFoundError("Document");
  const parent = await loadParent(ctx, doc.entityType, doc.entityId);
  // Hors périmètre ou facture non visible : « introuvable », sans révéler l'existence (HAB-02).
  if (!canRead(ctx, parent, doc.kind)) throw new NotFoundError("Document");
  return { doc, parent };
}

export async function getDocument(ctx: AuthContext, id: string) {
  const { doc } = await loadDocument(ctx, id);
  const { storageKey: _key, sha256: _sha, ...metadata } = doc;
  return { ...metadata, url: `/api/v1/documents/${doc.id}/content` };
}

/**
 * Contenu du fichier, après contrôle des droits. Le navigateur affiche les PDF, images et vidéos sûrs,
 * télécharge les autres ; le contenu est isolé (CSP sandbox, pas de détection de type).
 */
export async function getDocumentContent(ctx: AuthContext, id: string, options: { download?: boolean } = {}) {
  const { doc } = await loadDocument(ctx, id);
  const object = await getStorage().get(doc.storageKey);
  const inline = !options.download && INLINE_TYPES.has(doc.contentType);

  await audit(db, ctx, { entityType: "document", entityId: doc.id, action: "document.download", after: { fileName: doc.fileName } });

  return new Response(object.body, {
    headers: {
      "Content-Type": doc.contentType,
      "Content-Length": String(object.size || doc.sizeBytes),
      "Content-Disposition": contentDisposition(doc.fileName, inline),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'",
    },
  });
}

const INLINE_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp", "video/mp4"]);

/* ------------------------------------------------------------------ */
/* Ajout                                                                */
/* ------------------------------------------------------------------ */

export const documentInput = z.object({
  entityType: z.enum(DOCUMENT_ENTITIES, "Type d'objet attendu : EQUIPMENT ou WORK_ORDER"),
  entityId: z.uuid("Identifiant d'objet invalide"),
  kind: z.enum(DOCUMENT_KINDS, "Type de document obligatoire"),
  title: text(200).optional(),
  description: optionalText(1000),
  /** Date d'expiration facultative (certificat, rapport de contrôle) : sert aux alertes d'échéance. */
  expiresAt: optionalDate,
  clientId: z.string().trim().min(8).max(100).optional(),
});

export type UploadedFile = { name: string; type: string; bytes: Uint8Array };

/**
 * Joint un fichier à un équipement ou un OT (EQP-07, MOB-05). Contrôles : droits sur l'objet, format
 * réel du fichier, taille maximale (DOCUMENT_MAX_SIZE_MB), même fichier déjà joint. Idempotent par `clientId`.
 */
export async function uploadDocument(ctx: AuthContext, raw: unknown, file: UploadedFile | null) {
  const input = parseInput(documentInput, raw);
  if (!file) throw new BusinessRuleError(["Aucun fichier reçu."]);

  // Reprise d'un envoi déjà enregistré (mobile) : on renvoie le document existant.
  if (input.clientId) {
    const [existing] = await db
      .select({ id: documents.id })
      .from(documents)
      .where(and(eq(documents.tenantId, ctx.tenantId), eq(documents.clientId, input.clientId)));
    if (existing) return getDocument(ctx, existing.id);
  }

  const parent = await loadParent(ctx, input.entityType, input.entityId);
  assertCanUpload(ctx, parent, input.kind);

  const fileName = safeFileName(file.name);
  const check = checkFile(
    { name: fileName, size: file.bytes.byteLength, head: file.bytes.subarray(0, SIGNATURE_LENGTH) },
    maxSizeBytes(process.env.DOCUMENT_MAX_SIZE_MB),
  );
  if (!check.ok) throw new BusinessRuleError(check.errors);

  const sha256 = createHash("sha256").update(file.bytes).digest("hex");
  const [duplicate] = await db
    .select({ title: documents.title })
    .from(documents)
    .where(
      and(
        eq(documents.tenantId, ctx.tenantId),
        eq(documents.entityType, input.entityType),
        eq(documents.entityId, input.entityId),
        eq(documents.sha256, sha256),
        isNull(documents.deletedAt),
      ),
    );
  if (duplicate) throw new ConflictError(`Ce fichier est déjà joint (« ${duplicate.title} »).`);

  const documentId = crypto.randomUUID();
  const key = storageKey(ctx.tenantId, input.entityType, input.entityId, documentId);
  const storage = getStorage();
  // Le fichier est écrit avant la ligne : une ligne ne pointe jamais vers un fichier absent.
  await storage.put(key, file.bytes, check.format.contentType);

  try {
    await db.transaction(async (tx) => {
      const values = {
        id: documentId,
        tenantId: ctx.tenantId,
        companyId: parent.companyId,
        siteId: parent.siteId,
        entityType: input.entityType,
        entityId: input.entityId,
        kind: input.kind,
        title: input.title ?? fileName.replace(/\.[^.]+$/, ""),
        description: input.description,
        fileName,
        contentType: check.format.contentType,
        sizeBytes: file.bytes.byteLength,
        sha256,
        storageKey: key,
        expiresAt: input.expiresAt,
        clientId: input.clientId,
        uploadedById: ctx.userId,
      };
      await tx.insert(documents).values(values);
      await audit(tx, ctx, {
        entityType: input.entityType === "EQUIPMENT" ? "equipment" : "work_order",
        entityId: input.entityId,
        action: "document.upload",
        after: { documentId, kind: values.kind, title: values.title, fileName, sizeBytes: values.sizeBytes, storage: storage.driver },
      });
    });
  } catch (error) {
    await storage.remove(key).catch(() => undefined);
    // Deux envois simultanés du même clientId : le premier gagne, le second renvoie le même document.
    if (input.clientId && isUniqueViolation(error)) {
      const [existing] = await db
        .select({ id: documents.id })
        .from(documents)
        .where(and(eq(documents.tenantId, ctx.tenantId), eq(documents.clientId, input.clientId)));
      if (existing) return getDocument(ctx, existing.id);
    }
    throw error;
  }

  return getDocument(ctx, documentId);
}

/* ------------------------------------------------------------------ */
/* Retrait                                                              */
/* ------------------------------------------------------------------ */

export const documentDeleteInput = z.object({ reason: optionalText(500) });

/**
 * Retire un document de la fiche. Suppression logique (DON-06) : la ligne et le fichier sont conservés
 * pour l'audit ; le document n'est plus listé ni téléchargeable.
 */
export async function deleteDocument(ctx: AuthContext, id: string, raw: unknown = {}) {
  const input = parseInput(documentDeleteInput, raw);
  const { doc, parent } = await loadDocument(ctx, id);
  const allowed = canDeleteDocument({
    isManager: isManager(ctx, parent),
    isUploader: doc.uploadedById === ctx.userId,
    entityType: parent.entityType,
    workOrderStatus: parent.entityType === "WORK_ORDER" ? parent.status : null,
  });
  if (!allowed) throw new ForbiddenError("Retrait de ce document non autorisé.");

  await db.transaction(async (tx) => {
    await tx.update(documents).set({ deletedAt: new Date(), deletedById: ctx.userId, deletionReason: input.reason }).where(eq(documents.id, doc.id));
    await audit(tx, ctx, {
      entityType: doc.entityType === "EQUIPMENT" ? "equipment" : "work_order",
      entityId: doc.entityId,
      action: "document.delete",
      before: { documentId: doc.id, kind: doc.kind, title: doc.title, fileName: doc.fileName },
      after: { reason: input.reason ?? null },
    });
  });
}

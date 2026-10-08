import "server-only";
import { and, count, desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { AuthContext } from "@/server/authz/context";
import { db } from "@/server/db";
import { companies, costCenters, equipment, parts, purchaseRequests, sites, suppliers, user, workOrders } from "@/server/db/schema";
import { BusinessRuleError, NotFoundError } from "@/server/errors";
import { optionalDate, text } from "@/server/validation";
import { assertCanOn, audit, offsetOf, paginationSchema, parseInput, scopeWhere, type Page } from "./_shared";
import { approvalTimeline, cancelPendingApproval, startApproval } from "./approvals";
import { nextNumber } from "./numbering";

/**
 * Demandes d'achat (ACH-01, ACH-02) : besoin de pièces ou de prestation rattaché à un OT, un équipement
 * ou un centre de coût, puis validation par le circuit « demande d'achat » (seuils, direction au-delà).
 * La commande, la réception et la facture (ACH-03 à ACH-06) restent à construire.
 */

export const purchaseRequestInput = z
  .object({
    description: text(300, "Objet de la demande obligatoire"),
    partId: z.uuid().optional(),
    quantity: z.coerce.number({ error: "Quantité obligatoire" }).positive("Quantité supérieure à 0"),
    estimatedUnitPrice: z.coerce.number({ error: "Prix unitaire estimé obligatoire" }).min(0, "Prix positif attendu"),
    supplierId: z.uuid().optional(),
    workOrderId: z.uuid().optional(),
    equipmentId: z.uuid().optional(),
    costCenterId: z.uuid().optional(),
    /** Site du besoin, obligatoire pour un rattachement au seul centre de coût. */
    siteId: z.uuid().optional(),
    neededBy: optionalDate,
  })
  .refine((v) => !!(v.workOrderId || v.equipmentId || v.costCenterId), {
    message: "Rattacher la demande à un OT, un équipement ou un centre de coût (ACH-01)",
    path: ["workOrderId"],
  });

/** Société et site du besoin, déduits de l'OT, de l'équipement ou du centre de coût et du site choisi. */
async function resolveTarget(ctx: AuthContext, input: z.output<typeof purchaseRequestInput>) {
  if (input.workOrderId) {
    const [wo] = await db
      .select({ companyId: workOrders.companyId, siteId: workOrders.siteId, equipmentId: workOrders.equipmentId, number: workOrders.number })
      .from(workOrders)
      .where(and(eq(workOrders.id, input.workOrderId), eq(workOrders.tenantId, ctx.tenantId)));
    if (!wo) throw new NotFoundError("Ordre de travail");
    return { companyId: wo.companyId, siteId: wo.siteId, equipmentId: input.equipmentId ?? wo.equipmentId };
  }
  if (input.equipmentId) {
    const [eq_] = await db
      .select({ companyId: equipment.companyId, siteId: equipment.siteId })
      .from(equipment)
      .where(and(eq(equipment.id, input.equipmentId), eq(equipment.tenantId, ctx.tenantId)));
    if (!eq_) throw new NotFoundError("Équipement");
    return { companyId: eq_.companyId, siteId: eq_.siteId, equipmentId: input.equipmentId };
  }
  const [cc] = await db
    .select({ companyId: costCenters.companyId })
    .from(costCenters)
    .where(and(eq(costCenters.id, input.costCenterId!), eq(costCenters.tenantId, ctx.tenantId)));
  if (!cc) throw new NotFoundError("Centre de coût");
  if (!input.siteId) throw new BusinessRuleError(["Le site du besoin est obligatoire pour un rattachement au centre de coût."]);
  const [site] = await db
    .select({ companyId: sites.companyId })
    .from(sites)
    .where(and(eq(sites.id, input.siteId), eq(sites.tenantId, ctx.tenantId)));
  if (!site) throw new NotFoundError("Site");
  if (site.companyId !== cc.companyId) throw new BusinessRuleError(["Le site doit appartenir à la société du centre de coût."]);
  return { companyId: cc.companyId, siteId: input.siteId, equipmentId: null };
}

/** Crée la demande et la soumet au circuit ; sans étape applicable, elle est validée d'office. */
export async function createPurchaseRequest(ctx: AuthContext, raw: unknown) {
  const input = parseInput(purchaseRequestInput, raw);
  const target = await resolveTarget(ctx, input);
  assertCanOn(ctx, "purchase.create", target);
  if (input.partId) {
    const [p] = await db
      .select({ id: parts.id })
      .from(parts)
      .where(and(eq(parts.id, input.partId), eq(parts.tenantId, ctx.tenantId)));
    if (!p) throw new NotFoundError("Article");
  }
  if (input.supplierId) {
    const [s] = await db
      .select({ id: suppliers.id })
      .from(suppliers)
      .where(and(eq(suppliers.id, input.supplierId), eq(suppliers.tenantId, ctx.tenantId)));
    if (!s) throw new NotFoundError("Fournisseur");
  }
  const amount = Math.round(input.quantity * input.estimatedUnitPrice * 100) / 100;

  return db.transaction(async (tx) => {
    const number = await nextNumber(tx, { tenantId: ctx.tenantId, companyId: target.companyId, kind: "DA" });
    const [row] = await tx
      .insert(purchaseRequests)
      .values({
        tenantId: ctx.tenantId,
        companyId: target.companyId,
        siteId: target.siteId,
        number,
        description: input.description,
        partId: input.partId ?? null,
        quantity: input.quantity,
        estimatedUnitPrice: input.estimatedUnitPrice,
        amount,
        supplierId: input.supplierId ?? null,
        workOrderId: input.workOrderId ?? null,
        equipmentId: target.equipmentId,
        costCenterId: input.costCenterId ?? null,
        neededBy: input.neededBy ?? null,
        requestedById: ctx.userId,
      })
      .returning();
    await audit(tx, ctx, { entityType: "purchase_request", entityId: row.id, action: "create", after: row });
    const approval = await startApproval(tx, ctx, {
      objectType: "PURCHASE_REQUEST",
      objectId: row.id,
      companyId: row.companyId,
      siteId: row.siteId,
      label: `${row.number} · ${row.description}`,
      amount,
      requestedById: ctx.userId,
      entityType: "purchase_request",
    });
    if (!approval) {
      const [approved] = await tx.update(purchaseRequests).set({ status: "APPROVED" }).where(eq(purchaseRequests.id, row.id)).returning();
      return approved;
    }
    return row;
  });
}

export const purchaseRequestFilters = paginationSchema.extend({
  status: z.enum(["PENDING_APPROVAL", "APPROVED", "REJECTED", "CANCELLED"]).optional(),
  mine: z.preprocess((v) => v === true || v === "true" || v === "on" || v === "1", z.boolean()).default(false),
});

export async function listPurchaseRequests(ctx: AuthContext, raw: unknown = {}) {
  const f = parseInput(purchaseRequestFilters, raw);
  const where = and(
    eq(purchaseRequests.tenantId, ctx.tenantId),
    scopeWhere(ctx.scope("purchase.read"), purchaseRequests.companyId, purchaseRequests.siteId),
    f.status ? eq(purchaseRequests.status, f.status) : undefined,
    f.mine ? eq(purchaseRequests.requestedById, ctx.userId) : undefined,
  );
  if (!ctx.can("purchase.read")) return { items: [], total: 0, page: f.page, pageSize: f.pageSize };
  const [items, [{ total }]] = await Promise.all([
    db
      .select({
        id: purchaseRequests.id,
        number: purchaseRequests.number,
        description: purchaseRequests.description,
        quantity: purchaseRequests.quantity,
        amount: purchaseRequests.amount,
        status: purchaseRequests.status,
        createdAt: purchaseRequests.createdAt,
        neededBy: purchaseRequests.neededBy,
        companyName: companies.name,
        requester: user.name,
        workOrderId: purchaseRequests.workOrderId,
      })
      .from(purchaseRequests)
      .innerJoin(companies, eq(companies.id, purchaseRequests.companyId))
      .innerJoin(user, eq(user.id, purchaseRequests.requestedById))
      .where(where)
      .orderBy(desc(purchaseRequests.createdAt))
      .limit(f.pageSize)
      .offset(offsetOf(f)),
    db.select({ total: count() }).from(purchaseRequests).where(where),
  ]);
  return { items, total, page: f.page, pageSize: f.pageSize } satisfies Page<(typeof items)[number]>;
}

export async function getPurchaseRequest(ctx: AuthContext, id: string) {
  if (!z.uuid().safeParse(id).success) throw new NotFoundError("Demande d'achat");
  const [row] = await db
    .select({ request: purchaseRequests, companyName: companies.name, siteName: sites.name, requester: user.name })
    .from(purchaseRequests)
    .innerJoin(companies, eq(companies.id, purchaseRequests.companyId))
    .innerJoin(sites, eq(sites.id, purchaseRequests.siteId))
    .innerJoin(user, eq(user.id, purchaseRequests.requestedById))
    .where(and(eq(purchaseRequests.id, id), eq(purchaseRequests.tenantId, ctx.tenantId)));
  if (!row) throw new NotFoundError("Demande d'achat");
  const pr = row.request;
  // Le valideur d'une demande la consulte même sans le droit de lecture des achats (ex. direction hors périmètre).
  const approvals = await approvalTimeline(ctx, "PURCHASE_REQUEST", [pr.id]);
  const canRead = ctx.canOn("purchase.read", pr) || pr.requestedById === ctx.userId || approvals.some((a) => a.canDecide);
  if (!canRead) throw new NotFoundError("Demande d'achat");

  const [part, supplier, workOrder, eqRow, costCenter] = await Promise.all([
    pr.partId
      ? db
          .select({ sku: parts.sku, name: parts.name })
          .from(parts)
          .where(eq(parts.id, pr.partId))
          .then((r) => r[0] ?? null)
      : null,
    pr.supplierId
      ? db
          .select({ name: suppliers.name })
          .from(suppliers)
          .where(eq(suppliers.id, pr.supplierId))
          .then((r) => r[0] ?? null)
      : null,
    pr.workOrderId
      ? db
          .select({ id: workOrders.id, number: workOrders.number, title: workOrders.title })
          .from(workOrders)
          .where(eq(workOrders.id, pr.workOrderId))
          .then((r) => r[0] ?? null)
      : null,
    pr.equipmentId
      ? db
          .select({ id: equipment.id, code: equipment.code, name: equipment.name })
          .from(equipment)
          .where(eq(equipment.id, pr.equipmentId))
          .then((r) => r[0] ?? null)
      : null,
    pr.costCenterId
      ? db
          .select({ code: costCenters.code, name: costCenters.name })
          .from(costCenters)
          .where(eq(costCenters.id, pr.costCenterId))
          .then((r) => r[0] ?? null)
      : null,
  ]);
  return {
    ...pr,
    companyName: row.companyName,
    siteName: row.siteName,
    requester: row.requester,
    part,
    supplier,
    workOrder,
    equipment: eqRow,
    costCenter,
    approvals,
    canCancel: ["PENDING_APPROVAL", "APPROVED"].includes(pr.status) && (pr.requestedById === ctx.userId || ctx.canOn("purchase.create", pr)),
  };
}

export const cancelInput = z.object({ reason: text(500, "Le motif d'annulation est obligatoire") });

/** Annulation motivée par le demandeur ou un acheteur ; la validation en cours est close. */
export async function cancelPurchaseRequest(ctx: AuthContext, id: string, raw: unknown) {
  const input = parseInput(cancelInput, raw);
  const pr = await getPurchaseRequest(ctx, id);
  if (!pr.canCancel) {
    throw new BusinessRuleError([
      pr.status === "PENDING_APPROVAL" || pr.status === "APPROVED"
        ? "Seul le demandeur ou un acheteur peut annuler cette demande."
        : "Cette demande ne peut plus être annulée.",
    ]);
  }
  await db.transaction(async (tx) => {
    await tx.update(purchaseRequests).set({ status: "CANCELLED", cancellationReason: input.reason }).where(eq(purchaseRequests.id, id));
    await cancelPendingApproval(tx, ctx, "PURCHASE_REQUEST", id, input.reason);
    await audit(tx, ctx, { entityType: "purchase_request", entityId: id, action: "cancel", before: { status: pr.status }, after: input });
  });
}

/** Demandes d'achat d'un OT (ACH-01 : visibles depuis l'OT avec leur statut). */
export async function listPurchaseRequestsForWorkOrder(ctx: AuthContext, workOrderId: string) {
  if (!ctx.can("purchase.read")) return [];
  return db
    .select({
      id: purchaseRequests.id,
      number: purchaseRequests.number,
      description: purchaseRequests.description,
      amount: purchaseRequests.amount,
      status: purchaseRequests.status,
    })
    .from(purchaseRequests)
    .where(and(eq(purchaseRequests.tenantId, ctx.tenantId), eq(purchaseRequests.workOrderId, workOrderId)))
    .orderBy(desc(purchaseRequests.createdAt));
}

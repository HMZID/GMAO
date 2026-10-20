import { tpl } from "@/i18n/translate";
import "server-only";
import { aliasedTable, and, count, desc, eq, gt } from "drizzle-orm";
import { z } from "zod";
import type { AuthContext } from "@/server/authz/context";
import { db, type DbOrTx } from "@/server/db";
import { inventoryCounts, parts, sites, stockLevels, stockMovements, user, warehouses } from "@/server/db/schema";
import { expectedQuantityAt, inventoryCountStatus, type MovementType } from "@/server/domain/stock";
import { BusinessRuleError, NotFoundError } from "@/server/errors";
import { optionalDate, optionalText } from "@/server/validation";
import { assertCan, assertCanOn, assertVisible, audit, parseInput, scopeWhere } from "./_shared";
import { lockLevel, warehouseScope } from "./stock";

/* ------------------------------------------------------------------ */
/* Inventaires : comptage, écart « à valider », validation (STK-07)     */
/* ------------------------------------------------------------------ */

export const inventoryCountInput = z.object({
  partId: z.uuid("Article obligatoire"),
  warehouseId: z.uuid("Magasin obligatoire"),
  countedQuantity: z.coerce.number({ error: "Quantité comptée obligatoire" }).min(0, "La quantité comptée ne peut pas être négative"),
  /** Heure du comptage (par défaut : maintenant) ; les mouvements postérieurs restent à part (règle 8 de §7.5). */
  countedAt: optionalDate,
  comment: optionalText(500),
  clientId: z.string().trim().min(8).max(100).optional(),
});

type InventoryCount = typeof inventoryCounts.$inferSelect;

/**
 * Enregistre un comptage. L'écart est calculé sur le stock théorique à l'heure du comptage. Sous le seuil
 * en valeur (ou si l'auteur peut valider), il est appliqué par un ajustement valorisé au coût moyen pondéré ;
 * au-delà, il reste « à valider » et le stock ne change pas. Idempotent par `clientId`.
 */
export async function createInventoryCount(ctx: AuthContext, raw: unknown, now: Date = new Date()) {
  const input = parseInput(inventoryCountInput, raw);
  const countedAt = input.countedAt ?? now;
  if (countedAt.getTime() > now.getTime() + 60_000) throw new BusinessRuleError(["L'heure du comptage ne peut pas être dans le futur."]);
  return db.transaction(async (tx) => {
    if (input.clientId) {
      const [dup] = await tx
        .select()
        .from(inventoryCounts)
        .where(and(eq(inventoryCounts.tenantId, ctx.tenantId), eq(inventoryCounts.clientId, input.clientId)));
      if (dup) return dup;
    }
    const wh = await warehouseScope(tx, ctx, input.warehouseId);
    assertCanOn(ctx, "inventory.adjust", wh);
    const [part] = await tx
      .select()
      .from(parts)
      .where(and(eq(parts.id, input.partId), eq(parts.tenantId, ctx.tenantId)));
    if (!part) throw new NotFoundError("Article");
    const level = await lockLevel(tx, ctx, part.id, wh.id);
    const since = await tx
      .select({ type: stockMovements.type, quantity: stockMovements.quantity })
      .from(stockMovements)
      .where(and(eq(stockMovements.partId, part.id), eq(stockMovements.warehouseId, wh.id), gt(stockMovements.createdAt, countedAt)));
    const expected = expectedQuantityAt(
      level.onHand,
      since.map((m) => ({ type: m.type as MovementType, quantity: m.quantity })),
    );
    const difference = Math.round((input.countedQuantity - expected) * 1000) / 1000;
    const status = inventoryCountStatus({ difference, unitCost: part.averageCost, canValidate: ctx.canOn("inventory.validate", wh) });
    const [row] = await tx
      .insert(inventoryCounts)
      .values({
        tenantId: ctx.tenantId,
        partId: part.id,
        warehouseId: wh.id,
        countedQuantity: input.countedQuantity,
        expectedQuantity: expected,
        difference,
        unitCost: part.averageCost,
        countedAt,
        status: "PENDING",
        comment: input.comment ?? null,
        clientId: input.clientId ?? null,
        createdById: ctx.userId,
      })
      .returning();
    await audit(tx, ctx, { entityType: "inventory_count", entityId: row.id, action: "create", after: row });
    return status === "APPLIED" ? applyCount(tx, ctx, row, now) : row;
  });
}

export const inventoryDecisionInput = z
  .object({
    decision: z.enum(["APPROVE", "REJECT"]),
    comment: optionalText(500),
  })
  .refine((v) => v.decision === "APPROVE" || !!v.comment, { message: "Le motif du refus est obligatoire", path: ["comment"] });

/** Validation ou refus d'un écart « à valider » par le responsable habilité, jamais par la personne qui a compté. */
export async function decideInventoryCount(ctx: AuthContext, id: string, raw: unknown, now: Date = new Date()) {
  const input = parseInput(inventoryDecisionInput, raw);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(inventoryCounts)
      .where(and(eq(inventoryCounts.id, id), eq(inventoryCounts.tenantId, ctx.tenantId)))
      .for("update");
    if (!row) throw new NotFoundError("Comptage");
    const wh = await warehouseScope(tx, ctx, row.warehouseId);
    assertVisible(ctx, "stock.read", wh, "Comptage");
    assertCanOn(ctx, "inventory.validate", wh);
    const errors: string[] = [];
    if (row.status !== "PENDING") errors.push("Ce comptage a déjà été traité.");
    if (row.createdById === ctx.userId) errors.push("Le valideur doit être différent de la personne qui a compté (séparation des tâches).");
    if (errors.length > 0) throw new BusinessRuleError(errors);
    if (input.decision === "REJECT") {
      const [after] = await tx
        .update(inventoryCounts)
        .set({ status: "REJECTED", decisionComment: input.comment ?? null, decidedById: ctx.userId, decidedAt: now })
        .where(eq(inventoryCounts.id, row.id))
        .returning();
      await audit(tx, ctx, { entityType: "inventory_count", entityId: row.id, action: "reject", before: row, after });
      return after;
    }
    return applyCount(tx, ctx, { ...row, decisionComment: input.comment ?? null }, now);
  });
}

/** Application de l'écart : ajustement sur le stock actuel (ligne verrouillée), jamais de stock négatif. */
async function applyCount(tx: DbOrTx, ctx: AuthContext, row: InventoryCount, now: Date) {
  let adjustmentId: string | null = null;
  if (row.difference !== 0) {
    const level = await lockLevel(tx, ctx, row.partId, row.warehouseId);
    if (level.onHand + row.difference < 0) {
      throw new BusinessRuleError([tpl`Le stock physique ne peut pas devenir négatif (stock actuel ${level.onHand}, écart ${row.difference}).`]);
    }
    const [part] = await tx.select({ averageCost: parts.averageCost }).from(parts).where(eq(parts.id, row.partId));
    await tx
      .update(stockLevels)
      .set({ onHand: level.onHand + row.difference })
      .where(eq(stockLevels.id, level.id));
    const [mv] = await tx
      .insert(stockMovements)
      .values({
        tenantId: ctx.tenantId,
        partId: row.partId,
        warehouseId: row.warehouseId,
        type: "ADJUSTMENT",
        quantity: row.difference,
        unitCost: part?.averageCost ?? row.unitCost,
        reference: "Inventaire",
        reason: row.decisionComment ?? row.comment ?? "Écart d'inventaire",
        createdById: ctx.userId,
      })
      .returning();
    await audit(tx, ctx, { entityType: "stock_movement", entityId: mv.id, action: "create", after: mv });
    adjustmentId = mv.id;
  }
  const [after] = await tx
    .update(inventoryCounts)
    .set({ status: "APPLIED", adjustmentId, decisionComment: row.decisionComment, decidedById: ctx.userId, decidedAt: now })
    .where(eq(inventoryCounts.id, row.id))
    .returning();
  await audit(tx, ctx, { entityType: "inventory_count", entityId: row.id, action: "apply", after });
  return after;
}

const countedBy = aliasedTable(user, "counted_by");
const decidedBy = aliasedTable(user, "decided_by");

export async function listInventoryCounts(ctx: AuthContext, raw: unknown = {}) {
  assertCan(ctx, "stock.read");
  const f = parseInput(z.object({ status: z.enum(["PENDING", "APPLIED", "REJECTED"]).optional() }), raw);
  return db
    .select({
      id: inventoryCounts.id,
      status: inventoryCounts.status,
      countedQuantity: inventoryCounts.countedQuantity,
      expectedQuantity: inventoryCounts.expectedQuantity,
      difference: inventoryCounts.difference,
      unitCost: inventoryCounts.unitCost,
      countedAt: inventoryCounts.countedAt,
      comment: inventoryCounts.comment,
      decisionComment: inventoryCounts.decisionComment,
      decidedAt: inventoryCounts.decidedAt,
      createdById: inventoryCounts.createdById,
      partId: parts.id,
      sku: parts.sku,
      partName: parts.name,
      unit: parts.unit,
      warehouseId: warehouses.id,
      warehouseName: warehouses.name,
      companyId: sites.companyId,
      siteId: sites.id,
      countedByName: countedBy.name,
      decidedByName: decidedBy.name,
    })
    .from(inventoryCounts)
    .innerJoin(parts, eq(parts.id, inventoryCounts.partId))
    .innerJoin(warehouses, eq(warehouses.id, inventoryCounts.warehouseId))
    .innerJoin(sites, eq(sites.id, warehouses.siteId))
    .leftJoin(countedBy, eq(countedBy.id, inventoryCounts.createdById))
    .leftJoin(decidedBy, eq(decidedBy.id, inventoryCounts.decidedById))
    .where(
      and(
        eq(inventoryCounts.tenantId, ctx.tenantId),
        scopeWhere(ctx.scope("stock.read"), sites.companyId, sites.id),
        f.status ? eq(inventoryCounts.status, f.status) : undefined,
      ),
    )
    .orderBy(desc(inventoryCounts.createdAt))
    .limit(100);
}

/** Écarts « à valider » que l'utilisateur peut traiter (page Validations). */
export async function countPendingInventoryCounts(ctx: AuthContext) {
  if (!ctx.can("inventory.validate")) return 0;
  const [row] = await db
    .select({ n: count() })
    .from(inventoryCounts)
    .innerJoin(warehouses, eq(warehouses.id, inventoryCounts.warehouseId))
    .innerJoin(sites, eq(sites.id, warehouses.siteId))
    .where(
      and(
        eq(inventoryCounts.tenantId, ctx.tenantId),
        eq(inventoryCounts.status, "PENDING"),
        scopeWhere(ctx.scope("inventory.validate"), sites.companyId, sites.id),
      ),
    );
  return row?.n ?? 0;
}

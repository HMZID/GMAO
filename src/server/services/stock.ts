import "server-only";
import { and, asc, count, desc, eq, ilike, inArray, isNotNull, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { AuthContext } from "@/server/authz/context";
import { db, type DbOrTx } from "@/server/db";
import { parts, sites, stockLevels, stockMovements, stockReservations, suppliers, warehouses, workOrders } from "@/server/db/schema";
import { checkIssue, checkReservation, weightedAverageCost } from "@/server/domain/stock";
import { BusinessRuleError, ConflictError, NotFoundError } from "@/server/errors";
import { bool, clearable, optionalText, text } from "@/server/validation";
import { assertCan, assertCanOn, audit, offsetOf, paginationSchema, parseInput, scopeWhere } from "./_shared";
import { isUniqueViolation } from "./organization";

/* ------------------------------------------------------------------ */
/* Catalogue (STK-01)                                                   */
/* ------------------------------------------------------------------ */

export const partFilters = paginationSchema.extend({
  q: z.string().trim().max(100).optional(),
  family: z.string().trim().max(60).optional(),
  belowReorder: bool.default(false),
});

export async function listParts(ctx: AuthContext, raw: unknown = {}) {
  assertCan(ctx, "part.read");
  const f = parseInput(partFilters, raw);
  const scope = ctx.scope("stock.read");
  const stockScope = scopeWhere(scope, sites.companyId, sites.id) ?? sql`true`;
  const totals = db
    .select({
      partId: stockLevels.partId,
      onHand: sql<number>`coalesce(sum(${stockLevels.onHand}), 0)`.mapWith(Number).as("on_hand"),
      reserved: sql<number>`coalesce(sum(${stockLevels.reserved}), 0)`.mapWith(Number).as("reserved"),
      belowReorder:
        sql<boolean>`bool_or(${stockLevels.reorderPoint} is not null and ${stockLevels.onHand} - ${stockLevels.reserved} <= ${stockLevels.reorderPoint})`.as(
          "below_reorder",
        ),
    })
    .from(stockLevels)
    .innerJoin(warehouses, eq(warehouses.id, stockLevels.warehouseId))
    .innerJoin(sites, eq(sites.id, warehouses.siteId))
    .where(stockScope)
    .groupBy(stockLevels.partId)
    .as("totals");

  const where = and(
    eq(parts.tenantId, ctx.tenantId),
    eq(parts.active, true),
    f.q ? or(ilike(parts.sku, `%${f.q}%`), ilike(parts.name, `%${f.q}%`), ilike(parts.manufacturerRef, `%${f.q}%`)) : undefined,
    f.family ? eq(parts.family, f.family) : undefined,
    f.belowReorder ? eq(totals.belowReorder, true) : undefined,
  );
  const [items, [{ total }]] = await Promise.all([
    db
      .select({
        id: parts.id,
        sku: parts.sku,
        name: parts.name,
        family: parts.family,
        unit: parts.unit,
        manufacturer: parts.manufacturer,
        manufacturerRef: parts.manufacturerRef,
        criticality: parts.criticality,
        averageCost: parts.averageCost,
        onHand: totals.onHand,
        reserved: totals.reserved,
        belowReorder: totals.belowReorder,
      })
      .from(parts)
      .leftJoin(totals, eq(totals.partId, parts.id))
      .where(where)
      .orderBy(asc(parts.sku))
      .limit(f.pageSize)
      .offset(offsetOf(f)),
    db.select({ total: count() }).from(parts).leftJoin(totals, eq(totals.partId, parts.id)).where(where),
  ]);
  return { items, total, page: f.page, pageSize: f.pageSize };
}

export async function getPart(ctx: AuthContext, id: string) {
  assertCan(ctx, "part.read");
  const [part] = await db
    .select()
    .from(parts)
    .where(and(eq(parts.id, id), eq(parts.tenantId, ctx.tenantId)));
  if (!part) throw new NotFoundError("Article");
  const scope = scopeWhere(ctx.scope("stock.read"), sites.companyId, sites.id);
  const [levels, movements] = await Promise.all([
    db
      .select({
        id: stockLevels.id,
        warehouseId: warehouses.id,
        warehouseName: warehouses.name,
        siteName: sites.name,
        onHand: stockLevels.onHand,
        reserved: stockLevels.reserved,
        minQty: stockLevels.minQty,
        reorderPoint: stockLevels.reorderPoint,
        maxQty: stockLevels.maxQty,
      })
      .from(stockLevels)
      .innerJoin(warehouses, eq(warehouses.id, stockLevels.warehouseId))
      .innerJoin(sites, eq(sites.id, warehouses.siteId))
      .where(and(eq(stockLevels.partId, id), scope))
      .orderBy(asc(sites.name)),
    db
      .select({
        id: stockMovements.id,
        type: stockMovements.type,
        quantity: stockMovements.quantity,
        unitCost: stockMovements.unitCost,
        createdAt: stockMovements.createdAt,
        reason: stockMovements.reason,
        reference: stockMovements.reference,
        warehouseName: warehouses.name,
        workOrderId: stockMovements.workOrderId,
        workOrderNumber: workOrders.number,
      })
      .from(stockMovements)
      .innerJoin(warehouses, eq(warehouses.id, stockMovements.warehouseId))
      .innerJoin(sites, eq(sites.id, warehouses.siteId))
      .leftJoin(workOrders, eq(workOrders.id, stockMovements.workOrderId))
      .where(and(eq(stockMovements.partId, id), scope))
      .orderBy(desc(stockMovements.createdAt))
      .limit(30),
  ]);
  return { ...part, levels, movements };
}

export const partInput = z.object({
  sku: text(40, "Référence interne obligatoire").transform((s) => s.toUpperCase()),
  name: text(160, "Désignation obligatoire"),
  family: z.string().trim().max(60).optional(),
  unit: z.string().trim().min(1).max(10).default("u"),
  manufacturer: z.string().trim().max(80).optional(),
  manufacturerRef: z.string().trim().max(80).optional(),
  tracking: z.enum(["QUANTITY", "LOT", "SERIAL"]).default("QUANTITY"),
  isRepairable: bool.default(false),
  criticality: z.enum(["A", "B", "C"]).default("C"),
});

/** Contrôles de création d'un article, sans écriture (aussi utilisés par la simulation d'import, EQP-13). */
export async function checkPartCreation(ctx: AuthContext, raw: unknown) {
  assertCan(ctx, "part.write");
  const input = parseInput(partInput, raw);
  const [sameSku] = await db
    .select({ id: parts.id })
    .from(parts)
    .where(and(eq(parts.tenantId, ctx.tenantId), eq(parts.sku, input.sku)));
  if (sameSku) throw new ConflictError(`La référence interne ${input.sku} existe déjà.`, { existingId: sameSku.id });
  if (input.manufacturer && input.manufacturerRef) {
    const [dup] = await db
      .select({ id: parts.id, sku: parts.sku })
      .from(parts)
      .where(and(eq(parts.tenantId, ctx.tenantId), eq(parts.manufacturer, input.manufacturer), eq(parts.manufacturerRef, input.manufacturerRef)));
    if (dup) throw new ConflictError(`Doublon : l'article ${dup.sku} a déjà cette référence fabricant.`, { existingId: dup.id });
  }
  return input;
}

export async function createPart(ctx: AuthContext, raw: unknown) {
  const input = await checkPartCreation(ctx, raw);
  return db.transaction(async (tx) => {
    try {
      const [row] = await tx
        .insert(parts)
        .values({ ...input, tenantId: ctx.tenantId })
        .returning();
      await audit(tx, ctx, { entityType: "part", entityId: row.id, action: "create", after: row });
      return row;
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictError("Cette référence interne existe déjà.");
      throw error;
    }
  });
}

export const stockLevelSettingsInput = z
  .object({
    minQty: clearable(z.coerce.number().min(0, "Valeur positive attendue")),
    reorderPoint: clearable(z.coerce.number().min(0, "Valeur positive attendue")),
    maxQty: clearable(z.coerce.number().min(0, "Valeur positive attendue")),
  })
  .refine((v) => v.maxQty == null || v.reorderPoint == null || v.maxQty >= v.reorderPoint, {
    message: "Le maximum doit être supérieur ou égal au point de commande",
    path: ["maxQty"],
  });

/** Seuils de réapprovisionnement d'un article dans un magasin (STK-08). */
export async function updateStockLevelSettings(ctx: AuthContext, levelId: string, raw: unknown) {
  const input = parseInput(stockLevelSettingsInput, raw);
  return db.transaction(async (tx) => {
    const [level] = await tx
      .select({ level: stockLevels, siteId: warehouses.siteId, companyId: sites.companyId })
      .from(stockLevels)
      .innerJoin(warehouses, eq(warehouses.id, stockLevels.warehouseId))
      .innerJoin(sites, eq(sites.id, warehouses.siteId))
      .where(and(eq(stockLevels.id, levelId), eq(stockLevels.tenantId, ctx.tenantId)));
    if (!level) throw new NotFoundError("Niveau de stock");
    assertCanOn(ctx, "part.write", level);
    const [row] = await tx.update(stockLevels).set(input).where(eq(stockLevels.id, levelId)).returning();
    await audit(tx, ctx, { entityType: "stock_level", entityId: levelId, action: "settings", before: level.level, after: input });
    return row;
  });
}

/* ------------------------------------------------------------------ */
/* Niveaux de stock                                                     */
/* ------------------------------------------------------------------ */

async function warehouseScope(tx: DbOrTx, ctx: AuthContext, warehouseId: string) {
  const [row] = await tx
    .select({ id: warehouses.id, siteId: warehouses.siteId, companyId: sites.companyId, name: warehouses.name })
    .from(warehouses)
    .innerJoin(sites, eq(sites.id, warehouses.siteId))
    .where(and(eq(warehouses.id, warehouseId), eq(warehouses.tenantId, ctx.tenantId)));
  if (!row) throw new NotFoundError("Magasin");
  return row;
}

/** Ligne de stock verrouillée pour la durée de la transaction (règle 9 de §7.5). */
async function lockLevel(tx: DbOrTx, ctx: AuthContext, partId: string, warehouseId: string) {
  await tx
    .insert(stockLevels)
    .values({ tenantId: ctx.tenantId, partId, warehouseId })
    .onConflictDoNothing({ target: [stockLevels.partId, stockLevels.warehouseId] });
  const [level] = await tx
    .select()
    .from(stockLevels)
    .where(and(eq(stockLevels.partId, partId), eq(stockLevels.warehouseId, warehouseId)))
    .for("update");
  return level;
}

export async function listStockLevels(ctx: AuthContext, raw: unknown = {}) {
  assertCan(ctx, "stock.read");
  const f = parseInput(z.object({ warehouseId: z.uuid().optional(), belowReorder: bool.default(false) }), raw);
  return db
    .select({
      id: stockLevels.id,
      partId: parts.id,
      sku: parts.sku,
      partName: parts.name,
      unit: parts.unit,
      warehouseId: warehouses.id,
      warehouseName: warehouses.name,
      siteName: sites.name,
      onHand: stockLevels.onHand,
      reserved: stockLevels.reserved,
      reorderPoint: stockLevels.reorderPoint,
      maxQty: stockLevels.maxQty,
      averageCost: parts.averageCost,
    })
    .from(stockLevels)
    .innerJoin(parts, eq(parts.id, stockLevels.partId))
    .innerJoin(warehouses, eq(warehouses.id, stockLevels.warehouseId))
    .innerJoin(sites, eq(sites.id, warehouses.siteId))
    .where(
      and(
        eq(stockLevels.tenantId, ctx.tenantId),
        scopeWhere(ctx.scope("stock.read"), sites.companyId, sites.id),
        f.warehouseId ? eq(stockLevels.warehouseId, f.warehouseId) : undefined,
        f.belowReorder
          ? and(isNotNull(stockLevels.reorderPoint), lte(sql`${stockLevels.onHand} - ${stockLevels.reserved}`, stockLevels.reorderPoint))
          : undefined,
      ),
    )
    .orderBy(asc(warehouses.name), asc(parts.sku));
}

export async function countBelowReorder(ctx: AuthContext) {
  if (!ctx.can("stock.read")) return 0;
  const rows = await listStockLevels(ctx, { belowReorder: true });
  return rows.length;
}

/* ------------------------------------------------------------------ */
/* Mouvements (STK-04, STK-14)                                          */
/* ------------------------------------------------------------------ */

export const movementInput = z
  .object({
    type: z.enum(["RECEIPT", "ADJUSTMENT", "SCRAP", "TRANSFER"]),
    partId: z.uuid("Article obligatoire"),
    warehouseId: z.uuid("Magasin obligatoire"),
    /** Positive ; pour un ajustement d'inventaire, l'écart signé (ex. −3). */
    quantity: z.coerce.number({ error: "Quantité obligatoire" }).refine((n) => n !== 0, "Quantité non nulle"),
    unitCost: z.coerce.number().min(0).optional(),
    targetWarehouseId: z.uuid().optional(),
    supplierId: z.uuid().optional(),
    reference: z.string().trim().max(80).optional(),
    reason: optionalText(500),
    clientId: z.string().trim().min(8).max(100).optional(),
  })
  .refine((v) => v.type !== "TRANSFER" || !!v.targetWarehouseId, { message: "Magasin de destination obligatoire", path: ["targetWarehouseId"] })
  .refine((v) => v.type === "ADJUSTMENT" || v.quantity > 0, { message: "La quantité doit être positive", path: ["quantity"] })
  .refine((v) => v.type !== "ADJUSTMENT" || !!v.reason, { message: "Le motif est obligatoire", path: ["reason"] })
  .refine((v) => v.type !== "SCRAP" || !!v.reason, { message: "Le motif est obligatoire", path: ["reason"] });

/** Seuil d'écart d'inventaire au-delà duquel une validation est requise, en valeur (STK-07) [AC]. */
export const ADJUSTMENT_VALIDATION_THRESHOLD = 100;

/**
 * Mouvements manuels : réception, ajustement d'inventaire, mise au rebut, transfert.
 * Idempotent par clientId ; stock physique jamais négatif ; ligne verrouillée pendant la mise à jour.
 */
export async function createMovement(ctx: AuthContext, raw: unknown) {
  const input = parseInput(movementInput, raw);
  return db.transaction(async (tx) => {
    if (input.clientId) {
      const [dup] = await tx
        .select()
        .from(stockMovements)
        .where(and(eq(stockMovements.tenantId, ctx.tenantId), eq(stockMovements.clientId, input.clientId)));
      if (dup) return dup;
    }
    const wh = await warehouseScope(tx, ctx, input.warehouseId);
    assertCanOn(ctx, input.type === "ADJUSTMENT" ? "inventory.adjust" : "stock.move", wh);
    const [part] = await tx
      .select()
      .from(parts)
      .where(and(eq(parts.id, input.partId), eq(parts.tenantId, ctx.tenantId)));
    if (!part) throw new NotFoundError("Article");
    const level = await lockLevel(tx, ctx, part.id, wh.id);

    const base = {
      tenantId: ctx.tenantId,
      partId: part.id,
      warehouseId: wh.id,
      reference: input.reference ?? null,
      reason: input.reason ?? null,
      clientId: input.clientId ?? null,
      createdById: ctx.userId,
    };

    if (input.type === "RECEIPT") {
      // Fournisseur de la réception porté dans la référence (TODO ACH-03 : réception sur commande d'achat)
      if (input.supplierId) {
        const [supplier] = await tx
          .select({ name: suppliers.name })
          .from(suppliers)
          .where(and(eq(suppliers.id, input.supplierId), eq(suppliers.tenantId, ctx.tenantId)));
        if (!supplier) throw new NotFoundError("Fournisseur");
        base.reference = [supplier.name, input.reference].filter(Boolean).join(" — ");
      }
      const unitCost = input.unitCost ?? part.averageCost;
      const newAverage = weightedAverageCost(level.onHand, part.averageCost, input.quantity, unitCost);
      await tx
        .update(stockLevels)
        .set({ onHand: sql`${stockLevels.onHand} + ${input.quantity}` })
        .where(eq(stockLevels.id, level.id));
      await tx.update(parts).set({ averageCost: newAverage }).where(eq(parts.id, part.id));
      const [mv] = await tx
        .insert(stockMovements)
        .values({ ...base, type: "RECEIPT", quantity: input.quantity, unitCost })
        .returning();
      await audit(tx, ctx, { entityType: "stock_movement", entityId: mv.id, action: "create", after: mv });
      return mv;
    }

    if (input.type === "ADJUSTMENT") {
      if (level.onHand + input.quantity < 0) throw new BusinessRuleError(["Le stock physique ne peut pas devenir négatif."]);
      const value = Math.abs(input.quantity) * part.averageCost;
      if (value > ADJUSTMENT_VALIDATION_THRESHOLD && !ctx.canOn("inventory.validate", wh)) {
        // TODO(STK-07) : laisser l'écart « à valider » au lieu de le refuser (circuit HAB-04).
        throw new BusinessRuleError([`Écart de ${value.toFixed(2)} au-delà du seuil : validation du responsable maintenance requise.`]);
      }
      await tx
        .update(stockLevels)
        .set({ onHand: sql`${stockLevels.onHand} + ${input.quantity}` })
        .where(eq(stockLevels.id, level.id));
      const [mv] = await tx
        .insert(stockMovements)
        .values({ ...base, type: "ADJUSTMENT", quantity: input.quantity, unitCost: part.averageCost })
        .returning();
      await audit(tx, ctx, { entityType: "stock_movement", entityId: mv.id, action: "create", after: mv });
      return mv;
    }

    // SCRAP et TRANSFER retirent du stock disponible
    const free = level.onHand - level.reserved;
    if (input.quantity > free) throw new BusinessRuleError([`Seulement ${free} disponible(s) dans ${wh.name}.`]);
    await tx
      .update(stockLevels)
      .set({ onHand: sql`${stockLevels.onHand} - ${input.quantity}` })
      .where(eq(stockLevels.id, level.id));

    if (input.type === "SCRAP") {
      const [mv] = await tx
        .insert(stockMovements)
        .values({ ...base, type: "SCRAP", quantity: input.quantity, unitCost: part.averageCost })
        .returning();
      await audit(tx, ctx, { entityType: "stock_movement", entityId: mv.id, action: "create", after: mv });
      return mv;
    }

    // TRANSFER — TODO(STK-06) : gérer le transit en deux temps (expédition puis réception).
    const target = await warehouseScope(tx, ctx, input.targetWarehouseId!);
    if (target.id === wh.id) throw new BusinessRuleError(["Le magasin de destination doit être différent."]);
    const targetLevel = await lockLevel(tx, ctx, part.id, target.id);
    await tx
      .update(stockLevels)
      .set({ onHand: sql`${stockLevels.onHand} + ${input.quantity}` })
      .where(eq(stockLevels.id, targetLevel.id));
    const [out] = await tx
      .insert(stockMovements)
      .values({ ...base, type: "TRANSFER_OUT", quantity: input.quantity, unitCost: part.averageCost, counterpartWarehouseId: target.id })
      .returning();
    await tx.insert(stockMovements).values({
      ...base,
      clientId: null,
      warehouseId: target.id,
      type: "TRANSFER_IN",
      quantity: input.quantity,
      unitCost: part.averageCost,
      counterpartWarehouseId: wh.id,
    });
    await audit(tx, ctx, { entityType: "stock_movement", entityId: out.id, action: "transfer", after: { ...out, to: target.id } });
    return out;
  });
}

export async function listMovements(ctx: AuthContext, raw: unknown = {}) {
  assertCan(ctx, "stock.read");
  const f = parseInput(paginationSchema.extend({ warehouseId: z.uuid().optional(), partId: z.uuid().optional() }), raw);
  return db
    .select({
      id: stockMovements.id,
      type: stockMovements.type,
      quantity: stockMovements.quantity,
      unitCost: stockMovements.unitCost,
      createdAt: stockMovements.createdAt,
      reason: stockMovements.reason,
      reference: stockMovements.reference,
      partId: parts.id,
      sku: parts.sku,
      partName: parts.name,
      unit: parts.unit,
      warehouseName: warehouses.name,
      workOrderId: workOrders.id,
      workOrderNumber: workOrders.number,
    })
    .from(stockMovements)
    .innerJoin(parts, eq(parts.id, stockMovements.partId))
    .innerJoin(warehouses, eq(warehouses.id, stockMovements.warehouseId))
    .innerJoin(sites, eq(sites.id, warehouses.siteId))
    .leftJoin(workOrders, eq(workOrders.id, stockMovements.workOrderId))
    .where(
      and(
        eq(stockMovements.tenantId, ctx.tenantId),
        scopeWhere(ctx.scope("stock.read"), sites.companyId, sites.id),
        f.warehouseId ? eq(stockMovements.warehouseId, f.warehouseId) : undefined,
        f.partId ? eq(stockMovements.partId, f.partId) : undefined,
      ),
    )
    .orderBy(desc(stockMovements.createdAt))
    .limit(f.pageSize)
    .offset(offsetOf(f));
}

/* ------------------------------------------------------------------ */
/* Pièces sur OT : réservation, sortie, retour (STK-05, COR-10)        */
/* ------------------------------------------------------------------ */

export async function reserveForWorkOrder(
  tx: DbOrTx,
  ctx: AuthContext,
  input: { workOrderId: string; partId: string; warehouseId: string; quantity: number },
) {
  const level = await lockLevel(tx, ctx, input.partId, input.warehouseId);
  const errors = checkReservation(level.onHand, level.reserved, input.quantity);
  if (errors.length) throw new BusinessRuleError(errors);
  await tx
    .update(stockLevels)
    .set({ reserved: sql`${stockLevels.reserved} + ${input.quantity}` })
    .where(eq(stockLevels.id, level.id));
  const [row] = await tx
    .insert(stockReservations)
    .values({ tenantId: ctx.tenantId, ...input })
    .returning();
  return row;
}

/** Libère les réservations actives d'un OT (annulation, clôture). */
export async function releaseReservations(tx: DbOrTx, workOrderId: string) {
  const active = await tx
    .select()
    .from(stockReservations)
    .where(and(eq(stockReservations.workOrderId, workOrderId), eq(stockReservations.status, "ACTIVE")));
  for (const r of active) {
    const remaining = r.quantity - r.consumedQuantity;
    if (remaining > 0) {
      await tx
        .update(stockLevels)
        .set({ reserved: sql`greatest(${stockLevels.reserved} - ${remaining}, 0)` })
        .where(and(eq(stockLevels.partId, r.partId), eq(stockLevels.warehouseId, r.warehouseId)));
    }
    await tx.update(stockReservations).set({ status: "RELEASED" }).where(eq(stockReservations.id, r.id));
  }
  return active.length;
}

/**
 * Sortie de pièces sur un OT : consomme d'abord la réservation de l'OT, puis le disponible.
 * Coût imputé au coût moyen pondéré du moment (KPI-01).
 */
export async function issueToWorkOrder(
  tx: DbOrTx,
  ctx: AuthContext,
  input: { workOrderId: string; partId: string; warehouseId: string; quantity: number; clientId?: string | null },
) {
  if (input.clientId) {
    const [dup] = await tx
      .select()
      .from(stockMovements)
      .where(and(eq(stockMovements.tenantId, ctx.tenantId), eq(stockMovements.clientId, input.clientId)));
    if (dup) return dup;
  }
  const [part] = await tx
    .select()
    .from(parts)
    .where(and(eq(parts.id, input.partId), eq(parts.tenantId, ctx.tenantId)));
  if (!part) throw new NotFoundError("Article");
  const level = await lockLevel(tx, ctx, input.partId, input.warehouseId);
  const reservations = await tx
    .select()
    .from(stockReservations)
    .where(
      and(
        eq(stockReservations.workOrderId, input.workOrderId),
        eq(stockReservations.partId, input.partId),
        eq(stockReservations.warehouseId, input.warehouseId),
        eq(stockReservations.status, "ACTIVE"),
      ),
    );
  const reservedForWorkOrder = reservations.reduce((s, r) => s + r.quantity - r.consumedQuantity, 0);
  const errors = checkIssue({ onHand: level.onHand, reserved: level.reserved, reservedForWorkOrder, quantity: input.quantity });
  if (errors.length) throw new BusinessRuleError(errors);

  // Consommation des réservations de l'OT
  let toConsume = Math.min(input.quantity, reservedForWorkOrder);
  const consumedFromReservations = toConsume;
  for (const r of reservations) {
    if (toConsume <= 0) break;
    const take = Math.min(r.quantity - r.consumedQuantity, toConsume);
    const consumed = r.consumedQuantity + take;
    await tx
      .update(stockReservations)
      .set({ consumedQuantity: consumed, status: consumed >= r.quantity ? "CONSUMED" : "ACTIVE" })
      .where(eq(stockReservations.id, r.id));
    toConsume -= take;
  }
  await tx
    .update(stockLevels)
    .set({
      onHand: sql`${stockLevels.onHand} - ${input.quantity}`,
      reserved: sql`greatest(${stockLevels.reserved} - ${consumedFromReservations}, 0)`,
    })
    .where(eq(stockLevels.id, level.id));
  const [mv] = await tx
    .insert(stockMovements)
    .values({
      tenantId: ctx.tenantId,
      partId: input.partId,
      warehouseId: input.warehouseId,
      type: "ISSUE",
      quantity: input.quantity,
      unitCost: part.averageCost,
      workOrderId: input.workOrderId,
      clientId: input.clientId ?? null,
      createdById: ctx.userId,
    })
    .returning();
  await audit(tx, ctx, { entityType: "stock_movement", entityId: mv.id, action: "issue", after: mv });
  return mv;
}

/** Retour en stock d'une pièce sortie sur l'OT (annule l'imputation à due concurrence). */
export async function returnFromWorkOrder(
  tx: DbOrTx,
  ctx: AuthContext,
  input: { workOrderId: string; partId: string; warehouseId: string; quantity: number },
) {
  const [net] = await tx
    .select({
      issued:
        sql<number>`coalesce(sum(case when ${stockMovements.type} = 'ISSUE' then ${stockMovements.quantity} when ${stockMovements.type} = 'RETURN' then -${stockMovements.quantity} else 0 end), 0)`.mapWith(
          Number,
        ),
      unitCost: sql<number>`coalesce(max(${stockMovements.unitCost}), 0)`.mapWith(Number),
    })
    .from(stockMovements)
    .where(
      and(
        eq(stockMovements.workOrderId, input.workOrderId),
        eq(stockMovements.partId, input.partId),
        eq(stockMovements.warehouseId, input.warehouseId),
      ),
    );
  if (!(input.quantity > 0) || input.quantity > (net?.issued ?? 0)) {
    throw new BusinessRuleError([`Retour impossible : ${net?.issued ?? 0} sortie(s) nette(s) sur cet OT.`]);
  }
  const level = await lockLevel(tx, ctx, input.partId, input.warehouseId);
  await tx
    .update(stockLevels)
    .set({ onHand: sql`${stockLevels.onHand} + ${input.quantity}` })
    .where(eq(stockLevels.id, level.id));
  const [mv] = await tx
    .insert(stockMovements)
    .values({
      tenantId: ctx.tenantId,
      partId: input.partId,
      warehouseId: input.warehouseId,
      type: "RETURN",
      quantity: input.quantity,
      unitCost: net.unitCost,
      workOrderId: input.workOrderId,
      createdById: ctx.userId,
    })
    .returning();
  await audit(tx, ctx, { entityType: "stock_movement", entityId: mv.id, action: "return", after: mv });
  return mv;
}

/* ------------------------------------------------------------------ */
/* Fournisseurs et prestataires (CDC §8)                               */
/* ------------------------------------------------------------------ */

export async function listSuppliers(ctx: AuthContext) {
  assertCan(ctx, "supplier.read");
  return db
    .select({
      id: suppliers.id,
      name: suppliers.name,
      taxId: suppliers.taxId,
      email: suppliers.email,
      phone: suppliers.phone,
      isContractor: suppliers.isContractor,
      active: suppliers.active,
      workOrderCount: sql<number>`(select count(*) from work_orders wo where wo.supplier_id = "suppliers"."id")`.mapWith(Number),
    })
    .from(suppliers)
    .where(eq(suppliers.tenantId, ctx.tenantId))
    .orderBy(asc(suppliers.name));
}

export const supplierInput = z.object({
  name: text(160, "Raison sociale obligatoire"),
  taxId: z.string().trim().max(40).optional(),
  email: z.email("Courriel invalide").optional(),
  phone: z.string().trim().max(30).optional(),
  address: optionalText(300),
  isContractor: bool.default(false),
});

export async function createSupplier(ctx: AuthContext, raw: unknown) {
  assertCan(ctx, "supplier.write");
  const input = parseInput(supplierInput, raw);
  return db.transaction(async (tx) => {
    try {
      const [row] = await tx
        .insert(suppliers)
        .values({ ...input, tenantId: ctx.tenantId })
        .returning();
      await audit(tx, ctx, { entityType: "supplier", entityId: row.id, action: "create", after: row });
      return row;
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictError("Un fournisseur porte déjà cet identifiant fiscal (DON-12).");
      throw error;
    }
  });
}

/** Liste courte pour les sélecteurs (prestataire d'un OT, fournisseur d'une réception). */
export async function listSupplierOptions(ctx: AuthContext) {
  return db
    .select({ id: suppliers.id, name: suppliers.name, isContractor: suppliers.isContractor })
    .from(suppliers)
    .where(and(eq(suppliers.tenantId, ctx.tenantId), eq(suppliers.active, true)))
    .orderBy(asc(suppliers.name));
}

export async function listPartOptions(ctx: AuthContext) {
  return db
    .select({ id: parts.id, sku: parts.sku, name: parts.name, unit: parts.unit })
    .from(parts)
    .where(and(eq(parts.tenantId, ctx.tenantId), eq(parts.active, true)))
    .orderBy(asc(parts.sku))
    .limit(2000);
}

export async function listPartFamilies(ctx: AuthContext) {
  const rows = await db
    .selectDistinct({ family: parts.family })
    .from(parts)
    .where(and(eq(parts.tenantId, ctx.tenantId), isNotNull(parts.family)))
    .orderBy(asc(parts.family));
  return rows.map((r) => r.family as string);
}

export async function workOrderPartLines(tx: DbOrTx, workOrderIds: string[]) {
  if (workOrderIds.length === 0) return [];
  return tx
    .select()
    .from(stockMovements)
    .where(and(inArray(stockMovements.workOrderId, workOrderIds), inArray(stockMovements.type, ["ISSUE", "RETURN"])));
}

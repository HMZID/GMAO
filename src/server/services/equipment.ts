import "server-only";
import { randomBytes } from "node:crypto";
import { and, asc, count, desc, eq, gt, ilike, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { AuthContext } from "@/server/authz/context";
import { db } from "@/server/db";
import {
  assignments,
  companies,
  dueItems,
  equipment,
  equipmentCategories,
  equipmentModels,
  equipmentStatusHistory,
  jobsites,
  maintenancePlans,
  meters,
  planOperations,
  sites,
  workOrders,
  workRequests,
  workshops,
} from "@/server/db/schema";
import { OPEN_STATUSES } from "@/server/domain/work-order-status";
import { BusinessRuleError, ConflictError, NotFoundError } from "@/server/errors";
import { bool, clearable, date, optionalDate, optionalId, optionalNumber, optionalText, text } from "@/server/validation";
import { assertCan, assertCanOn, audit, offsetOf, paginationSchema, parseInput, scopeWhere, type Page } from "./_shared";
import { getActiveAssignment, setEquipmentStatus } from "./equipment-status";
import { createMeter } from "./meters";
import { isUniqueViolation } from "./organization";
import { applyMatchingPlans } from "./preventive";

/* ------------------------------------------------------------------ */
/* Liste et fiche                                                       */
/* ------------------------------------------------------------------ */

const STATUSES = ["AVAILABLE", "IN_SERVICE", "IN_MAINTENANCE", "IMMOBILIZED", "RETIRED"] as const;

export const equipmentFilters = paginationSchema.extend({
  q: z.string().trim().max(100).optional(),
  companyId: z.uuid().optional(),
  siteId: z.uuid().optional(),
  categoryId: z.uuid().optional(),
  status: z.enum(STATUSES).optional(),
  criticality: z.enum(["A", "B", "C"]).optional(),
  includeRetired: bool.default(false),
});

export async function listEquipment(ctx: AuthContext, raw: unknown = {}) {
  assertCan(ctx, "equipment.read");
  const f = parseInput(equipmentFilters, raw);
  const where = and(
    eq(equipment.tenantId, ctx.tenantId),
    scopeWhere(ctx.scope("equipment.read"), equipment.companyId, equipment.siteId),
    f.q
      ? or(
          ilike(equipment.code, `%${f.q}%`),
          ilike(equipment.name, `%${f.q}%`),
          ilike(equipment.serialNumber, `%${f.q}%`),
          ilike(equipment.registration, `%${f.q}%`),
        )
      : undefined,
    f.companyId ? eq(equipment.companyId, f.companyId) : undefined,
    f.siteId ? eq(equipment.siteId, f.siteId) : undefined,
    f.categoryId ? eq(equipment.categoryId, f.categoryId) : undefined,
    f.status ? eq(equipment.status, f.status) : f.includeRetired ? undefined : ne(equipment.status, "RETIRED"),
    f.criticality ? eq(equipment.criticality, f.criticality) : undefined,
  );

  const [items, [{ total }]] = await Promise.all([
    db
      .select({
        id: equipment.id,
        code: equipment.code,
        name: equipment.name,
        manufacturer: equipment.manufacturer,
        modelName: equipmentModels.name,
        serialNumber: equipment.serialNumber,
        registration: equipment.registration,
        status: equipment.status,
        criticality: equipment.criticality,
        categoryName: equipmentCategories.name,
        siteName: sites.name,
        companyName: companies.name,
        primaryMeterValue: meters.lastValue,
        primaryMeterUnit: meters.unit,
      })
      .from(equipment)
      .innerJoin(equipmentCategories, eq(equipmentCategories.id, equipment.categoryId))
      .innerJoin(sites, eq(sites.id, equipment.siteId))
      .innerJoin(companies, eq(companies.id, equipment.companyId))
      .leftJoin(equipmentModels, eq(equipmentModels.id, equipment.modelId))
      .leftJoin(meters, and(eq(meters.equipmentId, equipment.id), eq(meters.isPrimary, true)))
      .where(where)
      .orderBy(asc(equipment.code))
      .limit(f.pageSize)
      .offset(offsetOf(f)),
    db.select({ total: count() }).from(equipment).where(where),
  ]);
  return { items, total, page: f.page, pageSize: f.pageSize } satisfies Page<(typeof items)[number]>;
}

export async function getEquipment(ctx: AuthContext, id: string) {
  const eqRow = await db.query.equipment.findFirst({
    where: and(eq(equipment.id, id), eq(equipment.tenantId, ctx.tenantId)),
    with: {
      company: { columns: { id: true, name: true, code: true } },
      site: { columns: { id: true, name: true, code: true } },
      category: true,
      model: true,
      meters: { orderBy: desc(meters.isPrimary) },
      statusHistory: { orderBy: desc(equipmentStatusHistory.changedAt), limit: 10, with: { changedBy: { columns: { name: true } } } },
      assignments: {
        orderBy: desc(assignments.startAt),
        limit: 10,
        with: {
          site: { columns: { name: true } },
          jobsite: { columns: { name: true } },
          workshop: { columns: { name: true } },
        },
      },
    },
  });
  if (!eqRow) throw new NotFoundError("Équipement");
  assertCanOn(ctx, "equipment.read", eqRow);

  const [due, recentWorkOrders, openRequests, plans] = await Promise.all([
    db
      .select({
        id: dueItems.id,
        status: dueItems.status,
        dueDate: dueItems.dueDate,
        dueMeterValue: dueItems.dueMeterValue,
        projectedDate: dueItems.projectedDate,
        workOrderId: dueItems.workOrderId,
        operationName: planOperations.name,
        operationCode: planOperations.code,
        isRegulatory: planOperations.isRegulatory,
      })
      .from(dueItems)
      .innerJoin(planOperations, eq(planOperations.id, dueItems.operationId))
      .where(and(eq(dueItems.equipmentId, id), inArray(dueItems.status, ["UPCOMING", "PRE_ALERT", "DUE", "OVERDUE"])))
      .orderBy(asc(dueItems.projectedDate)),
    db
      .select({
        id: workOrders.id,
        number: workOrders.number,
        title: workOrders.title,
        type: workOrders.type,
        status: workOrders.status,
        priority: workOrders.priority,
        createdAt: workOrders.createdAt,
      })
      .from(workOrders)
      .where(eq(workOrders.equipmentId, id))
      .orderBy(desc(workOrders.createdAt))
      .limit(15),
    db
      .select({
        id: workRequests.id,
        number: workRequests.number,
        symptom: workRequests.symptom,
        status: workRequests.status,
        reportedAt: workRequests.reportedAt,
      })
      .from(workRequests)
      .where(and(eq(workRequests.equipmentId, id), inArray(workRequests.status, ["NEW", "QUALIFIED"])))
      .orderBy(desc(workRequests.reportedAt)),
    db
      .select({ id: maintenancePlans.id, name: maintenancePlans.name })
      .from(maintenancePlans)
      .where(and(eq(maintenancePlans.tenantId, ctx.tenantId), eq(maintenancePlans.active, true)))
      .orderBy(asc(maintenancePlans.name)),
  ]);

  const activeAssignment = await getActiveAssignment(db, id);
  return { ...eqRow, dueItems: due, recentWorkOrders, openRequests, availablePlans: plans, activeAssignmentId: activeAssignment?.id ?? null };
}

/** Résolution du QR code d'une étiquette (EQP-09). */
export async function findEquipmentByQrToken(ctx: AuthContext, token: string) {
  const [row] = await db
    .select({ id: equipment.id, companyId: equipment.companyId, siteId: equipment.siteId })
    .from(equipment)
    .where(and(eq(equipment.qrToken, token), eq(equipment.tenantId, ctx.tenantId)));
  if (!row) throw new NotFoundError("Équipement");
  assertCanOn(ctx, "equipment.read", row);
  return row;
}

/* ------------------------------------------------------------------ */
/* Création et modification                                            */
/* ------------------------------------------------------------------ */

export const equipmentInput = z.object({
  companyId: z.uuid("Société obligatoire"),
  siteId: z.uuid("Site obligatoire"),
  categoryId: z.uuid("Catégorie obligatoire"),
  modelId: optionalId,
  code: text(40, "Code parc obligatoire").transform((s) => s.toUpperCase()),
  name: text(160, "Désignation obligatoire"),
  manufacturer: text(80, "Marque obligatoire"),
  serialNumber: text(80, "Numéro de série obligatoire"),
  registration: z.string().trim().max(30).optional(),
  year: z.coerce.number().int().min(1950).max(2100).optional(),
  criticality: z.enum(["A", "B", "C"]).optional(),
  acquisitionMode: z.enum(["PURCHASE", "LEASE", "LONG_TERM_RENTAL", "SHORT_TERM_RENTAL"]).default("PURCHASE"),
  acquisitionDate: optionalDate,
  acquisitionValue: optionalNumber,
  commissioningDate: date("Date de mise en service obligatoire"),
  warrantyEndDate: optionalDate,
  warrantyEndMeter: optionalNumber,
  notes: optionalText(),
  primaryMeterType: z.enum(["HOURS", "KM", "CYCLES", "OTHER"]).optional(),
  primaryMeterValue: optionalNumber,
});

const METER_DEFAULTS = {
  HOURS: { label: "Heures moteur", unit: "h" },
  KM: { label: "Kilométrage", unit: "km" },
  CYCLES: { label: "Cycles", unit: "cycles" },
  OTHER: { label: "Compteur", unit: "u" },
} as const;

async function assertNoDuplicate(ctx: AuthContext, input: { manufacturer: string; serialNumber?: string; registration?: string }, exceptId?: string) {
  if (input.serialNumber) {
    const [dup] = await db
      .select({ id: equipment.id, code: equipment.code })
      .from(equipment)
      .where(
        and(
          eq(equipment.tenantId, ctx.tenantId),
          ilike(equipment.manufacturer, input.manufacturer),
          eq(equipment.serialNumber, input.serialNumber),
          exceptId ? ne(equipment.id, exceptId) : undefined,
        ),
      );
    if (dup) throw new ConflictError(`Doublon : ${dup.code} a déjà cette marque et ce numéro de série.`, { existingId: dup.id });
  }
  if (input.registration) {
    const [dup] = await db
      .select({ id: equipment.id, code: equipment.code })
      .from(equipment)
      .where(
        and(
          eq(equipment.tenantId, ctx.tenantId),
          eq(equipment.registration, input.registration.toUpperCase()),
          ne(equipment.status, "RETIRED"),
          exceptId ? ne(equipment.id, exceptId) : undefined,
        ),
      );
    if (dup) throw new ConflictError(`Doublon : l'immatriculation est déjà portée par ${dup.code}.`, { existingId: dup.id });
  }
}

async function assertSiteBelongsToCompany(ctx: AuthContext, siteId: string, companyId: string) {
  const [site] = await db
    .select({ companyId: sites.companyId })
    .from(sites)
    .where(and(eq(sites.id, siteId), eq(sites.tenantId, ctx.tenantId)));
  if (!site) throw new NotFoundError("Site");
  if (site.companyId !== companyId) throw new BusinessRuleError(["Le site de rattachement doit appartenir à la société propriétaire."]);
}

/**
 * Contrôles de création d'un équipement, sans écriture : saisie, droits, site de la société, doublons
 * (code parc, marque + numéro de série, immatriculation), catégorie. Utilisé aussi par la simulation d'import (EQP-13).
 */
export async function checkEquipmentCreation(ctx: AuthContext, raw: unknown) {
  const input = parseInput(equipmentInput, raw);
  assertCanOn(ctx, "equipment.write", input);
  await assertSiteBelongsToCompany(ctx, input.siteId, input.companyId);
  const [sameCode] = await db
    .select({ id: equipment.id })
    .from(equipment)
    .where(and(eq(equipment.tenantId, ctx.tenantId), eq(equipment.code, input.code)));
  if (sameCode) throw new ConflictError(`Le code parc ${input.code} existe déjà.`, { existingId: sameCode.id });
  await assertNoDuplicate(ctx, input);

  const [category] = await db
    .select()
    .from(equipmentCategories)
    .where(and(eq(equipmentCategories.id, input.categoryId), eq(equipmentCategories.tenantId, ctx.tenantId)));
  if (!category) throw new NotFoundError("Catégorie");
  if (input.modelId) {
    const [model] = await db
      .select({ categoryId: equipmentModels.categoryId })
      .from(equipmentModels)
      .where(and(eq(equipmentModels.id, input.modelId), eq(equipmentModels.tenantId, ctx.tenantId)));
    if (!model) throw new NotFoundError("Modèle");
  }
  return { input, category };
}

/** Crée un équipement (EQP-01, EQP-02), son compteur principal et applique les plans types (PRV-01). */
export async function createEquipment(ctx: AuthContext, raw: unknown) {
  const { input, category } = await checkEquipmentCreation(ctx, raw);

  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(equipment)
        .values({
          tenantId: ctx.tenantId,
          companyId: input.companyId,
          siteId: input.siteId,
          categoryId: input.categoryId,
          modelId: input.modelId ?? null,
          code: input.code,
          name: input.name,
          manufacturer: input.manufacturer,
          serialNumber: input.serialNumber,
          registration: input.registration?.toUpperCase() ?? null,
          year: input.year ?? null,
          // EQP-06 : criticité héritée de la catégorie, modifiable
          criticality: input.criticality ?? category.defaultCriticality,
          acquisitionMode: input.acquisitionMode,
          acquisitionDate: input.acquisitionDate ?? null,
          acquisitionValue: input.acquisitionValue ?? null,
          commissioningDate: input.commissioningDate,
          warrantyEndDate: input.warrantyEndDate ?? null,
          warrantyEndMeter: input.warrantyEndMeter ?? null,
          notes: input.notes ?? null,
          qrToken: randomBytes(9).toString("base64url"),
        })
        .returning();
      await tx.insert(equipmentStatusHistory).values({
        tenantId: ctx.tenantId,
        equipmentId: row.id,
        fromStatus: null,
        toStatus: row.status,
        reason: "Création",
        changedById: ctx.userId,
      });
      if (input.primaryMeterType) {
        await createMeter(tx, ctx, row.id, {
          type: input.primaryMeterType,
          ...METER_DEFAULTS[input.primaryMeterType],
          isPrimary: true,
          initialValue: input.primaryMeterValue ?? 0,
        });
      }
      await applyMatchingPlans(tx, ctx, row);
      await audit(tx, ctx, { entityType: "equipment", entityId: row.id, action: "create", after: row });
      return row;
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new ConflictError("Ce code parc ou ce numéro de série existe déjà.");
    throw error;
  }
}

/**
 * Modification (EQP-01) : champs absents inchangés, champs facultatifs vidés effacés (null).
 * La société propriétaire ne change pas ici (transfert inter-sociétés : TODO EQP-12).
 */
export const equipmentUpdateInput = z.object({
  siteId: z.uuid("Site obligatoire").optional(),
  categoryId: z.uuid("Catégorie obligatoire").optional(),
  modelId: clearable(z.uuid()),
  code: text(40, "Code parc obligatoire")
    .transform((s) => s.toUpperCase())
    .optional(),
  name: text(160, "Désignation obligatoire").optional(),
  manufacturer: text(80, "Marque obligatoire").optional(),
  serialNumber: text(80, "Numéro de série obligatoire").optional(),
  registration: clearable(
    z
      .string()
      .trim()
      .max(30)
      .transform((s) => s.toUpperCase()),
  ),
  year: clearable(z.coerce.number().int().min(1950, "Année invalide").max(2100, "Année invalide")),
  criticality: z.enum(["A", "B", "C"]).optional(),
  acquisitionMode: z.enum(["PURCHASE", "LEASE", "LONG_TERM_RENTAL", "SHORT_TERM_RENTAL"]).optional(),
  acquisitionDate: clearable(date()),
  acquisitionValue: clearable(z.coerce.number().min(0)),
  commissioningDate: date("Date de mise en service obligatoire").optional(),
  warrantyEndDate: clearable(date()),
  warrantyEndMeter: clearable(z.coerce.number().min(0)),
  notes: clearable(z.string().trim().max(2000)),
});

export async function updateEquipment(ctx: AuthContext, id: string, raw: unknown) {
  const input = parseInput(equipmentUpdateInput, raw);
  const [current] = await db
    .select()
    .from(equipment)
    .where(and(eq(equipment.id, id), eq(equipment.tenantId, ctx.tenantId)));
  if (!current) throw new NotFoundError("Équipement");
  assertCanOn(ctx, "equipment.write", current);
  if (current.status === "RETIRED") throw new BusinessRuleError(["Un équipement réformé est en lecture seule (EQP-14)."]);
  if (input.siteId && input.siteId !== current.siteId) await assertSiteBelongsToCompany(ctx, input.siteId, current.companyId);
  await assertNoDuplicate(
    ctx,
    { manufacturer: input.manufacturer ?? current.manufacturer, serialNumber: input.serialNumber, registration: input.registration ?? undefined },
    id,
  );
  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx.update(equipment).set(input).where(eq(equipment.id, id)).returning();
      await audit(tx, ctx, { entityType: "equipment", entityId: id, action: "update", before: current, after: row });
      return row;
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new ConflictError("Ce code parc ou ce numéro de série existe déjà.");
    throw error;
  }
}

export const retireInput = z.object({
  reason: text(500, "Le motif de réforme est obligatoire"),
  retiredAt: optionalDate,
  disposalValue: optionalNumber,
});

/**
 * Réforme (EQP-14, DON-14) : impossible avec un OT ouvert ; la fiche passe en lecture seule
 * et les plans sont désactivés. TODO(HAB-04) : circuit de validation par la direction.
 */
export async function retireEquipment(ctx: AuthContext, id: string, raw: unknown) {
  const input = parseInput(retireInput, raw);
  const [current] = await db
    .select()
    .from(equipment)
    .where(and(eq(equipment.id, id), eq(equipment.tenantId, ctx.tenantId)));
  if (!current) throw new NotFoundError("Équipement");
  assertCanOn(ctx, "equipment.write", current);
  const [{ open }] = await db
    .select({ open: count() })
    .from(workOrders)
    .where(and(eq(workOrders.equipmentId, id), inArray(workOrders.status, [...OPEN_STATUSES])));
  if (open > 0) throw new BusinessRuleError([`Réforme impossible : ${open} OT ouvert(s) sur cet équipement.`]);
  return db.transaction(async (tx) => {
    await setEquipmentStatus(tx, ctx, id, "RETIRED", { reason: input.reason });
    await tx
      .update(equipment)
      .set({ retiredAt: input.retiredAt ?? new Date(), retirementReason: input.reason, disposalValue: input.disposalValue ?? null })
      .where(eq(equipment.id, id));
    await tx.execute(sql`update equipment_plans set active = false, suspended_reason = 'Équipement réformé' where equipment_id = ${id}`);
    await tx.execute(sql`update due_items set status = 'SKIPPED' where equipment_id = ${id} and status in ('UPCOMING','PRE_ALERT','DUE','OVERDUE')`);
    await tx
      .update(assignments)
      .set({ endAt: new Date() })
      .where(and(eq(assignments.equipmentId, id), isNull(assignments.endAt)));
    await audit(tx, ctx, { entityType: "equipment", entityId: id, action: "retire", before: current, after: input });
  });
}

/* ------------------------------------------------------------------ */
/* Affectations (EQP-10, DON-13)                                       */
/* ------------------------------------------------------------------ */

export const assignmentInput = z
  .object({
    jobsiteId: optionalId,
    siteId: optionalId,
    workshopId: optionalId,
    startAt: date("Date de début obligatoire"),
    endAt: optionalDate,
    notes: optionalText(500),
  })
  .refine((v) => v.jobsiteId || v.siteId || v.workshopId, { message: "Indiquer un chantier, un site ou un atelier", path: ["jobsiteId"] })
  .refine((v) => !v.endAt || v.endAt > v.startAt, { message: "La fin doit être postérieure au début", path: ["endAt"] });

/**
 * Affecte un équipement. L'affectation active est clôturée à la date de début de la nouvelle ;
 * aucun chevauchement n'est accepté avec une affectation future.
 */
export async function assignEquipment(ctx: AuthContext, id: string, raw: unknown) {
  const input = parseInput(assignmentInput, raw);
  const [current] = await db
    .select()
    .from(equipment)
    .where(and(eq(equipment.id, id), eq(equipment.tenantId, ctx.tenantId)));
  if (!current) throw new NotFoundError("Équipement");
  assertCanOn(ctx, "assignment.write", current);
  if (current.status === "IMMOBILIZED" || current.status === "RETIRED") {
    throw new BusinessRuleError(["Un équipement immobilisé ou réformé ne peut pas être affecté (EQP-05)."]);
  }
  return db.transaction(async (tx) => {
    const [overlap] = await tx
      .select({ id: assignments.id })
      .from(assignments)
      .where(and(eq(assignments.equipmentId, id), gt(assignments.startAt, input.startAt)))
      .limit(1);
    if (overlap) throw new BusinessRuleError(["Une affectation future existe déjà : pas de chevauchement (DON-13)."]);
    await tx
      .update(assignments)
      .set({ endAt: input.startAt })
      .where(
        and(
          eq(assignments.equipmentId, id),
          lt(assignments.startAt, input.startAt),
          or(isNull(assignments.endAt), gt(assignments.endAt, input.startAt)),
        ),
      );
    const [row] = await tx
      .insert(assignments)
      .values({
        tenantId: ctx.tenantId,
        equipmentId: id,
        jobsiteId: input.jobsiteId ?? null,
        siteId: input.siteId ?? null,
        workshopId: input.workshopId ?? null,
        responsibleUserId: ctx.userId,
        startAt: input.startAt,
        endAt: input.endAt ?? null,
        notes: input.notes ?? null,
      })
      .returning();
    if (current.status === "AVAILABLE" && input.startAt <= new Date()) {
      await setEquipmentStatus(tx, ctx, id, "IN_SERVICE", { reason: "Affectation" });
    }
    await audit(tx, ctx, { entityType: "equipment", entityId: id, action: "assign", after: row });
    return row;
  });
}

export async function endAssignment(ctx: AuthContext, equipmentId: string) {
  const [current] = await db
    .select()
    .from(equipment)
    .where(and(eq(equipment.id, equipmentId), eq(equipment.tenantId, ctx.tenantId)));
  if (!current) throw new NotFoundError("Équipement");
  assertCanOn(ctx, "assignment.write", current);
  await db.transaction(async (tx) => {
    const active = await getActiveAssignment(tx, equipmentId);
    if (!active) return;
    await tx.update(assignments).set({ endAt: new Date() }).where(eq(assignments.id, active.id));
    if (current.status === "IN_SERVICE") await setEquipmentStatus(tx, ctx, equipmentId, "AVAILABLE", { reason: "Fin d'affectation" });
    await audit(tx, ctx, { entityType: "equipment", entityId: equipmentId, action: "end_assignment", before: active });
  });
}

/* ------------------------------------------------------------------ */
/* Référentiels : catégories et modèles (EQP-03)                       */
/* ------------------------------------------------------------------ */

export async function listCategories(ctx: AuthContext) {
  return db
    .select({
      id: equipmentCategories.id,
      code: equipmentCategories.code,
      name: equipmentCategories.name,
      defaultCriticality: equipmentCategories.defaultCriticality,
      attributeDefinitions: equipmentCategories.attributeDefinitions,
      equipmentCount: sql<number>`(select count(*) from equipment e where e.category_id = "equipment_categories"."id")`.mapWith(Number),
    })
    .from(equipmentCategories)
    .where(eq(equipmentCategories.tenantId, ctx.tenantId))
    .orderBy(asc(equipmentCategories.name));
}

export async function listModels(ctx: AuthContext) {
  return db
    .select({
      id: equipmentModels.id,
      manufacturer: equipmentModels.manufacturer,
      name: equipmentModels.name,
      categoryId: equipmentModels.categoryId,
      categoryName: equipmentCategories.name,
    })
    .from(equipmentModels)
    .innerJoin(equipmentCategories, eq(equipmentCategories.id, equipmentModels.categoryId))
    .where(eq(equipmentModels.tenantId, ctx.tenantId))
    .orderBy(asc(equipmentModels.manufacturer), asc(equipmentModels.name));
}

export const categoryInput = z.object({
  code: text(30, "Code obligatoire").transform((s) => s.toUpperCase()),
  name: text(120, "Nom obligatoire"),
  defaultCriticality: z.enum(["A", "B", "C"]).default("B"),
});

export async function createCategory(ctx: AuthContext, raw: unknown) {
  assertCan(ctx, "settings.manage");
  const input = parseInput(categoryInput, raw);
  return db.transaction(async (tx) => {
    try {
      const [row] = await tx
        .insert(equipmentCategories)
        .values({ ...input, tenantId: ctx.tenantId })
        .returning();
      await audit(tx, ctx, { entityType: "equipment_category", entityId: row.id, action: "create", after: row });
      return row;
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictError("Ce code de catégorie existe déjà.");
      throw error;
    }
  });
}

export const modelInput = z.object({
  categoryId: z.uuid("Catégorie obligatoire"),
  manufacturer: text(80, "Marque obligatoire"),
  name: text(120, "Nom du modèle obligatoire"),
});

export async function createModel(ctx: AuthContext, raw: unknown) {
  assertCan(ctx, "settings.manage");
  const input = parseInput(modelInput, raw);
  return db.transaction(async (tx) => {
    try {
      const [row] = await tx
        .insert(equipmentModels)
        .values({ ...input, tenantId: ctx.tenantId })
        .returning();
      await audit(tx, ctx, { entityType: "equipment_model", entityId: row.id, action: "create", after: row });
      return row;
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictError("Ce modèle existe déjà pour cette marque.");
      throw error;
    }
  });
}

/** Options des formulaires d'équipement. */
export async function getEquipmentFormOptions(ctx: AuthContext) {
  const [categories, models] = await Promise.all([listCategories(ctx), listModels(ctx)]);
  return {
    categories: categories.map((c) => ({ id: c.id, label: c.name, defaultCriticality: c.defaultCriticality })),
    models: models.map((m) => ({ id: m.id, label: `${m.manufacturer} ${m.name}`, categoryId: m.categoryId })),
  };
}

/** Liste courte pour les sélecteurs (DI, OT) dans le périmètre d'un droit. */
export async function listEquipmentOptions(ctx: AuthContext, permission: "request.create" | "workorder.create" = "request.create") {
  return db
    .select({ id: equipment.id, code: equipment.code, name: equipment.name, siteId: equipment.siteId })
    .from(equipment)
    .where(
      and(
        eq(equipment.tenantId, ctx.tenantId),
        ne(equipment.status, "RETIRED"),
        scopeWhere(ctx.scope(permission), equipment.companyId, equipment.siteId),
      ),
    )
    .orderBy(asc(equipment.code))
    .limit(1000);
}

export async function listJobsitesAndWorkshopsForAssignment(ctx: AuthContext) {
  const [js, ws] = await Promise.all([
    db
      .select({ id: jobsites.id, name: jobsites.name })
      .from(jobsites)
      .where(and(eq(jobsites.tenantId, ctx.tenantId), eq(jobsites.active, true)))
      .orderBy(asc(jobsites.name)),
    db.select({ id: workshops.id, name: workshops.name }).from(workshops).where(eq(workshops.tenantId, ctx.tenantId)).orderBy(asc(workshops.name)),
  ]);
  return { jobsites: js, workshops: ws };
}

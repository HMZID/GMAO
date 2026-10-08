import "server-only";
import { and, asc, count, desc, eq, inArray, isNull, notInArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { AuthContext } from "@/server/authz/context";
import { db, type DbOrTx } from "@/server/db";
import {
  dueItems,
  equipment,
  equipmentCategories,
  equipmentModels,
  equipmentPlans,
  maintenancePlans,
  meters,
  planOperations,
  planTriggers,
  taskListItems,
  taskLists,
  workOrders,
} from "@/server/db/schema";
import {
  computeDue,
  dayIndex,
  earliestDate,
  evaluateDue,
  nextBaseline,
  projectMeterDate,
  shouldGenerateWorkOrder,
  suggestedStart,
  type Baseline,
  type DueStatus,
  type OperationRule,
  type Trigger,
} from "@/server/domain/preventive";
import { BusinessRuleError, NotFoundError } from "@/server/errors";
import { bool, date, optionalDate, optionalId, optionalNumber, optionalText, text } from "@/server/validation";
import { assertCan, assertCanOn, audit, parseInput, scopeWhere } from "./_shared";
import { openDowntime, setEquipmentStatus } from "./equipment-status";
import { insertWorkOrder } from "./work-order-factory";

/* ------------------------------------------------------------------ */
/* Plans d'entretien                                                    */
/* ------------------------------------------------------------------ */

export async function listPlans(ctx: AuthContext) {
  assertCan(ctx, "plan.read");
  const rows = await db
    .select({
      id: maintenancePlans.id,
      name: maintenancePlans.name,
      description: maintenancePlans.description,
      active: maintenancePlans.active,
      version: maintenancePlans.version,
      categoryName: equipmentCategories.name,
      modelName: equipmentModels.name,
      operations: sql<number>`(select count(*) from plan_operations po where po.plan_id = "maintenance_plans"."id")`.mapWith(Number),
      equipmentCount: sql<number>`(select count(*) from equipment_plans ep where ep.plan_id = "maintenance_plans"."id" and ep.active)`.mapWith(
        Number,
      ),
    })
    .from(maintenancePlans)
    .leftJoin(equipmentCategories, eq(equipmentCategories.id, maintenancePlans.categoryId))
    .leftJoin(equipmentModels, eq(equipmentModels.id, maintenancePlans.modelId))
    .where(eq(maintenancePlans.tenantId, ctx.tenantId))
    .orderBy(asc(maintenancePlans.name));
  return rows;
}

export async function getPlan(ctx: AuthContext, planId: string) {
  assertCan(ctx, "plan.read");
  const plan = await db.query.maintenancePlans.findFirst({
    where: and(eq(maintenancePlans.id, planId), eq(maintenancePlans.tenantId, ctx.tenantId)),
    with: {
      category: true,
      model: true,
      operations: {
        orderBy: asc(planOperations.code),
        with: { triggers: true, taskList: { with: { items: { orderBy: asc(taskListItems.position) } } } },
      },
    },
  });
  if (!plan) throw new NotFoundError("Plan d'entretien");
  // Équipements auxquels le plan est appliqué, dans le périmètre de l'utilisateur
  const applied = await db
    .select({ id: equipment.id, code: equipment.code, name: equipment.name, status: equipment.status, active: equipmentPlans.active })
    .from(equipmentPlans)
    .innerJoin(equipment, eq(equipment.id, equipmentPlans.equipmentId))
    .where(and(eq(equipmentPlans.planId, planId), scopeWhere(ctx.scope("plan.read"), equipment.companyId, equipment.siteId)))
    .orderBy(asc(equipment.code));
  return { ...plan, equipment: applied };
}

const triggerInput = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("CALENDAR"), every: z.coerce.number().positive(), unit: z.enum(["DAY", "WEEK", "MONTH", "YEAR"]) }),
  z.object({ kind: z.literal("METER"), every: z.coerce.number().positive(), meterType: z.enum(["HOURS", "KM", "CYCLES", "OTHER"]) }),
]);

export const operationInput = z.object({
  code: text(30, "Code obligatoire"),
  name: text(160, "Libellé obligatoire"),
  mode: z.enum(["FIXED", "SLIDING"]).default("SLIDING"),
  isRegulatory: bool.default(false),
  blockWhenOverdue: bool.default(false),
  preAlertDays: optionalNumber,
  preAlertMeter: optionalNumber,
  tolerancePercent: z.coerce.number().int().min(0).max(100).default(10),
  estimatedMinutes: optionalNumber,
  triggers: z.array(triggerInput).min(1, "Au moins un déclencheur"),
  /** Points de checklist de la gamme associée (PRV-11). */
  checklist: z.array(z.string().trim().min(1)).default([]),
});

export const planInput = z.object({
  name: text(160, "Nom obligatoire"),
  description: optionalText(),
  categoryId: optionalId,
  modelId: optionalId,
  operations: z.array(operationInput).default([]),
});

async function insertOperation(tx: DbOrTx, ctx: AuthContext, planId: string, op: z.output<typeof operationInput>) {
  let taskListId: string | null = null;
  if (op.checklist.length > 0) {
    const [list] = await tx
      .insert(taskLists)
      .values({ tenantId: ctx.tenantId, name: `${op.code} — ${op.name}`, estimatedMinutes: op.estimatedMinutes ?? null })
      .returning({ id: taskLists.id });
    taskListId = list.id;
    await tx
      .insert(taskListItems)
      .values(op.checklist.map((label, i) => ({ taskListId: list.id, position: i + 1, label, kind: "CHECK" as const, required: true })));
  }
  const [row] = await tx
    .insert(planOperations)
    .values({
      tenantId: ctx.tenantId,
      planId,
      code: op.code.toUpperCase(),
      name: op.name,
      mode: op.mode,
      isRegulatory: op.isRegulatory,
      blockWhenOverdue: op.blockWhenOverdue,
      preAlertDays: op.preAlertDays ?? null,
      preAlertMeter: op.preAlertMeter ?? null,
      tolerancePercent: op.tolerancePercent,
      estimatedMinutes: op.estimatedMinutes ?? null,
      taskListId,
    })
    .returning();
  await tx.insert(planTriggers).values(
    op.triggers.map((t) => ({
      operationId: row.id,
      kind: t.kind,
      every: t.every,
      calendarUnit: t.kind === "CALENDAR" ? t.unit : null,
      meterType: t.kind === "METER" ? t.meterType : null,
    })),
  );
  return row;
}

export async function createPlan(ctx: AuthContext, raw: unknown) {
  assertCan(ctx, "plan.write");
  const input = parseInput(planInput, raw);
  return db.transaction(async (tx) => {
    const [plan] = await tx
      .insert(maintenancePlans)
      .values({
        tenantId: ctx.tenantId,
        name: input.name,
        description: input.description ?? null,
        categoryId: input.categoryId ?? null,
        modelId: input.modelId ?? null,
      })
      .returning();
    for (const op of input.operations) await insertOperation(tx, ctx, plan.id, op);
    await audit(tx, ctx, { entityType: "maintenance_plan", entityId: plan.id, action: "create", after: input });
    return plan;
  });
}

export async function addOperation(ctx: AuthContext, planId: string, raw: unknown) {
  assertCan(ctx, "plan.write");
  const input = parseInput(operationInput, raw);
  return db.transaction(async (tx) => {
    const [plan] = await tx
      .select({ id: maintenancePlans.id })
      .from(maintenancePlans)
      .where(and(eq(maintenancePlans.id, planId), eq(maintenancePlans.tenantId, ctx.tenantId)));
    if (!plan) throw new NotFoundError("Plan d'entretien");
    const op = await insertOperation(tx, ctx, planId, input);
    // Nouvelle version : les OT déjà générés ne changent pas, les échéances futures intègrent l'opération (PRV-01).
    await tx
      .update(maintenancePlans)
      .set({ version: sql`${maintenancePlans.version} + 1` })
      .where(eq(maintenancePlans.id, planId));
    const applied = await tx
      .select({ id: equipmentPlans.id, equipmentId: equipmentPlans.equipmentId })
      .from(equipmentPlans)
      .where(and(eq(equipmentPlans.planId, planId), eq(equipmentPlans.active, true)));
    for (const ep of applied) await createInitialDueItem(tx, ctx, ep.id, ep.equipmentId, op.id, new Date());
    await audit(tx, ctx, { entityType: "maintenance_plan", entityId: planId, action: "add_operation", after: input });
    return op;
  });
}

/* ------------------------------------------------------------------ */
/* Application aux équipements et échéances                            */
/* ------------------------------------------------------------------ */

type OperationWithTriggers = typeof planOperations.$inferSelect & { triggers: (typeof planTriggers.$inferSelect)[] };

function toRule(op: OperationWithTriggers): OperationRule {
  const triggers: Trigger[] = op.triggers.map((t) =>
    t.kind === "CALENDAR"
      ? { kind: "CALENDAR", every: t.every, unit: t.calendarUnit ?? "MONTH" }
      : { kind: "METER", every: t.every, meterType: t.meterType ?? "HOURS" },
  );
  return {
    mode: op.mode,
    triggers,
    preAlertDays: op.preAlertDays,
    preAlertMeter: op.preAlertMeter,
    tolerancePercent: op.tolerancePercent,
  };
}

async function loadOperation(tx: DbOrTx, operationId: string) {
  const op = await tx.query.planOperations.findFirst({
    where: eq(planOperations.id, operationId),
    with: { triggers: true },
  });
  if (!op) throw new NotFoundError("Opération");
  return op;
}

/** Compteur de l'équipement concerné par le déclencheur compteur de l'opération (le principal en priorité). */
async function meterForOperation(tx: DbOrTx, equipmentId: string, op: OperationWithTriggers) {
  const meterTrigger = op.triggers.find((t) => t.kind === "METER");
  if (!meterTrigger) return null;
  const rows = await tx
    .select()
    .from(meters)
    .where(and(eq(meters.equipmentId, equipmentId), eq(meters.type, meterTrigger.meterType ?? "HOURS")))
    .orderBy(desc(meters.isPrimary));
  return rows[0] ?? null;
}

async function createInitialDueItem(
  tx: DbOrTx,
  ctx: AuthContext,
  equipmentPlanId: string,
  equipmentId: string,
  operationId: string,
  now: Date,
  lastDone?: { date?: Date | null; meter?: number | null },
) {
  const op = await loadOperation(tx, operationId);
  const [eq0] = await tx.select({ commissioningDate: equipment.commissioningDate }).from(equipment).where(eq(equipment.id, equipmentId));
  const meter = await meterForOperation(tx, equipmentId, op);
  const base: Baseline = {
    date: lastDone?.date ?? eq0?.commissioningDate ?? now,
    meter: lastDone?.meter ?? meter?.lastCumulativeValue ?? (meter ? 0 : null),
  };
  const rule = toRule(op);
  const due = computeDue(rule, base);
  const status = evaluateDue({ rule, base, due, now, currentMeter: meter?.lastCumulativeValue ?? null });
  const projectedDate = earliestDate(
    due.dueDate,
    projectMeterDate({
      dueMeter: due.dueMeter,
      lastMeter: meter?.lastCumulativeValue ?? null,
      lastReadAt: meter?.lastReadAt ?? null,
      dailyUsage: meter?.averageDailyUsage ?? null,
    }),
  );
  const [row] = await tx
    .insert(dueItems)
    .values({
      tenantId: ctx.tenantId,
      equipmentId,
      equipmentPlanId,
      operationId,
      meterId: meter?.id ?? null,
      baseDate: base.date,
      baseMeterValue: base.meter ?? null,
      dueDate: due.dueDate,
      dueMeterValue: due.dueMeter,
      projectedDate,
      status,
    })
    .returning();
  return row;
}

export const applyPlanInput = z.object({
  planId: z.uuid("Plan obligatoire"),
  lastDoneAt: optionalDate,
  lastDoneMeter: optionalNumber,
});

/** Applique un plan à un équipement et crée ses échéances (PRV-01). */
export async function applyPlanToEquipment(
  tx: DbOrTx,
  ctx: AuthContext,
  equipmentId: string,
  planId: string,
  options: { now?: Date; lastDoneAt?: Date | null; lastDoneMeter?: number | null } = {},
) {
  const now = options.now ?? new Date();
  const [existing] = await tx
    .select()
    .from(equipmentPlans)
    .where(and(eq(equipmentPlans.equipmentId, equipmentId), eq(equipmentPlans.planId, planId)));
  if (existing?.active) return existing;
  const [ep] = existing
    ? await tx.update(equipmentPlans).set({ active: true, suspendedReason: null }).where(eq(equipmentPlans.id, existing.id)).returning()
    : await tx.insert(equipmentPlans).values({ tenantId: ctx.tenantId, equipmentId, planId }).returning();
  const operations = await tx.select({ id: planOperations.id }).from(planOperations).where(eq(planOperations.planId, planId));
  for (const op of operations) {
    await createInitialDueItem(tx, ctx, ep.id, equipmentId, op.id, now, {
      date: options.lastDoneAt ?? null,
      meter: options.lastDoneMeter ?? null,
    });
  }
  return ep;
}

/** Applique automatiquement les plans types de la catégorie et du modèle (création d'équipement). */
export async function applyMatchingPlans(tx: DbOrTx, ctx: AuthContext, eqRow: { id: string; categoryId: string; modelId: string | null }) {
  const plans = await tx
    .select({ id: maintenancePlans.id })
    .from(maintenancePlans)
    .where(
      and(
        eq(maintenancePlans.tenantId, ctx.tenantId),
        eq(maintenancePlans.active, true),
        or(eq(maintenancePlans.categoryId, eqRow.categoryId), eqRow.modelId ? eq(maintenancePlans.modelId, eqRow.modelId) : sql`false`),
      ),
    );
  for (const p of plans) await applyPlanToEquipment(tx, ctx, eqRow.id, p.id);
  return plans.length;
}

export async function applyPlan(ctx: AuthContext, equipmentId: string, raw: unknown) {
  const input = parseInput(applyPlanInput, raw);
  const [eqRow] = await db
    .select({ companyId: equipment.companyId, siteId: equipment.siteId })
    .from(equipment)
    .where(and(eq(equipment.id, equipmentId), eq(equipment.tenantId, ctx.tenantId)));
  if (!eqRow) throw new NotFoundError("Équipement");
  assertCanOn(ctx, "plan.write", eqRow);
  return db.transaction(async (tx) => {
    const ep = await applyPlanToEquipment(tx, ctx, equipmentId, input.planId, {
      lastDoneAt: input.lastDoneAt,
      lastDoneMeter: input.lastDoneMeter,
    });
    await audit(tx, ctx, { entityType: "equipment", entityId: equipmentId, action: "apply_plan", after: input });
    return ep;
  });
}

const OPEN_DUE = ["UPCOMING", "PRE_ALERT", "DUE", "OVERDUE"] as const;

/**
 * Recalcule statut et projection des échéances ouvertes d'un équipement (après un relevé, un remplacement
 * de compteur ou chaque nuit). Bloque l'équipement si un contrôle réglementaire bloquant est échu (PRV-12).
 */
export async function recomputeDueItems(tx: DbOrTx, ctx: AuthContext, equipmentId: string, now: Date = new Date()) {
  const items = await tx
    .select()
    .from(dueItems)
    .where(and(eq(dueItems.equipmentId, equipmentId), inArray(dueItems.status, [...OPEN_DUE])));
  for (const item of items) {
    const op = await loadOperation(tx, item.operationId);
    const rule = toRule(op);
    const [meter] = item.meterId ? await tx.select().from(meters).where(eq(meters.id, item.meterId)) : [];
    const base: Baseline = { date: item.baseDate, meter: item.baseMeterValue };
    const due = { dueDate: item.postponedTo ?? item.dueDate, dueMeter: item.dueMeterValue };
    const status: DueStatus = evaluateDue({ rule, base, due, now, currentMeter: meter?.lastCumulativeValue ?? null });
    const projectedDate = earliestDate(
      due.dueDate,
      projectMeterDate({
        dueMeter: due.dueMeter,
        lastMeter: meter?.lastCumulativeValue ?? null,
        lastReadAt: meter?.lastReadAt ?? null,
        dailyUsage: meter?.averageDailyUsage ?? null,
      }),
    );
    await tx.update(dueItems).set({ status, projectedDate }).where(eq(dueItems.id, item.id));

    if (op.isRegulatory && op.blockWhenOverdue && item.dueDate && dayIndex(now) > dayIndex(item.dueDate)) {
      const changed = await setEquipmentStatus(tx, ctx, equipmentId, "IMMOBILIZED", {
        reason: `Contrôle réglementaire échu : ${op.name}`,
      });
      if (changed === "IMMOBILIZED") {
        await openDowntime(tx, ctx, { equipmentId, reason: "REGULATORY", comment: op.name });
      }
    }
  }
}

/** Recalcule toutes les échéances du périmètre (tâche planifiée quotidienne). */
export async function recomputeAllDueItems(ctx: AuthContext, now: Date = new Date()) {
  assertCan(ctx, "workorder.manage");
  const scope = ctx.scope("workorder.manage");
  const rows = await db
    .selectDistinct({ equipmentId: dueItems.equipmentId })
    .from(dueItems)
    .innerJoin(equipment, eq(equipment.id, dueItems.equipmentId))
    .where(
      and(eq(dueItems.tenantId, ctx.tenantId), inArray(dueItems.status, [...OPEN_DUE]), scopeWhere(scope, equipment.companyId, equipment.siteId)),
    );
  for (const r of rows) await db.transaction((tx) => recomputeDueItems(tx, ctx, r.equipmentId, now));
  return rows.length;
}

/**
 * Génère les OT préventifs des échéances en pré-alerte, échues ou projetées dans l'horizon (PRV-08).
 * Une seule échéance ouverte par opération et équipement, et un seul OT par échéance : relancer
 * la génération ne crée aucun doublon (verrou de ligne + condition work_order_id IS NULL).
 */
export async function generatePreventiveWorkOrders(ctx: AuthContext, options: { now?: Date; equipmentId?: string } = {}) {
  assertCan(ctx, "workorder.manage");
  const now = options.now ?? new Date();
  const scope = ctx.scope("workorder.manage");
  const candidates = await db
    .select({ id: dueItems.id })
    .from(dueItems)
    .innerJoin(equipment, eq(equipment.id, dueItems.equipmentId))
    .where(
      and(
        eq(dueItems.tenantId, ctx.tenantId),
        inArray(dueItems.status, [...OPEN_DUE]),
        isNull(dueItems.workOrderId),
        notInArray(equipment.status, ["RETIRED"]),
        options.equipmentId ? eq(dueItems.equipmentId, options.equipmentId) : undefined,
        scopeWhere(scope, equipment.companyId, equipment.siteId),
      ),
    );

  const created: string[] = [];
  for (const candidate of candidates) {
    const woId = await db.transaction(async (tx) => {
      const [item] = await tx.select().from(dueItems).where(eq(dueItems.id, candidate.id)).for("update");
      if (!item || item.workOrderId) return null;
      if (!shouldGenerateWorkOrder(item.status as DueStatus, item.projectedDate ?? item.dueDate, now)) return null;
      const op = await tx.query.planOperations.findFirst({ where: eq(planOperations.id, item.operationId) });
      const [eqRow] = await tx.select().from(equipment).where(eq(equipment.id, item.equipmentId));
      if (!op || !eqRow) return null;
      const wo = await insertWorkOrder(tx, ctx, {
        companyId: eqRow.companyId,
        siteId: eqRow.siteId,
        equipmentId: eqRow.id,
        type: op.isRegulatory ? "REGULATORY" : "PREVENTIVE",
        priority: item.status === "OVERDUE" ? "P2" : "P3",
        title: op.name,
        description:
          `Échéance ${item.dueMeterValue ? `${item.dueMeterValue} ` : ""}${item.dueDate ? `au ${item.dueDate.toISOString().slice(0, 10)}` : ""}`.trim(),
        isImmobilizing: true,
        estimatedMinutes: op.estimatedMinutes,
        dueItemId: item.id,
        taskListId: op.taskListId,
        plannedStart: suggestedStart(item.projectedDate ?? item.dueDate ?? null),
      });
      await tx.update(dueItems).set({ workOrderId: wo.id }).where(eq(dueItems.id, item.id));
      return wo.id;
    });
    if (woId) created.push(woId);
  }
  return { created: created.length, workOrderIds: created };
}

/**
 * Solde l'échéance d'un OT préventif à sa clôture technique et crée l'échéance suivante (PRV-04).
 */
export async function completeDueItem(tx: DbOrTx, ctx: AuthContext, dueItemId: string, completion: { date: Date; meter?: number | null }) {
  const [item] = await tx.select().from(dueItems).where(eq(dueItems.id, dueItemId));
  if (!item || item.status === "DONE") return null;
  const op = await loadOperation(tx, item.operationId);
  const rule = toRule(op);
  await tx
    .update(dueItems)
    .set({ status: "DONE", completedAt: completion.date, completedMeterValue: completion.meter ?? null })
    .where(eq(dueItems.id, item.id));

  const [ep] = await tx.select().from(equipmentPlans).where(eq(equipmentPlans.id, item.equipmentPlanId));
  if (!ep?.active) return null;
  const base = nextBaseline(rule, { dueDate: item.dueDate, dueMeter: item.dueMeterValue }, completion);
  const due = computeDue(rule, base);
  const [meter] = item.meterId ? await tx.select().from(meters).where(eq(meters.id, item.meterId)) : [];
  const status = evaluateDue({ rule, base, due, now: completion.date, currentMeter: meter?.lastCumulativeValue ?? null });
  const [next] = await tx
    .insert(dueItems)
    .values({
      tenantId: ctx.tenantId,
      equipmentId: item.equipmentId,
      equipmentPlanId: item.equipmentPlanId,
      operationId: item.operationId,
      meterId: item.meterId,
      baseDate: base.date,
      baseMeterValue: base.meter ?? null,
      dueDate: due.dueDate,
      dueMeterValue: due.dueMeter,
      projectedDate: due.dueDate,
      status,
    })
    .returning();
  return next;
}

export const postponeInput = z.object({
  postponedTo: date("Nouvelle date obligatoire"),
  reason: text(500, "Le motif est obligatoire"),
});

/** Report d'une échéance (PRV-10) : motif obligatoire ; interdit au-delà de l'échéance légale d'un contrôle réglementaire. */
export async function postponeDueItem(ctx: AuthContext, dueItemId: string, raw: unknown) {
  const input = parseInput(postponeInput, raw);
  return db.transaction(async (tx) => {
    const [item] = await tx
      .select({ due: dueItems, companyId: equipment.companyId, siteId: equipment.siteId })
      .from(dueItems)
      .innerJoin(equipment, eq(equipment.id, dueItems.equipmentId))
      .where(and(eq(dueItems.id, dueItemId), eq(dueItems.tenantId, ctx.tenantId)));
    if (!item) throw new NotFoundError("Échéance");
    assertCanOn(ctx, "workorder.manage", item);
    const op = await loadOperation(tx, item.due.operationId);
    if (op.isRegulatory && item.due.dueDate && input.postponedTo > item.due.dueDate) {
      throw new BusinessRuleError(["Un contrôle réglementaire ne peut pas être reporté au-delà de son échéance légale."]);
    }
    // TODO(PRV-10) : au-delà de la tolérance, exiger la validation du responsable maintenance.
    await tx.update(dueItems).set({ postponedTo: input.postponedTo, postponeReason: input.reason }).where(eq(dueItems.id, dueItemId));
    await audit(tx, ctx, { entityType: "due_item", entityId: dueItemId, action: "postpone", before: item.due, after: input });
    await recomputeDueItems(tx, ctx, item.due.equipmentId);
  });
}

export const dueFilters = z.object({
  status: z.enum(["UPCOMING", "PRE_ALERT", "DUE", "OVERDUE", "OPEN"]).default("OPEN"),
  siteId: z.uuid().optional(),
  equipmentId: z.uuid().optional(),
});

export async function listDueItems(ctx: AuthContext, raw: unknown = {}) {
  assertCan(ctx, "plan.read");
  const filters = parseInput(dueFilters, raw);
  const scope = ctx.scope("plan.read");
  const statuses = filters.status === "OPEN" ? [...OPEN_DUE] : [filters.status];
  return db
    .select({
      id: dueItems.id,
      status: dueItems.status,
      dueDate: dueItems.dueDate,
      dueMeterValue: dueItems.dueMeterValue,
      projectedDate: dueItems.projectedDate,
      postponedTo: dueItems.postponedTo,
      baseDate: dueItems.baseDate,
      baseMeterValue: dueItems.baseMeterValue,
      workOrderId: dueItems.workOrderId,
      workOrderNumber: workOrders.number,
      equipmentId: equipment.id,
      equipmentCode: equipment.code,
      equipmentName: equipment.name,
      siteId: equipment.siteId,
      operationName: planOperations.name,
      operationCode: planOperations.code,
      isRegulatory: planOperations.isRegulatory,
      meterUnit: meters.unit,
      currentMeter: meters.lastCumulativeValue,
    })
    .from(dueItems)
    .innerJoin(equipment, eq(equipment.id, dueItems.equipmentId))
    .innerJoin(planOperations, eq(planOperations.id, dueItems.operationId))
    .leftJoin(meters, eq(meters.id, dueItems.meterId))
    .leftJoin(workOrders, eq(workOrders.id, dueItems.workOrderId))
    .where(
      and(
        eq(dueItems.tenantId, ctx.tenantId),
        inArray(dueItems.status, statuses),
        filters.siteId ? eq(equipment.siteId, filters.siteId) : undefined,
        filters.equipmentId ? eq(dueItems.equipmentId, filters.equipmentId) : undefined,
        scopeWhere(scope, equipment.companyId, equipment.siteId),
      ),
    )
    .orderBy(sql`case ${dueItems.status} when 'OVERDUE' then 0 when 'DUE' then 1 when 'PRE_ALERT' then 2 else 3 end`, asc(dueItems.projectedDate))
    .limit(500);
}

export async function countDueItemsByStatus(ctx: AuthContext) {
  const scope = ctx.scope("plan.read");
  if (!ctx.can("plan.read")) return {};
  const rows = await db
    .select({ status: dueItems.status, n: count() })
    .from(dueItems)
    .innerJoin(equipment, eq(equipment.id, dueItems.equipmentId))
    .where(
      and(eq(dueItems.tenantId, ctx.tenantId), inArray(dueItems.status, [...OPEN_DUE]), scopeWhere(scope, equipment.companyId, equipment.siteId)),
    )
    .groupBy(dueItems.status);
  return Object.fromEntries(rows.map((r) => [r.status, r.n])) as Partial<Record<(typeof OPEN_DUE)[number], number>>;
}

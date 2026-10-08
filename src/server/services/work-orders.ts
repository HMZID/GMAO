import "server-only";
import { and, asc, count, desc, eq, gte, ilike, inArray, isNull, lte, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { AuthContext } from "@/server/authz/context";
import { db, type DbOrTx } from "@/server/db";
import {
  absences,
  dueItems,
  equipment,
  laborRates,
  meterReadings,
  meters,
  parts,
  sites,
  stockMovements,
  stockReservations,
  suppliers,
  technicians,
  timeEntries,
  warehouses,
  workOrderAssignees,
  workOrderCosts,
  workOrderStatusHistory,
  workOrderTasks,
  workOrders,
  workRequests,
} from "@/server/db/schema";
import {
  ALLOWED_TRANSITIONS,
  OPEN_STATUSES,
  checkTransition,
  requiresReleaseValidation,
  type TransitionInput,
  type WorkOrderSnapshot,
  type WorkOrderStatus,
} from "@/server/domain/work-order-status";
import { BusinessRuleError, NotFoundError } from "@/server/errors";
import { bool, optionalDate, optionalId, optionalNumber, optionalText, text } from "@/server/validation";
import { assertCan, assertCanOn, audit, offsetOf, paginationSchema, parseInput, scopeWhere } from "./_shared";
import { openDowntime, releaseEquipmentIfFree, setEquipmentStatus } from "./equipment-status";
import { notifyByPermission } from "./notifications";
import { completeDueItem } from "./preventive";
import { issueToWorkOrder, releaseReservations, reserveForWorkOrder, returnFromWorkOrder } from "./stock";
import { approvalTimeline, startApproval } from "./approvals";
import { listPurchaseRequestsForWorkOrder } from "./purchase-requests";
import { insertWorkOrder } from "./work-order-factory";

type WorkOrderRow = typeof workOrders.$inferSelect;

/* ------------------------------------------------------------------ */
/* Liste                                                                */
/* ------------------------------------------------------------------ */

export const workOrderFilters = paginationSchema.extend({
  status: z.enum(["OPEN", "ALL", "CREATED", "PLANNED", "ON_HOLD", "IN_PROGRESS", "WORK_DONE", "TECH_CLOSED", "CLOSED", "CANCELLED"]).default("OPEN"),
  type: z.enum(["PREVENTIVE", "CORRECTIVE", "REGULATORY", "IMPROVEMENT", "ACCIDENT"]).optional(),
  priority: z.enum(["P1", "P2", "P3", "P4"]).optional(),
  siteId: z.uuid().optional(),
  equipmentId: z.uuid().optional(),
  mine: bool.default(false),
  q: z.string().trim().max(100).optional(),
});

export async function listWorkOrders(ctx: AuthContext, raw: unknown = {}) {
  assertCan(ctx, "workorder.read");
  const f = parseInput(workOrderFilters, raw);
  const statusFilter =
    f.status === "ALL" ? undefined : f.status === "OPEN" ? inArray(workOrders.status, [...OPEN_STATUSES]) : eq(workOrders.status, f.status);
  const mineFilter =
    f.mine && ctx.technicianId
      ? sql`exists (select 1 from work_order_assignees a where a.work_order_id = "work_orders"."id" and a.technician_id = ${ctx.technicianId})`
      : undefined;
  const where = and(
    eq(workOrders.tenantId, ctx.tenantId),
    scopeWhere(ctx.scope("workorder.read"), workOrders.companyId, workOrders.siteId),
    statusFilter,
    f.type ? eq(workOrders.type, f.type) : undefined,
    f.priority ? eq(workOrders.priority, f.priority) : undefined,
    f.siteId ? eq(workOrders.siteId, f.siteId) : undefined,
    f.equipmentId ? eq(workOrders.equipmentId, f.equipmentId) : undefined,
    mineFilter,
    f.q ? or(ilike(workOrders.number, `%${f.q}%`), ilike(workOrders.title, `%${f.q}%`), ilike(equipment.code, `%${f.q}%`)) : undefined,
  );
  const [items, [{ total }]] = await Promise.all([
    db
      .select({
        id: workOrders.id,
        number: workOrders.number,
        title: workOrders.title,
        type: workOrders.type,
        status: workOrders.status,
        priority: workOrders.priority,
        holdReason: workOrders.holdReason,
        isImmobilizing: workOrders.isImmobilizing,
        isExternal: workOrders.isExternal,
        plannedStart: workOrders.plannedStart,
        createdAt: workOrders.createdAt,
        equipmentId: equipment.id,
        equipmentCode: equipment.code,
        equipmentName: equipment.name,
        siteName: sites.name,
        assignees: sql<string>`(select string_agg(t.first_name || ' ' || t.last_name, ', ') from work_order_assignees a join technicians t on t.id = a.technician_id where a.work_order_id = "work_orders"."id")`,
      })
      .from(workOrders)
      .innerJoin(equipment, eq(equipment.id, workOrders.equipmentId))
      .innerJoin(sites, eq(sites.id, workOrders.siteId))
      .where(where)
      .orderBy(asc(workOrders.priority), asc(workOrders.plannedStart), desc(workOrders.createdAt))
      .limit(f.pageSize)
      .offset(offsetOf(f)),
    db.select({ total: count() }).from(workOrders).innerJoin(equipment, eq(equipment.id, workOrders.equipmentId)).where(where),
  ]);
  return { items, total, page: f.page, pageSize: f.pageSize };
}

/* ------------------------------------------------------------------ */
/* Coûts (KPI-01)                                                       */
/* ------------------------------------------------------------------ */

export type CostSummary = { labor: number; parts: number; external: number; other: number; total: number; minutes: number };

export async function costSummary(tx: DbOrTx, wo: Pick<WorkOrderRow, "id" | "externalCost">): Promise<CostSummary> {
  // Requêtes successives : `tx` peut être une transaction (un seul client, pas de requêtes concurrentes).
  const [labor] = await tx
    .select({
      minutes: sql<number>`coalesce(sum(${timeEntries.minutes}), 0)`.mapWith(Number),
      amount: sql<number>`coalesce(sum(${timeEntries.minutes} / 60.0 * coalesce(${timeEntries.hourlyRate}, 0)), 0)`.mapWith(Number),
    })
    .from(timeEntries)
    .where(eq(timeEntries.workOrderId, wo.id));
  const [partsCost] = await tx
    .select({
      amount:
        sql<number>`coalesce(sum(case when ${stockMovements.type} = 'ISSUE' then ${stockMovements.quantity} * ${stockMovements.unitCost} when ${stockMovements.type} = 'RETURN' then -${stockMovements.quantity} * ${stockMovements.unitCost} else 0 end), 0)`.mapWith(
          Number,
        ),
    })
    .from(stockMovements)
    .where(eq(stockMovements.workOrderId, wo.id));
  const [other] = await tx
    .select({ amount: sql<number>`coalesce(sum(${workOrderCosts.amount}), 0)`.mapWith(Number) })
    .from(workOrderCosts)
    // HAB-04 : une dépense en attente ou refusée n'est pas comptée.
    .where(and(eq(workOrderCosts.workOrderId, wo.id), eq(workOrderCosts.approvalStatus, "APPROVED")));
  const external = wo.externalCost ?? 0;
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    labor: round(labor.amount),
    parts: round(partsCost.amount),
    external: round(external),
    other: round(other.amount),
    total: round(labor.amount + partsCost.amount + external + other.amount),
    minutes: labor.minutes,
  };
}

/* ------------------------------------------------------------------ */
/* Fiche OT                                                             */
/* ------------------------------------------------------------------ */

async function loadWorkOrder(tx: DbOrTx, ctx: AuthContext, id: string) {
  const [wo] = await tx
    .select()
    .from(workOrders)
    .where(and(eq(workOrders.id, id), eq(workOrders.tenantId, ctx.tenantId)));
  if (!wo) throw new NotFoundError("Ordre de travail");
  return wo;
}

/** Photographie de l'OT pour les contrôles de la machine à états. */
async function buildSnapshot(tx: DbOrTx, wo: WorkOrderRow): Promise<WorkOrderSnapshot> {
  const [eqRow] = await tx.select({ criticality: equipment.criticality }).from(equipment).where(eq(equipment.id, wo.equipmentId));
  const [primaryMeter] = await tx
    .select({ id: meters.id })
    .from(meters)
    .where(and(eq(meters.equipmentId, wo.equipmentId), eq(meters.isPrimary, true)))
    .limit(1);
  // Requêtes successives : `tx` est souvent une transaction (un seul client).
  const assignees = await tx
    .select({ technicianId: workOrderAssignees.technicianId })
    .from(workOrderAssignees)
    .where(eq(workOrderAssignees.workOrderId, wo.id));
  const tasks = await tx
    .select({ required: workOrderTasks.required, result: workOrderTasks.result })
    .from(workOrderTasks)
    .where(eq(workOrderTasks.workOrderId, wo.id));
  const entries = await tx
    .select({ minutes: timeEntries.minutes, endedAt: timeEntries.endedAt })
    .from(timeEntries)
    .where(eq(timeEntries.workOrderId, wo.id));
  const reservationRows = await tx
    .select({ n: count() })
    .from(stockReservations)
    .where(and(eq(stockReservations.workOrderId, wo.id), eq(stockReservations.status, "ACTIVE")));
  const issueRows = await tx
    .select({ n: count() })
    .from(stockMovements)
    .where(and(eq(stockMovements.workOrderId, wo.id), eq(stockMovements.type, "ISSUE")));
  const pendingExpenseRows = await tx
    .select({ n: count() })
    .from(workOrderCosts)
    .where(and(eq(workOrderCosts.workOrderId, wo.id), eq(workOrderCosts.approvalStatus, "PENDING")));
  const readingRows = primaryMeter
    ? await tx
        .select({ n: count() })
        .from(meterReadings)
        .where(
          and(
            eq(meterReadings.meterId, primaryMeter.id),
            ne(meterReadings.status, "REJECTED"),
            or(eq(meterReadings.workOrderId, wo.id), wo.startedAt ? gte(meterReadings.readAt, wo.startedAt) : sql`false`),
          ),
        )
    : [{ n: 0 }];
  return {
    status: wo.status,
    isExternal: wo.isExternal,
    isSafetyRelated: wo.isSafetyRelated,
    equipmentCriticality: eqRow?.criticality ?? "C",
    equipmentHasMeter: !!primaryMeter,
    plannedStart: wo.plannedStart,
    assigneeTechnicianIds: assignees.map((a) => a.technicianId),
    hasSupplier: !!wo.supplierId,
    techClosedAt: wo.techClosedAt,
    hasWorkDescription: !!wo.workSummary?.trim() || tasks.some((t) => t.result !== null),
    requiredTasksIncomplete: tasks.filter((t) => t.required && t.result === null).length,
    totalMinutes: entries.reduce((s, e) => s + (e.minutes ?? 0), 0),
    hasOpenTimeEntry: entries.some((e) => e.endedAt === null),
    hasMeterReadingSinceStart: (readingRows[0]?.n ?? 0) > 0,
    activeReservations: reservationRows[0]?.n ?? 0,
    consumedPartLines: issueRows[0]?.n ?? 0,
    timeEntryCount: entries.length,
    externalCostKnown: wo.externalCost !== null,
    pendingExpenses: pendingExpenseRows[0]?.n ?? 0,
  };
}

function actorFor(ctx: AuthContext, wo: WorkOrderRow): TransitionInput["actor"] {
  return {
    userId: ctx.userId,
    technicianId: ctx.technicianId,
    canManage: ctx.canOn("workorder.manage", wo),
    canReleaseCriticalEquipment: ctx.canOn("workorder.release", wo),
  };
}

export async function getWorkOrder(ctx: AuthContext, id: string) {
  const wo = await db.query.workOrders.findFirst({
    where: and(eq(workOrders.id, id), eq(workOrders.tenantId, ctx.tenantId)),
    with: {
      equipment: { columns: { id: true, code: true, name: true, status: true, criticality: true, manufacturer: true } },
      site: { columns: { id: true, name: true } },
      workshop: { columns: { id: true, name: true } },
      jobsite: { columns: { id: true, name: true } },
      supplier: { columns: { id: true, name: true } },
      dueItem: { columns: { id: true, dueDate: true, dueMeterValue: true } },
      releaseValidatedBy: { columns: { name: true } },
      assignees: { with: { technician: { columns: { id: true, firstName: true, lastName: true } } } },
      tasks: { orderBy: asc(workOrderTasks.position) },
      timeEntries: { orderBy: desc(timeEntries.startedAt), with: { technician: { columns: { firstName: true, lastName: true } } } },
      statusHistory: { orderBy: desc(workOrderStatusHistory.changedAt), with: { changedBy: { columns: { name: true } } } },
      costs: true,
    },
  });
  if (!wo) throw new NotFoundError("Ordre de travail");
  assertCanOn(ctx, "workorder.read", wo);

  const [partLines, reservations, meterRows, costs, snapshot, requests] = await Promise.all([
    db
      .select({
        id: stockMovements.id,
        type: stockMovements.type,
        quantity: stockMovements.quantity,
        unitCost: stockMovements.unitCost,
        createdAt: stockMovements.createdAt,
        partId: parts.id,
        sku: parts.sku,
        partName: parts.name,
        unit: parts.unit,
        warehouseId: warehouses.id,
        warehouseName: warehouses.name,
      })
      .from(stockMovements)
      .innerJoin(parts, eq(parts.id, stockMovements.partId))
      .innerJoin(warehouses, eq(warehouses.id, stockMovements.warehouseId))
      .where(eq(stockMovements.workOrderId, id))
      .orderBy(desc(stockMovements.createdAt)),
    db
      .select({
        id: stockReservations.id,
        quantity: stockReservations.quantity,
        consumedQuantity: stockReservations.consumedQuantity,
        status: stockReservations.status,
        sku: parts.sku,
        partName: parts.name,
        warehouseName: warehouses.name,
      })
      .from(stockReservations)
      .innerJoin(parts, eq(parts.id, stockReservations.partId))
      .innerJoin(warehouses, eq(warehouses.id, stockReservations.warehouseId))
      .where(eq(stockReservations.workOrderId, id)),
    db.select().from(meters).where(eq(meters.equipmentId, wo.equipmentId)).orderBy(desc(meters.isPrimary)),
    costSummary(db, wo),
    buildSnapshot(db, wo),
    db
      .select({ id: workRequests.id, number: workRequests.number, symptom: workRequests.symptom, status: workRequests.status })
      .from(workRequests)
      .where(eq(workRequests.workOrderId, id)),
  ]);

  const [expenseApprovals, purchaseRequestRows] = await Promise.all([
    approvalTimeline(
      ctx,
      "MAINTENANCE_EXPENSE",
      wo.costs.map((c) => c.id),
    ),
    listPurchaseRequestsForWorkOrder(ctx, wo.id),
  ]);

  const actor = actorFor(ctx, wo);
  const transitions = ALLOWED_TRANSITIONS[wo.status].map((to) => {
    const check = checkTransition(snapshot, { to, actor, testsPassed: true, reason: "-", holdReason: "OTHER" });
    return { to, allowed: check.ok, errors: check.ok ? [] : check.errors };
  });

  return {
    ...wo,
    partLines,
    reservations,
    requests,
    /** Lignes « autres coûts » (le champ `costs` porte la synthèse des coûts). */
    costRows: wo.costs,
    /** Validations des dépenses (HAB-04) et demandes d'achat rattachées (ACH-01). */
    expenseApprovals,
    purchaseRequests: purchaseRequestRows,
    meters: meterRows,
    costs,
    snapshot,
    transitions,
    requiresRelease: requiresReleaseValidation(snapshot),
    canExecute: ctx.canOn("workorder.execute", wo),
    canManage: actor.canManage,
  };
}

/* ------------------------------------------------------------------ */
/* Création et planification                                           */
/* ------------------------------------------------------------------ */

export const workOrderInput = z.object({
  equipmentId: z.uuid("Équipement obligatoire"),
  type: z.enum(["PREVENTIVE", "CORRECTIVE", "REGULATORY", "IMPROVEMENT", "ACCIDENT"]).default("CORRECTIVE"),
  priority: z.enum(["P1", "P2", "P3", "P4"]).default("P3"),
  title: text(200, "Intitulé obligatoire"),
  description: optionalText(4000),
  isImmobilizing: bool.default(false),
  isSafetyRelated: bool.default(false),
  workshopId: optionalId,
  jobsiteId: optionalId,
  isExternal: bool.default(false),
  supplierId: optionalId,
  plannedStart: optionalDate,
  plannedEnd: optionalDate,
  estimatedMinutes: optionalNumber,
  assigneeIds: z.array(z.uuid()).default([]),
});

/** Création manuelle d'un OT (COR-05). Un OT correctif immobilisant immobilise l'équipement (CDC §5.5). */
export async function createWorkOrder(ctx: AuthContext, raw: unknown) {
  const input = parseInput(workOrderInput, raw);
  const [eqRow] = await db
    .select()
    .from(equipment)
    .where(and(eq(equipment.id, input.equipmentId), eq(equipment.tenantId, ctx.tenantId)));
  if (!eqRow) throw new NotFoundError("Équipement");
  assertCanOn(ctx, "workorder.create", eqRow);
  if (eqRow.status === "RETIRED") throw new BusinessRuleError(["Aucun OT sur un équipement réformé (DON-14)."]);
  if (input.isExternal && !input.supplierId) throw new BusinessRuleError(["Un OT externe nécessite un prestataire."]);

  return db.transaction(async (tx) => {
    const wo = await insertWorkOrder(tx, ctx, {
      ...input,
      companyId: eqRow.companyId,
      siteId: eqRow.siteId,
      assigneeTechnicianIds: input.assigneeIds,
    });
    if (input.isImmobilizing && input.type !== "PREVENTIVE" && input.type !== "REGULATORY") {
      await setEquipmentStatus(tx, ctx, eqRow.id, "IMMOBILIZED", { reason: `OT ${wo.number}`, workOrderId: wo.id });
      await openDowntime(tx, ctx, { equipmentId: eqRow.id, reason: input.isSafetyRelated ? "SAFETY" : "BREAKDOWN", workOrderId: wo.id });
    }
    return wo;
  });
}

export const planningInput = z.object({
  priority: z.enum(["P1", "P2", "P3", "P4"]).optional(),
  plannedStart: optionalDate,
  plannedEnd: optionalDate,
  estimatedMinutes: optionalNumber,
  workshopId: optionalId,
  jobsiteId: optionalId,
  isExternal: bool.optional(),
  supplierId: optionalId,
  assigneeIds: z.array(z.uuid()).optional(),
});

/**
 * Planification et affectation (PLA-01, COR-08), avec détection des conflits (PLA-07) :
 * absence = blocage ; chevauchement d'OT d'un technicien = avertissement renvoyé.
 */
export async function updatePlanning(ctx: AuthContext, id: string, raw: unknown) {
  const input = parseInput(planningInput, raw);
  const wo = await loadWorkOrder(db, ctx, id);
  assertCanOn(ctx, "workorder.manage", wo);
  if (!(OPEN_STATUSES as readonly string[]).includes(wo.status)) throw new BusinessRuleError(["Cet OT n'est plus planifiable."]);

  const plannedStart = input.plannedStart ?? wo.plannedStart;
  // Fin prévue : saisie, sinon recalculée dès que le début ou la durée change (début + durée estimée).
  let plannedEnd: Date | null;
  if (input.plannedEnd) plannedEnd = input.plannedEnd;
  else if (!plannedStart) plannedEnd = null;
  else if (input.plannedStart || input.estimatedMinutes !== undefined || !wo.plannedEnd) {
    plannedEnd = new Date(plannedStart.getTime() + (input.estimatedMinutes ?? wo.estimatedMinutes ?? 120) * 60_000);
  } else plannedEnd = wo.plannedEnd;
  if (plannedStart && plannedEnd && plannedEnd <= plannedStart) {
    throw new BusinessRuleError(["La fin prévue doit être postérieure au début."]);
  }
  const warnings: string[] = [];

  if (input.assigneeIds && input.assigneeIds.length > 0 && plannedStart && plannedEnd) {
    const absent = await db
      .select({ technicianId: absences.technicianId, firstName: technicians.firstName, lastName: technicians.lastName })
      .from(absences)
      .innerJoin(technicians, eq(technicians.id, absences.technicianId))
      .where(and(inArray(absences.technicianId, input.assigneeIds), lte(absences.startAt, plannedEnd), gte(absences.endAt, plannedStart)));
    if (absent.length > 0) {
      throw new BusinessRuleError(absent.map((a) => `${a.firstName} ${a.lastName} est absent(e) sur ce créneau.`));
    }
    const overlapping = await db
      .select({ number: workOrders.number, firstName: technicians.firstName, lastName: technicians.lastName })
      .from(workOrderAssignees)
      .innerJoin(workOrders, eq(workOrders.id, workOrderAssignees.workOrderId))
      .innerJoin(technicians, eq(technicians.id, workOrderAssignees.technicianId))
      .where(
        and(
          inArray(workOrderAssignees.technicianId, input.assigneeIds),
          ne(workOrders.id, id),
          inArray(workOrders.status, ["PLANNED", "IN_PROGRESS", "ON_HOLD"]),
          lte(workOrders.plannedStart, plannedEnd),
          gte(workOrders.plannedEnd, plannedStart),
        ),
      );
    for (const o of overlapping) warnings.push(`${o.firstName} ${o.lastName} est déjà planifié(e) sur ${o.number}.`);
  }

  await db.transaction(async (tx) => {
    const { assigneeIds, ...fields } = input;
    const [row] = await tx
      .update(workOrders)
      .set({ ...fields, plannedStart, plannedEnd })
      .where(eq(workOrders.id, id))
      .returning();
    if (assigneeIds) {
      await tx.delete(workOrderAssignees).where(eq(workOrderAssignees.workOrderId, id));
      if (assigneeIds.length > 0) {
        await tx.insert(workOrderAssignees).values([...new Set(assigneeIds)].map((technicianId) => ({ workOrderId: id, technicianId })));
      }
    }
    await audit(tx, ctx, { entityType: "work_order", entityId: id, action: "plan", before: wo, after: { ...row, assigneeIds } });
  });
  return { warnings };
}

/* ------------------------------------------------------------------ */
/* Transitions de statut (COR-06, COR-12, COR-13, COR-14)              */
/* ------------------------------------------------------------------ */

export const transitionSchema = z.object({
  to: z.enum(["CREATED", "PLANNED", "ON_HOLD", "IN_PROGRESS", "WORK_DONE", "TECH_CLOSED", "CLOSED", "CANCELLED"]),
  reason: optionalText(1000),
  holdReason: z.enum(["PARTS", "CONTRACTOR", "ACCESS", "QUOTE", "OTHER"]).optional(),
  testsPassed: bool.default(false),
  outcome: z.enum(["RESOLVED", "DIAGNOSTIC_ONLY", "NO_FOLLOW_UP"]).optional(),
});

export async function transitionWorkOrder(ctx: AuthContext, id: string, raw: unknown, now: Date = new Date()) {
  const input = parseInput(transitionSchema, raw);
  return db.transaction(async (tx) => {
    const [wo] = await tx
      .select()
      .from(workOrders)
      .where(and(eq(workOrders.id, id), eq(workOrders.tenantId, ctx.tenantId)))
      .for("update");
    if (!wo) throw new NotFoundError("Ordre de travail");
    assertCanOn(ctx, "workorder.read", wo);

    const snapshot = await buildSnapshot(tx, wo);
    const check = checkTransition(snapshot, { ...input, actor: actorFor(ctx, wo) }, now);
    if (!check.ok) throw new BusinessRuleError(check.errors);

    const to = input.to as WorkOrderStatus;
    const from = wo.status;
    const patch: Partial<typeof workOrders.$inferInsert> = { status: to };

    switch (to) {
      case "PLANNED":
        patch.holdReason = null;
        patch.holdComment = null;
        break;
      case "ON_HOLD":
        patch.holdReason = input.holdReason ?? "OTHER";
        patch.holdComment = input.reason ?? null;
        break;
      case "IN_PROGRESS":
        patch.holdReason = null;
        patch.holdComment = null;
        if (!wo.startedAt) patch.startedAt = now;
        if (from === "TECH_CLOSED") {
          patch.reopenCount = wo.reopenCount + 1;
          patch.techClosedAt = null;
          patch.releaseValidatedById = null;
          patch.releaseValidatedAt = null;
        }
        break;
      case "WORK_DONE":
        patch.workDoneAt = now;
        if (input.outcome) patch.outcome = input.outcome;
        break;
      case "TECH_CLOSED":
        patch.techClosedAt = now;
        patch.outcome = input.outcome ?? wo.outcome ?? "RESOLVED";
        if (requiresReleaseValidation(snapshot)) {
          patch.releaseValidatedById = ctx.userId;
          patch.releaseValidatedAt = now;
        }
        break;
      case "CLOSED":
        patch.closedAt = now;
        break;
      case "CANCELLED":
        patch.cancelledAt = now;
        patch.cancelReason = input.reason ?? null;
        break;
    }

    const [updated] = await tx.update(workOrders).set(patch).where(eq(workOrders.id, id)).returning();
    await tx.insert(workOrderStatusHistory).values({
      workOrderId: id,
      fromStatus: from,
      toStatus: to,
      reason: input.reason ?? input.holdReason ?? null,
      changedById: ctx.userId,
    });

    await applyEquipmentEffects(tx, ctx, updated, from, to, now);

    if (to === "WORK_DONE" && requiresReleaseValidation(snapshot)) {
      await notifyByPermission(
        tx,
        ctx.tenantId,
        "workorder.release",
        wo,
        {
          type: "work_order.release_requested",
          title: `Remise en service à valider : ${wo.number}`,
          body: wo.title,
          entityType: "work_order",
          entityId: wo.id,
        },
        { excludeUserId: ctx.userId },
      );
    }

    await audit(tx, ctx, { entityType: "work_order", entityId: id, action: `status:${from}->${to}`, before: { status: from }, after: patch });
    return updated;
  });
}

/** Effets d'une transition sur l'équipement, les immobilisations, les réservations et le préventif. */
async function applyEquipmentEffects(tx: DbOrTx, ctx: AuthContext, wo: WorkOrderRow, from: WorkOrderStatus, to: WorkOrderStatus, now: Date) {
  const [eqRow] = await tx.select({ status: equipment.status }).from(equipment).where(eq(equipment.id, wo.equipmentId));
  if (!eqRow) return;

  if (to === "IN_PROGRESS" && wo.isImmobilizing && eqRow.status !== "IMMOBILIZED") {
    // Maintenance programmée en cours : En maintenance (CDC §3.2)
    await setEquipmentStatus(tx, ctx, wo.equipmentId, "IN_MAINTENANCE", { reason: `OT ${wo.number}`, workOrderId: wo.id });
    await openDowntime(tx, ctx, { equipmentId: wo.equipmentId, reason: "PLANNED_MAINTENANCE", workOrderId: wo.id, startedAt: now });
  }

  if (to === "TECH_CLOSED") {
    const [primary] = await tx
      .select({ lastValue: meters.lastValue, lastCumulativeValue: meters.lastCumulativeValue })
      .from(meters)
      .where(and(eq(meters.equipmentId, wo.equipmentId), eq(meters.isPrimary, true)));
    if (primary) await tx.update(workOrders).set({ meterValueAtClose: primary.lastValue }).where(eq(workOrders.id, wo.id));
    // L'échéance préventive est soldée avant la remise en service : une VGP réalisée lève le blocage (PRV-12).
    if (wo.dueItemId) {
      const [item] = await tx.select({ meterId: dueItems.meterId }).from(dueItems).where(eq(dueItems.id, wo.dueItemId));
      const [m] = item?.meterId ? await tx.select({ v: meters.lastCumulativeValue }).from(meters).where(eq(meters.id, item.meterId)) : [];
      await completeDueItem(tx, ctx, wo.dueItemId, { date: now, meter: m?.v ?? null });
    }
  }

  if (to === "CANCELLED") {
    await releaseReservations(tx, wo.id);
    if (wo.dueItemId) await tx.update(dueItems).set({ workOrderId: null }).where(eq(dueItems.id, wo.dueItemId));
  }

  // L'équipement ne redevient apte que si plus rien ne le retient : autre OT immobilisant ouvert,
  // DI qualifiée « immobilisante », contrôle réglementaire bloquant échu (CDC §5.5, PRV-12).
  if ((to === "TECH_CLOSED" || to === "CANCELLED") && wo.isImmobilizing) {
    await releaseEquipmentIfFree(tx, ctx, wo.equipmentId, {
      reason: to === "TECH_CLOSED" ? `Remise en service — OT ${wo.number}` : `OT ${wo.number} annulé`,
      workOrderId: wo.id,
      excludeWorkOrderId: wo.id,
      at: now,
    });
  }

  if (from === "TECH_CLOSED" && to === "IN_PROGRESS" && wo.isImmobilizing) {
    await setEquipmentStatus(tx, ctx, wo.equipmentId, "IMMOBILIZED", { reason: `Réouverture OT ${wo.number}`, workOrderId: wo.id });
    await openDowntime(tx, ctx, { equipmentId: wo.equipmentId, reason: "BREAKDOWN", workOrderId: wo.id, startedAt: now });
  }
}

/** Crée un OT de récidive lié quand la réouverture n'est plus possible (COR-14). */
export async function createRecurrence(ctx: AuthContext, id: string) {
  const wo = await loadWorkOrder(db, ctx, id);
  assertCanOn(ctx, "workorder.manage", wo);
  return db.transaction((tx) =>
    insertWorkOrder(tx, ctx, {
      companyId: wo.companyId,
      siteId: wo.siteId,
      equipmentId: wo.equipmentId,
      type: wo.type === "PREVENTIVE" ? "CORRECTIVE" : wo.type,
      priority: wo.priority,
      title: `Récidive — ${wo.title}`,
      description: `Récidive de l'OT ${wo.number}.`,
      isImmobilizing: wo.isImmobilizing,
      isSafetyRelated: wo.isSafetyRelated,
      parentWorkOrderId: wo.id,
    }),
  );
}

/* ------------------------------------------------------------------ */
/* Exécution : temps, tâches, compte rendu, pièces, coûts              */
/* ------------------------------------------------------------------ */

async function assertExecutable(ctx: AuthContext, wo: WorkOrderRow, allowed: WorkOrderStatus[]) {
  assertCanOn(ctx, "workorder.execute", wo);
  if (!allowed.includes(wo.status)) {
    throw new BusinessRuleError([`Action impossible au statut actuel de l'OT.`]);
  }
}

async function rateAt(tx: DbOrTx, technicianId: string, at: Date) {
  const [rate] = await tx
    .select({ hourlyRate: laborRates.hourlyRate })
    .from(laborRates)
    .where(and(eq(laborRates.technicianId, technicianId), lte(laborRates.validFrom, at)))
    .orderBy(desc(laborRates.validFrom))
    .limit(1);
  return rate?.hourlyRate ?? null;
}

export const timeEntryInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), technicianId: optionalId, clientId: z.string().trim().min(8).max(100).optional() }),
  z.object({ action: z.literal("stop"), technicianId: optionalId }),
  z.object({
    action: z.literal("manual"),
    technicianId: optionalId,
    minutes: z.coerce
      .number({ error: "Durée obligatoire" })
      .int()
      .min(1, "Durée obligatoire")
      .max(24 * 60),
    startedAt: optionalDate,
    comment: optionalText(500),
    clientId: z.string().trim().min(8).max(100).optional(),
  }),
]);

/**
 * Pointage (COR-09) : démarrer / arrêter le chronomètre ou saisir une durée.
 * Un technicien ne pointe qu'un OT à la fois : démarrer un pointage arrête le précédent [AC].
 */
export async function recordTime(ctx: AuthContext, id: string, raw: unknown, now: Date = new Date()) {
  const input = parseInput(timeEntryInput, raw);
  return db.transaction(async (tx) => {
    const wo = await loadWorkOrder(tx, ctx, id);
    await assertExecutable(ctx, wo, input.action === "manual" ? ["IN_PROGRESS", "WORK_DONE", "ON_HOLD"] : ["IN_PROGRESS"]);
    const technicianId = input.technicianId ?? ctx.technicianId;
    if (!technicianId) throw new BusinessRuleError(["Aucun technicien associé à ce compte."]);
    if (input.technicianId && input.technicianId !== ctx.technicianId) assertCanOn(ctx, "workorder.manage", wo);

    if (input.action === "start") {
      if (input.clientId) {
        const [dup] = await tx
          .select()
          .from(timeEntries)
          .where(and(eq(timeEntries.tenantId, ctx.tenantId), eq(timeEntries.clientId, input.clientId)));
        if (dup) return dup;
      }
      const open = await tx
        .select()
        .from(timeEntries)
        .where(and(eq(timeEntries.technicianId, technicianId), isNull(timeEntries.endedAt)));
      for (const entry of open) {
        await tx
          .update(timeEntries)
          .set({ endedAt: now, minutes: Math.max(Math.round((now.getTime() - entry.startedAt.getTime()) / 60_000), 1) })
          .where(eq(timeEntries.id, entry.id));
      }
      const [row] = await tx
        .insert(timeEntries)
        .values({
          tenantId: ctx.tenantId,
          workOrderId: id,
          technicianId,
          startedAt: now,
          hourlyRate: await rateAt(tx, technicianId, now),
          clientId: input.clientId ?? null,
          createdById: ctx.userId,
        })
        .returning();
      return row;
    }

    if (input.action === "stop") {
      const [open] = await tx
        .select()
        .from(timeEntries)
        .where(and(eq(timeEntries.workOrderId, id), eq(timeEntries.technicianId, technicianId), isNull(timeEntries.endedAt)));
      if (!open) throw new BusinessRuleError(["Aucun pointage en cours sur cet OT."]);
      const [row] = await tx
        .update(timeEntries)
        .set({ endedAt: now, minutes: Math.max(Math.round((now.getTime() - open.startedAt.getTime()) / 60_000), 1) })
        .where(eq(timeEntries.id, open.id))
        .returning();
      return row;
    }

    if (input.clientId) {
      const [dup] = await tx
        .select()
        .from(timeEntries)
        .where(and(eq(timeEntries.tenantId, ctx.tenantId), eq(timeEntries.clientId, input.clientId)));
      if (dup) return dup;
    }
    const startedAt = input.startedAt ?? new Date(now.getTime() - input.minutes * 60_000);
    const [row] = await tx
      .insert(timeEntries)
      .values({
        tenantId: ctx.tenantId,
        workOrderId: id,
        technicianId,
        startedAt,
        endedAt: new Date(startedAt.getTime() + input.minutes * 60_000),
        minutes: input.minutes,
        hourlyRate: await rateAt(tx, technicianId, startedAt),
        comment: input.comment ?? null,
        clientId: input.clientId ?? null,
        createdById: ctx.userId,
      })
      .returning();
    await audit(tx, ctx, { entityType: "time_entry", entityId: row.id, action: "create", after: row });
    return row;
  });
}

export const taskResultInput = z.object({
  result: z.enum(["OK", "NOK", "NA"]).optional(),
  measuredValue: optionalNumber,
  comment: optionalText(500),
});

/** Renseigne un point de checklist ; une mesure hors bornes rend le point non conforme (PRV-11). */
export async function updateTask(ctx: AuthContext, id: string, taskId: string, raw: unknown) {
  const input = parseInput(taskResultInput, raw);
  return db.transaction(async (tx) => {
    const wo = await loadWorkOrder(tx, ctx, id);
    await assertExecutable(ctx, wo, ["IN_PROGRESS", "WORK_DONE"]);
    const [task] = await tx
      .select()
      .from(workOrderTasks)
      .where(and(eq(workOrderTasks.id, taskId), eq(workOrderTasks.workOrderId, id)));
    if (!task) throw new NotFoundError("Point de checklist");
    let result = input.result ?? null;
    let outOfBounds = false;
    if (task.kind === "MEASURE" && input.measuredValue !== undefined) {
      outOfBounds =
        (task.minValue !== null && input.measuredValue < task.minValue) || (task.maxValue !== null && input.measuredValue > task.maxValue);
      result = outOfBounds ? "NOK" : (result ?? "OK");
    }
    const [row] = await tx
      .update(workOrderTasks)
      .set({ result, measuredValue: input.measuredValue ?? null, comment: input.comment ?? null, doneById: ctx.userId, doneAt: new Date() })
      .where(eq(workOrderTasks.id, taskId))
      .returning();
    return { task: row, outOfBounds };
  });
}

export async function addTask(ctx: AuthContext, id: string, raw: unknown) {
  const input = parseInput(z.object({ label: text(300, "Libellé obligatoire"), required: bool.default(false) }), raw);
  return db.transaction(async (tx) => {
    const wo = await loadWorkOrder(tx, ctx, id);
    await assertExecutable(ctx, wo, ["CREATED", "PLANNED", "ON_HOLD", "IN_PROGRESS"]);
    const [{ max }] = await tx
      .select({ max: sql<number>`coalesce(max(${workOrderTasks.position}), 0)`.mapWith(Number) })
      .from(workOrderTasks)
      .where(eq(workOrderTasks.workOrderId, id));
    const [row] = await tx
      .insert(workOrderTasks)
      .values({ workOrderId: id, position: max + 1, label: input.label, required: input.required })
      .returning();
    return row;
  });
}

export const reportInput = z.object({
  workSummary: optionalText(4000),
  symptomCode: z.string().trim().max(40).optional(),
  causeCode: z.string().trim().max(40).optional(),
  remedyCode: z.string().trim().max(40).optional(),
});

/** Compte rendu et codification des défauts (COR-04, COR-11). */
export async function updateReport(ctx: AuthContext, id: string, raw: unknown) {
  const input = parseInput(reportInput, raw);
  return db.transaction(async (tx) => {
    const wo = await loadWorkOrder(tx, ctx, id);
    await assertExecutable(ctx, wo, ["IN_PROGRESS", "WORK_DONE", "ON_HOLD"]);
    const [row] = await tx.update(workOrders).set(input).where(eq(workOrders.id, id)).returning();
    await audit(tx, ctx, { entityType: "work_order", entityId: id, action: "report", before: wo, after: input });
    return row;
  });
}

export const partLineInput = z.object({
  action: z.enum(["reserve", "issue", "return"]),
  partId: z.uuid("Article obligatoire"),
  warehouseId: z.uuid("Magasin obligatoire"),
  quantity: z.coerce.number({ error: "Quantité obligatoire" }).positive("La quantité doit être positive"),
  clientId: z.string().trim().min(8).max(100).optional(),
});

/** Pièces sur OT (COR-10, STK-05) : aucune consommation sur un OT annulé ou clôturé (règle 4 de §7.5). */
export async function recordPart(ctx: AuthContext, id: string, raw: unknown) {
  const input = parseInput(partLineInput, raw);
  return db.transaction(async (tx) => {
    const wo = await loadWorkOrder(tx, ctx, id);
    const [wh] = await tx
      .select({ siteId: warehouses.siteId, companyId: sites.companyId })
      .from(warehouses)
      .innerJoin(sites, eq(sites.id, warehouses.siteId))
      .where(and(eq(warehouses.id, input.warehouseId), eq(warehouses.tenantId, ctx.tenantId)));
    if (!wh) throw new NotFoundError("Magasin");
    if (input.action === "reserve") {
      assertCanOn(ctx, "workorder.manage", wo);
      if (!["CREATED", "PLANNED", "ON_HOLD", "IN_PROGRESS"].includes(wo.status))
        throw new BusinessRuleError(["Réservation impossible au statut actuel."]);
      return reserveForWorkOrder(tx, ctx, { workOrderId: id, partId: input.partId, warehouseId: input.warehouseId, quantity: input.quantity });
    }
    await assertExecutable(ctx, wo, ["IN_PROGRESS", "WORK_DONE"]);
    if (input.action === "issue") {
      return issueToWorkOrder(tx, ctx, {
        workOrderId: id,
        partId: input.partId,
        warehouseId: input.warehouseId,
        quantity: input.quantity,
        clientId: input.clientId,
      });
    }
    return returnFromWorkOrder(tx, ctx, { workOrderId: id, partId: input.partId, warehouseId: input.warehouseId, quantity: input.quantity });
  });
}

export async function releaseWorkOrderReservations(ctx: AuthContext, id: string) {
  return db.transaction(async (tx) => {
    const wo = await loadWorkOrder(tx, ctx, id);
    assertCanOn(ctx, "workorder.execute", wo);
    return releaseReservations(tx, id);
  });
}

export const externalCostInput = z.object({
  supplierId: optionalId,
  externalCost: z.coerce.number({ error: "Montant obligatoire" }).min(0),
  externalCostIsFinal: bool.default(false),
});

/** Coût prestataire (COR-15, ACH-10) : provision puis montant facturé. */
export async function setExternalCost(ctx: AuthContext, id: string, raw: unknown) {
  const input = parseInput(externalCostInput, raw);
  return db.transaction(async (tx) => {
    const wo = await loadWorkOrder(tx, ctx, id);
    assertCanOn(ctx, "workorder.manage", wo);
    if (wo.status === "CLOSED" || wo.status === "CANCELLED")
      throw new BusinessRuleError(["Les coûts d'un OT clôturé ne sont plus modifiables (COR-13)."]);
    if (input.supplierId) {
      const [s] = await tx
        .select({ id: suppliers.id })
        .from(suppliers)
        .where(and(eq(suppliers.id, input.supplierId), eq(suppliers.tenantId, ctx.tenantId)));
      if (!s) throw new NotFoundError("Prestataire");
    }
    const [row] = await tx
      .update(workOrders)
      .set({
        externalCost: input.externalCost,
        externalCostIsFinal: input.externalCostIsFinal,
        supplierId: input.supplierId ?? wo.supplierId,
        isExternal: true,
      })
      .where(eq(workOrders.id, id))
      .returning();
    await audit(tx, ctx, {
      entityType: "work_order",
      entityId: id,
      action: "external_cost",
      before: { externalCost: wo.externalCost },
      after: input,
    });
    return row;
  });
}

/**
 * Dépense de maintenance sur un OT (frais, location, prestation ponctuelle). Au-delà des seuils du circuit
 * « dépense de maintenance » (HAB-04), elle reste « à valider » et n'est comptée qu'une fois approuvée.
 */
export async function addOtherCost(ctx: AuthContext, id: string, raw: unknown) {
  const input = parseInput(z.object({ label: text(200, "Libellé obligatoire"), amount: z.coerce.number().min(0) }), raw);
  return db.transaction(async (tx) => {
    const wo = await loadWorkOrder(tx, ctx, id);
    assertCanOn(ctx, "workorder.manage", wo);
    if (wo.status === "CLOSED" || wo.status === "CANCELLED")
      throw new BusinessRuleError(["Les coûts d'un OT clôturé ne sont plus modifiables (COR-13)."]);
    const [row] = await tx
      .insert(workOrderCosts)
      .values({ workOrderId: id, ...input, createdById: ctx.userId })
      .returning();
    await audit(tx, ctx, { entityType: "work_order", entityId: id, action: "add_cost", after: row });
    const approval = await startApproval(tx, ctx, {
      objectType: "MAINTENANCE_EXPENSE",
      objectId: row.id,
      companyId: wo.companyId,
      siteId: wo.siteId,
      label: `${wo.number} · ${input.label}`.slice(0, 200),
      amount: input.amount,
      requestedById: ctx.userId,
      entityType: "work_order",
    });
    if (approval) {
      const [pending] = await tx.update(workOrderCosts).set({ approvalStatus: "PENDING" }).where(eq(workOrderCosts.id, row.id)).returning();
      return pending;
    }
    return row;
  });
}

/** Comptages pour le tableau de bord. */
export async function countOpenWorkOrders(ctx: AuthContext) {
  if (!ctx.can("workorder.read")) return { byStatus: {}, byPriority: {} };
  const scope = scopeWhere(ctx.scope("workorder.read"), workOrders.companyId, workOrders.siteId);
  const base = and(eq(workOrders.tenantId, ctx.tenantId), inArray(workOrders.status, [...OPEN_STATUSES]), scope);
  const [byStatus, byPriority] = await Promise.all([
    db.select({ key: workOrders.status, n: count() }).from(workOrders).where(base).groupBy(workOrders.status),
    db.select({ key: workOrders.priority, n: count() }).from(workOrders).where(base).groupBy(workOrders.priority),
  ]);
  return {
    byStatus: Object.fromEntries(byStatus.map((r) => [r.key, r.n])) as Record<string, number>,
    byPriority: Object.fromEntries(byPriority.map((r) => [r.key, r.n])) as Record<string, number>,
  };
}

export async function listTechnicianOptions(ctx: AuthContext) {
  return db
    .select({ id: technicians.id, firstName: technicians.firstName, lastName: technicians.lastName, siteId: technicians.siteId })
    .from(technicians)
    .innerJoin(sites, eq(sites.id, technicians.siteId))
    .where(
      and(eq(technicians.tenantId, ctx.tenantId), eq(technicians.active, true), scopeWhere(ctx.scope("workorder.read"), sites.companyId, sites.id)),
    )
    .orderBy(asc(technicians.lastName));
}

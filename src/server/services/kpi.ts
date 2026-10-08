import "server-only";
import { and, asc, count, desc, eq, gte, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { AuthContext } from "@/server/authz/context";
import { db } from "@/server/db";
import {
  downtimes,
  dueItems,
  equipment,
  equipmentCategories,
  meterReadings,
  meters,
  parts,
  stockMovements,
  timeEntries,
  workOrderCosts,
  workOrderStatusHistory,
  workOrders,
  workRequests,
} from "@/server/db/schema";
import { availability, clippedHours, mdt, mtbf, mttr, preventiveCompliance } from "@/server/domain/kpi";
import { assertCan, parseInput, scopeWhere } from "./_shared";
import { countDueItemsByStatus } from "./preventive";
import { countBelowReorder } from "./stock";
import { countOpenWorkOrders } from "./work-orders";
import { optionalDate } from "@/server/validation";

/* ------------------------------------------------------------------ */
/* Tableau de bord                                                      */
/* ------------------------------------------------------------------ */

export async function getDashboard(ctx: AuthContext, now: Date = new Date()) {
  const eqScope = scopeWhere(ctx.scope("equipment.read"), equipment.companyId, equipment.siteId);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [equipmentByStatus, workOrderCounts, dueCounts, requestsToQualify, belowReorder, monthCosts] = await Promise.all([
    db
      .select({ status: equipment.status, n: count() })
      .from(equipment)
      .where(and(eq(equipment.tenantId, ctx.tenantId), eqScope))
      .groupBy(equipment.status),
    countOpenWorkOrders(ctx),
    countDueItemsByStatus(ctx),
    ctx.can("request.read")
      ? db
          .select({ n: count() })
          .from(workRequests)
          .where(
            and(
              eq(workRequests.tenantId, ctx.tenantId),
              eq(workRequests.status, "NEW"),
              scopeWhere(ctx.scope("request.read"), workRequests.companyId, workRequests.siteId),
            ),
          )
          .then((r) => r[0]?.n ?? 0)
      : Promise.resolve(0),
    countBelowReorder(ctx),
    ctx.can("kpi.read") ? maintenanceCosts(ctx, monthStart, now) : Promise.resolve(null),
  ]);

  return {
    equipmentByStatus: Object.fromEntries(equipmentByStatus.map((r) => [r.status, r.n])) as Record<string, number>,
    workOrders: workOrderCounts,
    dueItems: dueCounts,
    requestsToQualify,
    belowReorder,
    monthCosts,
  };
}

/* ------------------------------------------------------------------ */
/* Indicateurs (CDC §9)                                                 */
/* ------------------------------------------------------------------ */

export const indicatorFilters = z.object({
  from: optionalDate,
  to: optionalDate,
  siteId: z.uuid().optional(),
  categoryId: z.uuid().optional(),
});

/** Coûts de maintenance des OT clôturés techniquement sur la période (KPI-01, §9.1). */
export async function maintenanceCosts(ctx: AuthContext, from: Date, to: Date, filters: { siteId?: string; categoryId?: string } = {}) {
  const woWhere = and(
    eq(workOrders.tenantId, ctx.tenantId),
    isNotNull(workOrders.techClosedAt),
    gte(workOrders.techClosedAt, from),
    lt(workOrders.techClosedAt, to),
    scopeWhere(ctx.scope("kpi.read"), workOrders.companyId, workOrders.siteId),
    filters.siteId ? eq(workOrders.siteId, filters.siteId) : undefined,
    filters.categoryId ? eq(equipment.categoryId, filters.categoryId) : undefined,
  );
  const [[labor], [partCost], [external], [other]] = await Promise.all([
    db
      .select({ amount: sql<number>`coalesce(sum(${timeEntries.minutes} / 60.0 * coalesce(${timeEntries.hourlyRate}, 0)), 0)`.mapWith(Number) })
      .from(timeEntries)
      .innerJoin(workOrders, eq(workOrders.id, timeEntries.workOrderId))
      .innerJoin(equipment, eq(equipment.id, workOrders.equipmentId))
      .where(woWhere),
    db
      .select({
        amount:
          sql<number>`coalesce(sum(case when ${stockMovements.type} = 'ISSUE' then ${stockMovements.quantity} * ${stockMovements.unitCost} when ${stockMovements.type} = 'RETURN' then -${stockMovements.quantity} * ${stockMovements.unitCost} else 0 end), 0)`.mapWith(
            Number,
          ),
      })
      .from(stockMovements)
      .innerJoin(workOrders, eq(workOrders.id, stockMovements.workOrderId))
      .innerJoin(equipment, eq(equipment.id, workOrders.equipmentId))
      .where(woWhere),
    db
      .select({ amount: sql<number>`coalesce(sum(${workOrders.externalCost}), 0)`.mapWith(Number) })
      .from(workOrders)
      .innerJoin(equipment, eq(equipment.id, workOrders.equipmentId))
      .where(woWhere),
    db
      .select({ amount: sql<number>`coalesce(sum(${workOrderCosts.amount}), 0)`.mapWith(Number) })
      .from(workOrderCosts)
      .innerJoin(workOrders, eq(workOrders.id, workOrderCosts.workOrderId))
      .innerJoin(equipment, eq(equipment.id, workOrders.equipmentId))
      .where(woWhere),
  ]);
  const round = (n: number) => Math.round(n * 100) / 100;
  const total = labor.amount + partCost.amount + external.amount + other.amount;
  return {
    labor: round(labor.amount),
    parts: round(partCost.amount),
    external: round(external.amount),
    other: round(other.amount),
    total: round(total),
  };
}

/**
 * Indicateurs de la période : disponibilité, MTBF, MTTR, MDT, coûts, respect du préventif,
 * équipements les plus coûteux et consommation de pièces (KPI-03 à KPI-07).
 */
export async function getIndicators(ctx: AuthContext, raw: unknown = {}, now: Date = new Date()) {
  assertCan(ctx, "kpi.read");
  const f = parseInput(indicatorFilters, raw);
  const to = f.to ?? now;
  const from = f.from ?? new Date(to.getTime() - 90 * 86_400_000);
  const periodHours = Math.max((to.getTime() - from.getTime()) / 3_600_000, 1);
  const scope = scopeWhere(ctx.scope("kpi.read"), equipment.companyId, equipment.siteId);
  const eqWhere = and(
    eq(equipment.tenantId, ctx.tenantId),
    scope,
    f.siteId ? eq(equipment.siteId, f.siteId) : undefined,
    f.categoryId ? eq(equipment.categoryId, f.categoryId) : undefined,
  );

  const fleet = await db
    .select({
      id: equipment.id,
      code: equipment.code,
      name: equipment.name,
      categoryId: equipment.categoryId,
      categoryName: equipmentCategories.name,
      status: equipment.status,
    })
    .from(equipment)
    .innerJoin(equipmentCategories, eq(equipmentCategories.id, equipment.categoryId))
    .where(and(eqWhere, sql`${equipment.status} <> 'RETIRED'`));
  const ids = fleet.map((e) => e.id);
  if (ids.length === 0) {
    return {
      from,
      to,
      fleetSize: 0,
      availability: null,
      downtimeHours: 0,
      failures: 0,
      operatingHours: 0,
      mtbf: null,
      mttr: null,
      mdt: null,
      costs: null,
      preventive: null,
      byCategory: [],
      topCost: [],
      topParts: [],
    };
  }

  const [downtimeRows, repairs, holds, usage, costByEquipment, partsUsage, dueRows] = await Promise.all([
    db
      .select({ equipmentId: downtimes.equipmentId, reason: downtimes.reason, startedAt: downtimes.startedAt, endedAt: downtimes.endedAt })
      .from(downtimes)
      .where(and(inArray(downtimes.equipmentId, ids), lt(downtimes.startedAt, to), or(isNull(downtimes.endedAt), gte(downtimes.endedAt, from)))),
    db
      .select({ id: workOrders.id, equipmentId: workOrders.equipmentId, startedAt: workOrders.startedAt, workDoneAt: workOrders.workDoneAt })
      .from(workOrders)
      .where(
        and(
          inArray(workOrders.equipmentId, ids),
          inArray(workOrders.type, ["CORRECTIVE"]),
          isNotNull(workOrders.startedAt),
          isNotNull(workOrders.workDoneAt),
          gte(workOrders.workDoneAt, from),
          lt(workOrders.workDoneAt, to),
        ),
      ),
    db
      .select({
        workOrderId: workOrderStatusHistory.workOrderId,
        toStatus: workOrderStatusHistory.toStatus,
        changedAt: workOrderStatusHistory.changedAt,
      })
      .from(workOrderStatusHistory)
      .innerJoin(workOrders, eq(workOrders.id, workOrderStatusHistory.workOrderId))
      .where(and(inArray(workOrders.equipmentId, ids), gte(workOrderStatusHistory.changedAt, new Date(from.getTime() - 30 * 86_400_000))))
      .orderBy(asc(workOrderStatusHistory.changedAt)),
    db
      .select({
        equipmentId: meters.equipmentId,
        delta: sql<number>`coalesce(max(${meterReadings.cumulativeValue}) - min(${meterReadings.cumulativeValue}), 0)`.mapWith(Number),
      })
      .from(meterReadings)
      .innerJoin(meters, eq(meters.id, meterReadings.meterId))
      .where(
        and(
          inArray(meters.equipmentId, ids),
          eq(meters.type, "HOURS"),
          eq(meterReadings.status, "VALID"),
          gte(meterReadings.readAt, from),
          lt(meterReadings.readAt, to),
        ),
      )
      .groupBy(meters.equipmentId),
    db
      .select({
        equipmentId: workOrders.equipmentId,
        labor:
          sql<number>`coalesce((select sum(te.minutes / 60.0 * coalesce(te.hourly_rate, 0)) from time_entries te where te.work_order_id = "work_orders"."id"), 0)`.mapWith(
            Number,
          ),
        parts:
          sql<number>`coalesce((select sum(case when sm.type = 'ISSUE' then sm.quantity * sm.unit_cost when sm.type = 'RETURN' then -sm.quantity * sm.unit_cost else 0 end) from stock_movements sm where sm.work_order_id = "work_orders"."id"), 0)`.mapWith(
            Number,
          ),
        external:
          sql<number>`coalesce("work_orders"."external_cost", 0) + coalesce((select sum(c.amount) from work_order_costs c where c.work_order_id = "work_orders"."id"), 0)`.mapWith(
            Number,
          ),
      })
      .from(workOrders)
      .where(
        and(
          inArray(workOrders.equipmentId, ids),
          isNotNull(workOrders.techClosedAt),
          gte(workOrders.techClosedAt, from),
          lt(workOrders.techClosedAt, to),
        ),
      ),
    db
      .select({
        partId: parts.id,
        sku: parts.sku,
        name: parts.name,
        unit: parts.unit,
        quantity:
          sql<number>`sum(case when ${stockMovements.type} = 'ISSUE' then ${stockMovements.quantity} else -${stockMovements.quantity} end)`.mapWith(
            Number,
          ),
        value:
          sql<number>`sum(case when ${stockMovements.type} = 'ISSUE' then ${stockMovements.quantity} * ${stockMovements.unitCost} else -${stockMovements.quantity} * ${stockMovements.unitCost} end)`.mapWith(
            Number,
          ),
      })
      .from(stockMovements)
      .innerJoin(parts, eq(parts.id, stockMovements.partId))
      .innerJoin(workOrders, eq(workOrders.id, stockMovements.workOrderId))
      .where(
        and(
          inArray(workOrders.equipmentId, ids),
          inArray(stockMovements.type, ["ISSUE", "RETURN"]),
          gte(stockMovements.createdAt, from),
          lt(stockMovements.createdAt, to),
        ),
      )
      .groupBy(parts.id, parts.sku, parts.name, parts.unit)
      .orderBy(
        desc(
          sql`sum(case when ${stockMovements.type} = 'ISSUE' then ${stockMovements.quantity} * ${stockMovements.unitCost} else -${stockMovements.quantity} * ${stockMovements.unitCost} end)`,
        ),
      )
      .limit(10),
    db
      .select({ status: dueItems.status, dueDate: dueItems.dueDate, baseDate: dueItems.baseDate, completedAt: dueItems.completedAt })
      .from(dueItems)
      .where(and(inArray(dueItems.equipmentId, ids), isNotNull(dueItems.dueDate), gte(dueItems.dueDate, from), lt(dueItems.dueDate, to))),
  ]);

  // Disponibilité : temps requis = 24 h × jours de la période par équipement (convention par défaut, §9.2)
  const downtimeHoursByEquipment = new Map<string, number>();
  for (const d of downtimeRows) {
    const h = clippedHours({ start: d.startedAt, end: d.endedAt }, from, to);
    downtimeHoursByEquipment.set(d.equipmentId, (downtimeHoursByEquipment.get(d.equipmentId) ?? 0) + h);
  }
  const totalDowntime = [...downtimeHoursByEquipment.values()].reduce((a, b) => a + b, 0);
  const failures = downtimeRows.filter((d) => (d.reason === "BREAKDOWN" || d.reason === "SAFETY") && d.startedAt >= from);
  const operatingHours = usage.reduce((s, u) => s + u.delta, 0);

  // MTTR : attentes intermédiaires déduites à partir de l'historique des statuts
  const waitingHours = (woId: string) => {
    let total = 0;
    let holdStart: Date | null = null;
    for (const h of holds.filter((x) => x.workOrderId === woId)) {
      if (h.toStatus === "ON_HOLD") holdStart = h.changedAt;
      else if (holdStart) {
        total += (h.changedAt.getTime() - holdStart.getTime()) / 3_600_000;
        holdStart = null;
      }
    }
    return total;
  };

  const costRows = new Map<string, number>();
  for (const c of costByEquipment) costRows.set(c.equipmentId, (costRows.get(c.equipmentId) ?? 0) + c.labor + c.parts + c.external);

  const categories = new Map<string, { categoryId: string; categoryName: string; count: number; downtime: number; cost: number }>();
  for (const e of fleet) {
    const cat = categories.get(e.categoryId) ?? { categoryId: e.categoryId, categoryName: e.categoryName, count: 0, downtime: 0, cost: 0 };
    cat.count += 1;
    cat.downtime += downtimeHoursByEquipment.get(e.id) ?? 0;
    cat.cost += costRows.get(e.id) ?? 0;
    categories.set(e.categoryId, cat);
  }

  const doneOnTime = dueRows.filter((d) => {
    if (d.status !== "DONE" || !d.completedAt || !d.dueDate) return false;
    const toleranceMs = (d.dueDate.getTime() - d.baseDate.getTime()) * 0.1;
    return d.completedAt.getTime() <= d.dueDate.getTime() + toleranceMs + 86_400_000;
  }).length;
  const dueInPeriod = dueRows.filter((d) => d.dueDate && d.dueDate <= to && d.status !== "SKIPPED" && d.status !== "SUPERSEDED").length;

  return {
    from,
    to,
    fleetSize: fleet.length,
    availability: availability(fleet.length * periodHours, totalDowntime),
    downtimeHours: Math.round(totalDowntime * 10) / 10,
    failures: failures.length,
    operatingHours: Math.round(operatingHours),
    mtbf: mtbf(operatingHours, failures.length),
    mttr: mttr(
      repairs
        .filter((r) => r.startedAt && r.workDoneAt)
        .map((r) => ({ startedAt: r.startedAt!, workDoneAt: r.workDoneAt!, waitingHours: waitingHours(r.id) })),
    ),
    mdt: mdt(
      failures.map((d) => ({ start: d.startedAt, end: d.endedAt })),
      now,
    ),
    costs: await maintenanceCosts(ctx, from, to, f),
    preventive: { compliance: preventiveCompliance(doneOnTime, dueInPeriod), doneOnTime, dueInPeriod },
    byCategory: [...categories.values()]
      .map((c) => ({ ...c, availability: availability(c.count * periodHours, c.downtime), cost: Math.round(c.cost * 100) / 100 }))
      .sort((a, b) => b.cost - a.cost),
    topCost: fleet
      .map((e) => ({
        id: e.id,
        code: e.code,
        name: e.name,
        categoryName: e.categoryName,
        cost: Math.round((costRows.get(e.id) ?? 0) * 100) / 100,
        downtime: Math.round((downtimeHoursByEquipment.get(e.id) ?? 0) * 10) / 10,
      }))
      .filter((e) => e.cost > 0 || e.downtime > 0)
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 10),
    topParts: partsUsage,
  };
}

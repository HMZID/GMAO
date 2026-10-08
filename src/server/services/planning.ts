import "server-only";
import { and, asc, eq, gte, inArray, isNull, lt, lte, or } from "drizzle-orm";
import { z } from "zod";
import type { AuthContext } from "@/server/authz/context";
import { db } from "@/server/db";
import { absences, equipment, sites, technicians, workOrderAssignees, workOrders } from "@/server/db/schema";
import { OPEN_STATUSES } from "@/server/domain/work-order-status";
import { assertCan, parseInput, scopeWhere } from "./_shared";
import { optionalDate } from "@/server/validation";

/** Part de la capacité réservée aux urgences (CDC §6.3) [AC]. */
export const EMERGENCY_RESERVE = 0.15;

export const weekInput = z.object({
  week: optionalDate,
  siteId: z.uuid().optional(),
});

/** Lundi 00:00 UTC de la semaine contenant la date. */
export function startOfWeekUtc(date: Date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - day * 86_400_000);
}

/**
 * Planning hebdomadaire (PLA-01, PLA-02, PLA-04) : OT planifiés par technicien, absences,
 * capacité nette et carnet de commandes non planifié.
 */
export async function getWeekPlanning(ctx: AuthContext, raw: unknown = {}, now: Date = new Date()) {
  assertCan(ctx, "planning.read");
  const input = parseInput(weekInput, raw);
  const weekStart = startOfWeekUtc(input.week ?? now);
  const weekEnd = new Date(weekStart.getTime() + 7 * 86_400_000);
  const scope = scopeWhere(ctx.scope("planning.read"), sites.companyId, sites.id);

  const techs = await db
    .select({
      id: technicians.id,
      firstName: technicians.firstName,
      lastName: technicians.lastName,
      dailyHours: technicians.dailyHours,
      siteName: sites.name,
    })
    .from(technicians)
    .innerJoin(sites, eq(sites.id, technicians.siteId))
    .where(
      and(
        eq(technicians.tenantId, ctx.tenantId),
        eq(technicians.active, true),
        scope,
        input.siteId ? eq(technicians.siteId, input.siteId) : undefined,
      ),
    )
    .orderBy(asc(technicians.lastName));
  const techIds = techs.map((t) => t.id);

  const [planned, absenceRows, backlog] = await Promise.all([
    techIds.length
      ? db
          .select({
            technicianId: workOrderAssignees.technicianId,
            id: workOrders.id,
            number: workOrders.number,
            title: workOrders.title,
            status: workOrders.status,
            priority: workOrders.priority,
            plannedStart: workOrders.plannedStart,
            plannedEnd: workOrders.plannedEnd,
            estimatedMinutes: workOrders.estimatedMinutes,
            equipmentCode: equipment.code,
          })
          .from(workOrderAssignees)
          .innerJoin(workOrders, eq(workOrders.id, workOrderAssignees.workOrderId))
          .innerJoin(equipment, eq(equipment.id, workOrders.equipmentId))
          .where(
            and(
              inArray(workOrderAssignees.technicianId, techIds),
              inArray(workOrders.status, [...OPEN_STATUSES]),
              lt(workOrders.plannedStart, weekEnd),
              or(gte(workOrders.plannedEnd, weekStart), and(isNull(workOrders.plannedEnd), gte(workOrders.plannedStart, weekStart))),
            ),
          )
          .orderBy(asc(workOrders.plannedStart))
      : Promise.resolve([]),
    techIds.length
      ? db
          .select()
          .from(absences)
          .where(and(inArray(absences.technicianId, techIds), lte(absences.startAt, weekEnd), gte(absences.endAt, weekStart)))
      : Promise.resolve([]),
    db
      .select({
        id: workOrders.id,
        number: workOrders.number,
        title: workOrders.title,
        priority: workOrders.priority,
        status: workOrders.status,
        estimatedMinutes: workOrders.estimatedMinutes,
        equipmentCode: equipment.code,
      })
      .from(workOrders)
      .innerJoin(equipment, eq(equipment.id, workOrders.equipmentId))
      .innerJoin(sites, eq(sites.id, workOrders.siteId))
      .where(
        and(
          eq(workOrders.tenantId, ctx.tenantId),
          inArray(workOrders.status, ["CREATED", "ON_HOLD"]),
          scope,
          input.siteId ? eq(workOrders.siteId, input.siteId) : undefined,
        ),
      )
      .orderBy(asc(workOrders.priority), asc(workOrders.createdAt))
      .limit(100),
  ]);

  const days = Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * 86_400_000));
  const rows = techs.map((t) => {
    const techAbsences = absenceRows.filter((a) => a.technicianId === t.id);
    const workingDays = days.slice(0, 5).filter((d) => !techAbsences.some((a) => a.startAt <= new Date(d.getTime() + 86_399_000) && a.endAt >= d));
    const grossHours = workingDays.length * t.dailyHours;
    const capacityHours = Math.round(grossHours * (1 - EMERGENCY_RESERVE) * 10) / 10;
    const orders = planned.filter((p) => p.technicianId === t.id);
    const plannedHours = Math.round((orders.reduce((s, o) => s + (o.estimatedMinutes ?? 120), 0) / 60) * 10) / 10;
    return { ...t, absences: techAbsences, orders, capacityHours, plannedHours, load: capacityHours > 0 ? plannedHours / capacityHours : null };
  });

  return {
    weekStart,
    weekEnd,
    days,
    rows,
    backlog,
    backlogHours: Math.round((backlog.reduce((s, b) => s + (b.estimatedMinutes ?? 120), 0) / 60) * 10) / 10,
  };
}

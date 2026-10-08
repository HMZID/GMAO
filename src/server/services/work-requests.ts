import "server-only";
import { and, count, desc, eq, ilike, inArray, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { AuthContext } from "@/server/authz/context";
import { db } from "@/server/db";
import { equipment, notifications, sites, user, workOrders, workRequests } from "@/server/db/schema";
import { OPEN_STATUSES } from "@/server/domain/work-order-status";
import { BusinessRuleError, NotFoundError } from "@/server/errors";
import { bool, optionalDate, optionalNumber, optionalText, text } from "@/server/validation";
import { assertCan, assertCanOn, audit, offsetOf, paginationSchema, parseInput, scopeWhere } from "./_shared";
import { approvalTimeline, cancelPendingApproval, latestApproval, startApproval } from "./approvals";
import { openDowntime, releaseEquipmentIfFree, setEquipmentStatus } from "./equipment-status";
import { notifyByPermission } from "./notifications";
import { nextNumber } from "./numbering";
import { insertWorkOrder, type Priority } from "./work-order-factory";

type RequestType = NonNullable<(typeof workRequests.$inferSelect)["type"]>;

export const workRequestInput = z.object({
  equipmentId: z.uuid("Équipement obligatoire"),
  symptom: text(200, "Décrire le symptôme"),
  description: optionalText(2000),
  isStopped: bool.default(false),
  isSafetyRisk: bool.default(false),
  meterValue: optionalNumber,
  latitude: optionalNumber,
  longitude: optionalNumber,
  reportedAt: optionalDate,
  /** Idempotence des créations hors connexion (MOB-08). */
  clientId: z.string().trim().min(8).max(100).optional(),
});

const PRIORITIES: Priority[] = ["P1", "P2", "P3", "P4"];

/** Priorité proposée (CDC §5.2), relevée d'un niveau pour un équipement de criticité A (EQP-06). */
export function suggestPriority(input: { isSafetyRisk: boolean; isStopped: boolean; criticality: "A" | "B" | "C" }): Priority {
  const base: Priority = input.isSafetyRisk ? "P1" : input.isStopped ? "P2" : "P3";
  if (input.criticality !== "A") return base;
  return PRIORITIES[Math.max(PRIORITIES.indexOf(base) - 1, 0)];
}

/** Signalement d'une panne (COR-01), avec détection des doublons (COR-02, avertissement non bloquant). */
export async function createWorkRequest(ctx: AuthContext, raw: unknown) {
  const input = parseInput(workRequestInput, raw);
  if (input.clientId) {
    const [existing] = await db
      .select()
      .from(workRequests)
      .where(and(eq(workRequests.tenantId, ctx.tenantId), eq(workRequests.clientId, input.clientId)));
    if (existing) return { request: existing, duplicates: [], idempotent: true as const };
  }

  const [eqRow] = await db
    .select()
    .from(equipment)
    .where(and(eq(equipment.id, input.equipmentId), eq(equipment.tenantId, ctx.tenantId)));
  if (!eqRow) throw new NotFoundError("Équipement");
  assertCanOn(ctx, "request.create", eqRow);
  if (eqRow.status === "RETIRED") throw new BusinessRuleError(["Aucune DI sur un équipement réformé (DON-14)."]);

  const [openRequests, openOrders] = await Promise.all([
    db
      .select({ id: workRequests.id, number: workRequests.number, symptom: workRequests.symptom })
      .from(workRequests)
      .where(and(eq(workRequests.equipmentId, eqRow.id), inArray(workRequests.status, ["NEW", "QUALIFIED"]))),
    db
      .select({ id: workOrders.id, number: workOrders.number, title: workOrders.title })
      .from(workOrders)
      .where(and(eq(workOrders.equipmentId, eqRow.id), inArray(workOrders.status, [...OPEN_STATUSES]))),
  ]);

  const request = await db.transaction(async (tx) => {
    const number = await nextNumber(tx, { tenantId: ctx.tenantId, companyId: eqRow.companyId, kind: "DI" });
    const [row] = await tx
      .insert(workRequests)
      .values({
        tenantId: ctx.tenantId,
        number,
        companyId: eqRow.companyId,
        siteId: eqRow.siteId,
        equipmentId: eqRow.id,
        reportedById: ctx.userId,
        reportedAt: input.reportedAt ?? new Date(),
        symptom: input.symptom,
        description: input.description ?? null,
        isStopped: input.isStopped,
        isSafetyRisk: input.isSafetyRisk,
        meterValue: input.meterValue ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        priority: suggestPriority({ ...input, criticality: eqRow.criticality }),
        clientId: input.clientId ?? null,
      })
      .returning();
    await audit(tx, ctx, { entityType: "work_request", entityId: row.id, action: "create", after: row });
    // HAB-04 : DI soumise au circuit « demande d'intervention » selon sa priorité (P1 par défaut, §2.4).
    await startApproval(tx, ctx, approvalSubject(row, eqRow.code));
    await notifyByPermission(
      tx,
      ctx.tenantId,
      "request.qualify",
      eqRow,
      {
        type: row.priority === "P1" ? "work_request.urgent" : "work_request.created",
        title: `${row.priority === "P1" ? "URGENT — " : ""}Nouvelle DI ${row.number} sur ${eqRow.code}`,
        body: input.symptom,
        entityType: "work_request",
        entityId: row.id,
      },
      { excludeUserId: ctx.userId },
    );
    return row;
  });

  return {
    request,
    duplicates: [
      ...openRequests.map((r) => ({ kind: "work_request" as const, id: r.id, number: r.number, label: r.symptom })),
      ...openOrders.map((o) => ({ kind: "work_order" as const, id: o.id, number: o.number, label: o.title })),
    ],
    idempotent: false as const,
  };
}

export const workRequestFilters = paginationSchema.extend({
  status: z.enum(["NEW", "QUALIFIED", "CONVERTED", "REJECTED", "MERGED", "OPEN"]).default("OPEN"),
  siteId: z.uuid().optional(),
  equipmentId: z.uuid().optional(),
  q: z.string().trim().max(100).optional(),
});

export async function listWorkRequests(ctx: AuthContext, raw: unknown = {}) {
  assertCan(ctx, "request.read");
  const f = parseInput(workRequestFilters, raw);
  const statuses = f.status === "OPEN" ? (["NEW", "QUALIFIED"] as const) : ([f.status] as const);
  const where = and(
    eq(workRequests.tenantId, ctx.tenantId),
    inArray(workRequests.status, [...statuses]),
    scopeWhere(ctx.scope("request.read"), workRequests.companyId, workRequests.siteId),
    f.siteId ? eq(workRequests.siteId, f.siteId) : undefined,
    f.equipmentId ? eq(workRequests.equipmentId, f.equipmentId) : undefined,
    f.q ? or(ilike(workRequests.number, `%${f.q}%`), ilike(workRequests.symptom, `%${f.q}%`), ilike(equipment.code, `%${f.q}%`)) : undefined,
  );
  const [items, [{ total }]] = await Promise.all([
    db
      .select({
        id: workRequests.id,
        number: workRequests.number,
        symptom: workRequests.symptom,
        status: workRequests.status,
        priority: workRequests.priority,
        isStopped: workRequests.isStopped,
        isSafetyRisk: workRequests.isSafetyRisk,
        reportedAt: workRequests.reportedAt,
        equipmentId: equipment.id,
        equipmentCode: equipment.code,
        equipmentName: equipment.name,
        siteName: sites.name,
        reportedByName: user.name,
        workOrderId: workRequests.workOrderId,
      })
      .from(workRequests)
      .innerJoin(equipment, eq(equipment.id, workRequests.equipmentId))
      .innerJoin(sites, eq(sites.id, workRequests.siteId))
      .leftJoin(user, eq(user.id, workRequests.reportedById))
      .where(where)
      .orderBy(workRequests.priority, desc(workRequests.reportedAt))
      .limit(f.pageSize)
      .offset(offsetOf(f)),
    db.select({ total: count() }).from(workRequests).innerJoin(equipment, eq(equipment.id, workRequests.equipmentId)).where(where),
  ]);
  return { items, total, page: f.page, pageSize: f.pageSize };
}

export async function getWorkRequest(ctx: AuthContext, id: string) {
  const row = await db.query.workRequests.findFirst({
    where: and(eq(workRequests.id, id), eq(workRequests.tenantId, ctx.tenantId)),
    with: {
      equipment: { columns: { id: true, code: true, name: true, status: true, criticality: true } },
      site: { columns: { name: true } },
      reportedBy: { columns: { name: true } },
    },
  });
  if (!row) throw new NotFoundError("Demande d'intervention");
  assertCanOn(ctx, "request.read", row);
  const workOrder = row.workOrderId
    ? (
        await db
          .select({ id: workOrders.id, number: workOrders.number, status: workOrders.status })
          .from(workOrders)
          .where(eq(workOrders.id, row.workOrderId))
      )[0]
    : null;
  const openOrders = await db
    .select({ id: workOrders.id, number: workOrders.number, title: workOrders.title, status: workOrders.status })
    .from(workOrders)
    .where(and(eq(workOrders.equipmentId, row.equipmentId), inArray(workOrders.status, [...OPEN_STATUSES])));
  // Doublons possibles (COR-02) : autres DI ouvertes sur le même équipement
  const otherOpenRequests = await db
    .select({ id: workRequests.id, number: workRequests.number, symptom: workRequests.symptom, reportedAt: workRequests.reportedAt })
    .from(workRequests)
    .where(and(eq(workRequests.equipmentId, row.equipmentId), inArray(workRequests.status, ["NEW", "QUALIFIED"]), ne(workRequests.id, row.id)));
  const approvals = await approvalTimeline(ctx, "WORK_REQUEST", [row.id]);
  return { ...row, workOrder, openOrders, otherOpenRequests, approvals };
}

export const qualifyInput = z.object({
  priority: z.enum(["P1", "P2", "P3", "P4"]),
  type: z.enum(["BREAKDOWN", "DAMAGE", "SAFETY", "IMPROVEMENT", "OTHER"]),
  immobilize: bool.default(false),
});

async function loadForUpdate(ctx: AuthContext, id: string) {
  const [row] = await db
    .select()
    .from(workRequests)
    .where(and(eq(workRequests.id, id), eq(workRequests.tenantId, ctx.tenantId)));
  if (!row) throw new NotFoundError("Demande d'intervention");
  return row;
}

/** Qualification (COR-03) : priorité, type, décision d'immobilisation. */
export async function qualifyWorkRequest(ctx: AuthContext, id: string, raw: unknown) {
  const input = parseInput(qualifyInput, raw);
  const current = await loadForUpdate(ctx, id);
  assertCanOn(ctx, "request.qualify", current);
  if (!["NEW", "QUALIFIED"].includes(current.status)) throw new BusinessRuleError(["Cette DI n'est plus qualifiable."]);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(workRequests)
      .set({ ...input, status: "QUALIFIED", qualifiedById: ctx.userId, qualifiedAt: new Date() })
      .where(eq(workRequests.id, id))
      .returning();
    if (input.immobilize) {
      await setEquipmentStatus(tx, ctx, current.equipmentId, "IMMOBILIZED", { reason: `DI ${current.number} : ${current.symptom}` });
      await openDowntime(tx, ctx, {
        equipmentId: current.equipmentId,
        reason: input.type === "SAFETY" ? "SAFETY" : "BREAKDOWN",
        workRequestId: id,
        startedAt: new Date(),
      });
    }
    await audit(tx, ctx, { entityType: "work_request", entityId: id, action: "qualify", before: current, after: row });
    if (!(await latestApproval(tx, "WORK_REQUEST", id))) {
      const [eqRow] = await tx.select({ code: equipment.code }).from(equipment).where(eq(equipment.id, current.equipmentId));
      await startApproval(tx, ctx, approvalSubject(row, eqRow?.code ?? ""));
    }
    return row;
  });
}

export const rejectInput = z.object({ reason: text(500, "Le motif de rejet est obligatoire") });

/** Rejet motivé ; le déclarant est notifié (COR-03). */
export async function rejectWorkRequest(ctx: AuthContext, id: string, raw: unknown) {
  const input = parseInput(rejectInput, raw);
  const current = await loadForUpdate(ctx, id);
  assertCanOn(ctx, "request.qualify", current);
  if (!["NEW", "QUALIFIED"].includes(current.status)) throw new BusinessRuleError(["Cette DI ne peut plus être rejetée."]);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(workRequests)
      .set({ status: "REJECTED", rejectionReason: input.reason, qualifiedById: ctx.userId, qualifiedAt: new Date() })
      .where(eq(workRequests.id, id))
      .returning();
    await cancelPendingApproval(tx, ctx, "WORK_REQUEST", id, "DI rejetée");
    // Une DI qualifiée « immobilisante » puis rejetée ne doit pas laisser l'équipement immobilisé.
    if (current.immobilize) {
      await releaseEquipmentIfFree(tx, ctx, current.equipmentId, { reason: `DI ${current.number} rejetée`, excludeRequestId: id });
    }
    if (current.reportedById && current.reportedById !== ctx.userId) {
      await tx.insert(notifications).values({
        tenantId: ctx.tenantId,
        userId: current.reportedById,
        type: "work_request.rejected",
        title: `DI ${current.number} rejetée`,
        body: input.reason,
        entityType: "work_request",
        entityId: id,
      });
    }
    await audit(tx, ctx, { entityType: "work_request", entityId: id, action: "reject", before: current, after: row });
    return row;
  });
}

/** Objet soumis au circuit des DI : la priorité décide des étapes (ex. P1 → chef d'atelier du site). */
function approvalSubject(row: typeof workRequests.$inferSelect, equipmentCode: string) {
  return {
    objectType: "WORK_REQUEST" as const,
    objectId: row.id,
    companyId: row.companyId,
    siteId: row.siteId,
    label: `${row.number} · ${equipmentCode} · ${row.symptom}`.slice(0, 200),
    priority: row.priority,
    requestedById: row.reportedById ?? row.qualifiedById ?? "",
    entityType: "work_request",
  };
}

const TYPE_TO_WO: Record<RequestType, "CORRECTIVE" | "ACCIDENT" | "IMPROVEMENT"> = {
  BREAKDOWN: "CORRECTIVE",
  SAFETY: "CORRECTIVE",
  OTHER: "CORRECTIVE",
  DAMAGE: "ACCIDENT",
  IMPROVEMENT: "IMPROVEMENT",
};

/** Transformation d'une DI qualifiée en OT correctif (étape 4 du processus). */
export async function convertToWorkOrder(ctx: AuthContext, id: string) {
  const current = await loadForUpdate(ctx, id);
  assertCanOn(ctx, "workorder.manage", current);
  const errors: string[] = [];
  if (current.status !== "QUALIFIED") errors.push("La DI doit être qualifiée avant d'être transformée en OT.");
  const approval = await latestApproval(db, "WORK_REQUEST", id);
  if (approval?.status === "PENDING")
    errors.push(
      "La DI est en attente de validation (" + (approval.steps.find((s) => s.position === approval.currentPosition)?.name ?? "circuit") + ").",
    );
  if (errors.length > 0) throw new BusinessRuleError(errors);
  const type = current.type ?? "BREAKDOWN";
  return db.transaction(async (tx) => {
    const wo = await insertWorkOrder(tx, ctx, {
      companyId: current.companyId,
      siteId: current.siteId,
      equipmentId: current.equipmentId,
      type: TYPE_TO_WO[type],
      priority: current.priority ?? "P3",
      title: current.symptom,
      description: current.description,
      isImmobilizing: current.immobilize,
      isSafetyRelated: type === "SAFETY" || current.isSafetyRisk,
    });
    await tx.update(workRequests).set({ status: "CONVERTED", workOrderId: wo.id }).where(eq(workRequests.id, id));
    if (current.immobilize) {
      await tx.execute(sql`update downtimes set work_order_id = ${wo.id} where work_request_id = ${id} and ended_at is null`);
    }
    await audit(tx, ctx, { entityType: "work_request", entityId: id, action: "convert", after: { workOrderId: wo.id } });
    return wo;
  });
}

/** Rattachement à un OT ouvert sur le même équipement (doublon, COR-02). */
export async function mergeIntoWorkOrder(ctx: AuthContext, id: string, workOrderId: string) {
  const current = await loadForUpdate(ctx, id);
  assertCanOn(ctx, "request.qualify", current);
  const [wo] = await db
    .select({ id: workOrders.id, equipmentId: workOrders.equipmentId, status: workOrders.status })
    .from(workOrders)
    .where(and(eq(workOrders.id, workOrderId), eq(workOrders.tenantId, ctx.tenantId)));
  if (!wo) throw new NotFoundError("Ordre de travail");
  if (wo.equipmentId !== current.equipmentId) throw new BusinessRuleError(["L'OT doit porter sur le même équipement."]);
  if (!(OPEN_STATUSES as readonly string[]).includes(wo.status)) throw new BusinessRuleError(["L'OT de rattachement doit être ouvert."]);
  await db.transaction(async (tx) => {
    await tx.update(workRequests).set({ status: "MERGED", workOrderId }).where(eq(workRequests.id, id));
    await cancelPendingApproval(tx, ctx, "WORK_REQUEST", id, "DI rattachée à un OT");
    if (current.immobilize) {
      // L'immobilisation décidée sur la DI est portée par l'OT : elle sera levée à sa remise en service.
      await tx.update(workOrders).set({ isImmobilizing: true }).where(eq(workOrders.id, workOrderId));
      await tx.execute(sql`update downtimes set work_order_id = ${workOrderId} where work_request_id = ${id} and ended_at is null`);
    }
    await audit(tx, ctx, { entityType: "work_request", entityId: id, action: "merge", after: { workOrderId } });
  });
}

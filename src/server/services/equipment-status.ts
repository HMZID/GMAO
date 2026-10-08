import "server-only";
import { and, count, eq, gt, inArray, isNotNull, isNull, lt, lte, ne, notInArray, or } from "drizzle-orm";
import type { AuthContext } from "@/server/authz/context";
import type { DbOrTx } from "@/server/db";
import { assignments, downtimes, dueItems, equipment, equipmentStatusHistory, planOperations, workOrders, workRequests } from "@/server/db/schema";
import { OPEN_STATUSES } from "@/server/domain/work-order-status";

export type EquipmentStatus = (typeof equipment.$inferSelect)["status"];
export type DowntimeReason = (typeof downtimes.$inferSelect)["reason"];

/**
 * Change l'état opérationnel d'un équipement et l'historise (EQP-05).
 * L'état de l'équipement est distinct du statut de ses OT (CDC §5.5).
 */
export async function setEquipmentStatus(
  tx: DbOrTx,
  ctx: AuthContext,
  equipmentId: string,
  toStatus: EquipmentStatus,
  options: { reason?: string | null; workOrderId?: string | null } = {},
) {
  const [current] = await tx
    .select({ status: equipment.status })
    .from(equipment)
    .where(and(eq(equipment.id, equipmentId), eq(equipment.tenantId, ctx.tenantId)));
  if (!current || current.status === toStatus) return current?.status ?? null;
  await tx.update(equipment).set({ status: toStatus }).where(eq(equipment.id, equipmentId));
  await tx.insert(equipmentStatusHistory).values({
    tenantId: ctx.tenantId,
    equipmentId,
    fromStatus: current.status,
    toStatus,
    reason: options.reason ?? null,
    workOrderId: options.workOrderId ?? null,
    changedById: ctx.userId,
  });
  return toStatus;
}

/** Affectation active à l'instant donné (DON-13 : une seule à la fois). */
export async function getActiveAssignment(tx: DbOrTx, equipmentId: string, at: Date = new Date()) {
  const [row] = await tx
    .select()
    .from(assignments)
    .where(and(eq(assignments.equipmentId, equipmentId), lte(assignments.startAt, at), or(isNull(assignments.endAt), gt(assignments.endAt, at))))
    .limit(1);
  return row ?? null;
}

/** État après remise en service : En service si une affectation est active, sinon Disponible (CDC §5.5). */
export async function statusAfterRelease(tx: DbOrTx, equipmentId: string): Promise<EquipmentStatus> {
  return (await getActiveAssignment(tx, equipmentId)) ? "IN_SERVICE" : "AVAILABLE";
}

/** Ouvre une période d'immobilisation si aucune n'est en cours (COR-07). */
export async function openDowntime(
  tx: DbOrTx,
  ctx: AuthContext,
  input: {
    equipmentId: string;
    reason: DowntimeReason;
    startedAt?: Date;
    workOrderId?: string | null;
    workRequestId?: string | null;
    comment?: string | null;
  },
) {
  const [open] = await tx
    .select({ id: downtimes.id })
    .from(downtimes)
    .where(and(eq(downtimes.equipmentId, input.equipmentId), isNull(downtimes.endedAt)))
    .limit(1);
  if (open) {
    if (input.workOrderId) await tx.update(downtimes).set({ workOrderId: input.workOrderId }).where(eq(downtimes.id, open.id));
    return open.id;
  }
  const [row] = await tx
    .insert(downtimes)
    .values({
      tenantId: ctx.tenantId,
      equipmentId: input.equipmentId,
      reason: input.reason,
      startedAt: input.startedAt ?? new Date(),
      workOrderId: input.workOrderId ?? null,
      workRequestId: input.workRequestId ?? null,
      comment: input.comment ?? null,
    })
    .returning({ id: downtimes.id });
  return row.id;
}

/** Clôt les immobilisations en cours de l'équipement (remise en service validée). */
export async function closeDowntimes(tx: DbOrTx, equipmentId: string, endedAt: Date = new Date()) {
  await tx
    .update(downtimes)
    .set({ endedAt })
    .where(and(eq(downtimes.equipmentId, equipmentId), isNull(downtimes.endedAt)));
}

/**
 * Remet l'équipement en service s'il n'est plus retenu par rien (CDC §5.5) : aucun autre OT immobilisant
 * ouvert, aucune DI qualifiée « immobilisante » en attente, aucun contrôle réglementaire bloquant échu
 * (PRV-12). Clôt alors les immobilisations en cours. Renvoie le nouvel état, ou null si l'équipement reste immobilisé.
 */
export async function releaseEquipmentIfFree(
  tx: DbOrTx,
  ctx: AuthContext,
  equipmentId: string,
  options: { reason: string; workOrderId?: string | null; excludeWorkOrderId?: string; excludeRequestId?: string; at?: Date },
): Promise<EquipmentStatus | null> {
  const at = options.at ?? new Date();
  const [current] = await tx.select({ status: equipment.status }).from(equipment).where(eq(equipment.id, equipmentId));
  if (!current || (current.status !== "IMMOBILIZED" && current.status !== "IN_MAINTENANCE")) return null;

  // Un OT correctif immobilisant retient l'équipement dès sa création ; un OT préventif ou réglementaire
  // ne le retient qu'une fois démarré (l'équipement reste exploitable en attendant l'intervention).
  const [{ orders }] = await tx
    .select({ orders: count() })
    .from(workOrders)
    .where(
      and(
        eq(workOrders.equipmentId, equipmentId),
        eq(workOrders.isImmobilizing, true),
        inArray(workOrders.status, [...OPEN_STATUSES]),
        or(notInArray(workOrders.type, ["PREVENTIVE", "REGULATORY"]), isNotNull(workOrders.startedAt)),
        options.excludeWorkOrderId ? ne(workOrders.id, options.excludeWorkOrderId) : undefined,
      ),
    );
  const [{ requests }] = await tx
    .select({ requests: count() })
    .from(workRequests)
    .where(
      and(
        eq(workRequests.equipmentId, equipmentId),
        eq(workRequests.status, "QUALIFIED"),
        eq(workRequests.immobilize, true),
        options.excludeRequestId ? ne(workRequests.id, options.excludeRequestId) : undefined,
      ),
    );
  const today = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
  const [{ blocking }] = await tx
    .select({ blocking: count() })
    .from(dueItems)
    .innerJoin(planOperations, eq(planOperations.id, dueItems.operationId))
    .where(
      and(
        eq(dueItems.equipmentId, equipmentId),
        inArray(dueItems.status, ["PRE_ALERT", "DUE", "OVERDUE"]),
        eq(planOperations.isRegulatory, true),
        eq(planOperations.blockWhenOverdue, true),
        lt(dueItems.dueDate, today),
      ),
    );
  if (orders > 0 || requests > 0 || blocking > 0) return null;

  const next = await statusAfterRelease(tx, equipmentId);
  await setEquipmentStatus(tx, ctx, equipmentId, next, { reason: options.reason, workOrderId: options.workOrderId ?? null });
  await closeDowntimes(tx, equipmentId, at);
  return next;
}

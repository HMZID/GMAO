import "server-only";
import { asc, eq } from "drizzle-orm";
import type { AuthContext } from "@/server/authz/context";
import type { DbOrTx } from "@/server/db";
import { taskListItems, workOrderAssignees, workOrderStatusHistory, workOrderTasks, workOrders } from "@/server/db/schema";
import { audit } from "./_shared";
import { nextNumber } from "./numbering";

export type WorkOrderType = (typeof workOrders.$inferSelect)["type"];
export type Priority = (typeof workOrders.$inferSelect)["priority"];

export type NewWorkOrder = {
  companyId: string;
  siteId: string;
  equipmentId: string;
  type: WorkOrderType;
  priority?: Priority;
  title: string;
  description?: string | null;
  isImmobilizing?: boolean;
  isSafetyRelated?: boolean;
  workshopId?: string | null;
  jobsiteId?: string | null;
  isExternal?: boolean;
  supplierId?: string | null;
  plannedStart?: Date | null;
  plannedEnd?: Date | null;
  estimatedMinutes?: number | null;
  dueItemId?: string | null;
  taskListId?: string | null;
  parentWorkOrderId?: string | null;
  assigneeTechnicianIds?: string[];
  tasks?: {
    label: string;
    kind?: "CHECK" | "MEASURE" | "TEXT";
    required?: boolean;
    unit?: string | null;
    minValue?: number | null;
    maxValue?: number | null;
  }[];
};

/**
 * Création bas niveau d'un OT (numérotation, tâches de la gamme, historique, audit).
 * Utilisée par le correctif, le préventif et la transformation de DI ; les contrôles de droits
 * sont faits par l'appelant.
 */
export async function insertWorkOrder(tx: DbOrTx, ctx: AuthContext, input: NewWorkOrder) {
  const number = await nextNumber(tx, { tenantId: ctx.tenantId, companyId: input.companyId, kind: "OT" });
  const [wo] = await tx
    .insert(workOrders)
    .values({
      tenantId: ctx.tenantId,
      number,
      companyId: input.companyId,
      siteId: input.siteId,
      equipmentId: input.equipmentId,
      type: input.type,
      priority: input.priority ?? "P3",
      title: input.title,
      description: input.description ?? null,
      isImmobilizing: input.isImmobilizing ?? false,
      isSafetyRelated: input.isSafetyRelated ?? false,
      workshopId: input.workshopId ?? null,
      jobsiteId: input.jobsiteId ?? null,
      isExternal: input.isExternal ?? false,
      supplierId: input.supplierId ?? null,
      plannedStart: input.plannedStart ?? null,
      plannedEnd:
        input.plannedEnd ??
        (input.plannedStart && input.estimatedMinutes ? new Date(input.plannedStart.getTime() + input.estimatedMinutes * 60_000) : null),
      estimatedMinutes: input.estimatedMinutes ?? null,
      dueItemId: input.dueItemId ?? null,
      taskListId: input.taskListId ?? null,
      parentWorkOrderId: input.parentWorkOrderId ?? null,
      createdById: ctx.userId,
    })
    .returning();

  let tasks = input.tasks ?? [];
  if (tasks.length === 0 && input.taskListId) {
    const items = await tx.select().from(taskListItems).where(eq(taskListItems.taskListId, input.taskListId)).orderBy(asc(taskListItems.position));
    tasks = items.map((i) => ({
      label: i.label,
      kind: i.kind,
      required: i.required,
      unit: i.unit,
      minValue: i.minValue,
      maxValue: i.maxValue,
    }));
  }
  if (tasks.length > 0) {
    await tx.insert(workOrderTasks).values(
      tasks.map((t, index) => ({
        workOrderId: wo.id,
        position: index + 1,
        label: t.label,
        kind: t.kind ?? "CHECK",
        required: t.required ?? false,
        unit: t.unit ?? null,
        minValue: t.minValue ?? null,
        maxValue: t.maxValue ?? null,
      })),
    );
  }

  const assignees = [...new Set(input.assigneeTechnicianIds ?? [])];
  if (assignees.length > 0) {
    await tx.insert(workOrderAssignees).values(assignees.map((technicianId) => ({ workOrderId: wo.id, technicianId })));
  }

  await tx.insert(workOrderStatusHistory).values({
    workOrderId: wo.id,
    fromStatus: null,
    toStatus: "CREATED",
    changedById: ctx.userId,
  });
  await audit(tx, ctx, { entityType: "work_order", entityId: wo.id, action: "create", after: wo });
  return wo;
}

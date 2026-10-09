import "server-only";
import { and, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { isActiveAssignment, isInScope, type AuthContext } from "@/server/authz/context";
import { roleHas, type Permission, type Role } from "@/server/authz/permissions";
import { db, type DbOrTx } from "@/server/db";
import { notifications, roleAssignments, technicians, user } from "@/server/db/schema";
import { enqueueForNotification } from "./email";

export type NotificationInput = {
  type: string;
  title: string;
  body?: string;
  entityType?: string;
  entityId?: string;
  /** Clé de l'événement pour le courriel (par défaut : type + objet) : un même événement n'envoie qu'un courriel. */
  dedupKey?: string;
};

/**
 * Notifie les utilisateurs qui détiennent un droit sur la cible (NOT-01, NOT-03).
 * Dans l'application, et par courriel pour les événements qui le prévoient (§11.1, selon les préférences).
 * TODO(NOT-02) : notification mobile, escalade.
 */
export async function notifyByPermission(
  tx: DbOrTx,
  tenantId: string,
  permission: Permission,
  target: { companyId: string; siteId?: string | null },
  notification: NotificationInput,
  options: { excludeUserId?: string } = {},
) {
  const rows = await tx
    .select({
      userId: roleAssignments.userId,
      role: roleAssignments.role,
      scopeType: roleAssignments.scopeType,
      scopeId: roleAssignments.scopeId,
      validFrom: roleAssignments.validFrom,
      validTo: roleAssignments.validTo,
    })
    .from(roleAssignments)
    .innerJoin(user, eq(user.id, roleAssignments.userId))
    .where(and(eq(roleAssignments.tenantId, tenantId), eq(user.isActive, true)));

  const now = new Date();
  const recipients = new Set<string>();
  for (const a of rows) {
    if (!isActiveAssignment(a, now) || !roleHas(a.role as Role, permission)) continue;
    const scope =
      a.scopeType === "TENANT"
        ? ({ all: true } as const)
        : {
            all: false as const,
            companyIds: a.scopeType === "COMPANY" && a.scopeId ? [a.scopeId] : [],
            siteIds: a.scopeType === "SITE" && a.scopeId ? [a.scopeId] : [],
          };
    if (isInScope(scope, target) && a.userId !== options.excludeUserId) recipients.add(a.userId);
  }
  if (recipients.size === 0) return 0;
  return notifyUsers(tx, tenantId, [...recipients], notification);
}

/** Notifie des utilisateurs nommés (valideurs d'une étape, demandeur d'une validation, intervenants). */
export async function notifyUsers(tx: DbOrTx, tenantId: string, userIds: string[], notification: NotificationInput) {
  const recipients = [...new Set(userIds)];
  if (recipients.length === 0) return 0;
  await tx.insert(notifications).values(
    recipients.map((userId) => ({
      tenantId,
      userId,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      entityType: notification.entityType,
      entityId: notification.entityId,
    })),
  );
  await enqueueForNotification(tx, tenantId, recipients, notification);
  return recipients.length;
}

/** Affectation d'intervenants à un OT : chaque technicien lié à un compte est prévenu (dans l'application et par courriel). */
export async function notifyAssignedTechnicians(
  tx: DbOrTx,
  tenantId: string,
  workOrder: { id: string; number: string; title: string; plannedStart?: Date | null },
  technicianIds: string[],
  options: { excludeUserId?: string } = {},
) {
  if (technicianIds.length === 0) return 0;
  const rows = await tx
    .select({ userId: technicians.userId })
    .from(technicians)
    .where(and(inArray(technicians.id, technicianIds), isNotNull(technicians.userId)));
  const userIds = rows.map((r) => r.userId!).filter((id) => id !== options.excludeUserId);
  return notifyUsers(tx, tenantId, userIds, {
    type: "work_order.assigned",
    title: `Affectation : ${workOrder.number} — ${workOrder.title}`,
    body: workOrder.plannedStart
      ? `Vous intervenez sur ${workOrder.number}, prévu le ${workOrder.plannedStart.toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" })}.`
      : `Vous êtes affecté à ${workOrder.number}.`,
    entityType: "work_order",
    entityId: workOrder.id,
    dedupKey: `assigned:${workOrder.id}`,
  });
}

export async function listMyNotifications(ctx: AuthContext, limit = 20) {
  return db
    .select()
    .from(notifications)
    .where(and(eq(notifications.tenantId, ctx.tenantId), eq(notifications.userId, ctx.userId)))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function countUnread(ctx: AuthContext) {
  const rows = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.userId, ctx.userId), isNull(notifications.readAt)));
  return rows.length;
}

export async function markAllRead(ctx: AuthContext) {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, ctx.userId), isNull(notifications.readAt)));
}

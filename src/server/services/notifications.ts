import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { isActiveAssignment, isInScope, type AuthContext } from "@/server/authz/context";
import { roleHas, type Permission, type Role } from "@/server/authz/permissions";
import { db, type DbOrTx } from "@/server/db";
import { notifications, roleAssignments, user } from "@/server/db/schema";

export type NotificationInput = {
  type: string;
  title: string;
  body?: string;
  entityType?: string;
  entityId?: string;
};

/**
 * Notifie les utilisateurs qui détiennent un droit sur la cible (NOT-01, NOT-03).
 * Canal « dans l'application » ; TODO(NOT-01) : courriel, notification mobile, escalade (NOT-02).
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

  await tx.insert(notifications).values(
    [...recipients].map((userId) => ({
      tenantId,
      userId,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      entityType: notification.entityType,
      entityId: notification.entityId,
    })),
  );
  return recipients.size;
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

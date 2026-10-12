import "server-only";
import { and, eq } from "drizzle-orm";
import { buildAuthContext, restrictAuthContext, type AuthContext, type Channel } from "@/server/authz/context";
import { db } from "@/server/db";
import { apiKeys, roleAssignments, tenants, user } from "@/server/db/schema";
import { API_KEY_PERMISSIONS, apiKeyState, hashApiKey, type ApiKeyAccess } from "@/server/domain/api-keys";
import { tenantAccess } from "@/server/domain/tenants";
import type { Role } from "@/server/authz/permissions";

/** Intervalle minimal entre deux mises à jour de la date de dernière utilisation (limite les écritures). */
const LAST_USED_RESOLUTION_MS = 5 * 60 * 1000;

/**
 * Contexte d'une clé d'API : les habilitations actuelles de son créateur (rôles × périmètres), restreintes
 * aux droits de son niveau d'accès. Une clé ne voit donc jamais plus que celui qui l'a créée : une direction
 * limitée à une société n'obtient pas une clé sur tout le groupe (HAB-02). Refusée si elle est révoquée,
 * expirée, si son créateur est désactivé ou si l'organisation n'a plus accès.
 */
export async function authenticateApiKey(key: string, channel: Channel = "API", now = new Date()): Promise<AuthContext | null> {
  const [row] = await db
    .select({
      id: apiKeys.id,
      tenantId: apiKeys.tenantId,
      name: apiKeys.name,
      access: apiKeys.access,
      expiresAt: apiKeys.expiresAt,
      revokedAt: apiKeys.revokedAt,
      lastUsedAt: apiKeys.lastUsedAt,
      userId: user.id,
      email: user.email,
      userActive: user.isActive,
      tenantStatus: tenants.status,
      demoEndsAt: tenants.demoEndsAt,
    })
    .from(apiKeys)
    .innerJoin(user, eq(user.id, apiKeys.createdById))
    .innerJoin(tenants, eq(tenants.id, apiKeys.tenantId))
    .where(and(eq(apiKeys.keyHash, hashApiKey(key))));
  if (!row || !row.userActive || apiKeyState(row, now) !== "ACTIVE") return null;
  if (!tenantAccess({ status: row.tenantStatus, demoEndsAt: row.demoEndsAt }, now).allowed) return null;
  if (!row.lastUsedAt || now.getTime() - row.lastUsedAt.getTime() > LAST_USED_RESOLUTION_MS) {
    await db.update(apiKeys).set({ lastUsedAt: now }).where(eq(apiKeys.id, row.id));
  }
  const assignments = await db
    .select({
      role: roleAssignments.role,
      scopeType: roleAssignments.scopeType,
      scopeId: roleAssignments.scopeId,
      validFrom: roleAssignments.validFrom,
      validTo: roleAssignments.validTo,
    })
    .from(roleAssignments)
    .where(and(eq(roleAssignments.userId, row.userId), eq(roleAssignments.tenantId, row.tenantId)));
  const ctx = buildAuthContext(
    { id: row.userId, tenantId: row.tenantId, name: `Connecteur « ${row.name} »`, email: row.email },
    assignments.map((a) => ({ ...a, role: a.role as Role })),
    { channel, now },
  );
  return { ...restrictAuthContext(ctx, API_KEY_PERMISSIONS[row.access as ApiKeyAccess] ?? []), apiKeyId: row.id };
}

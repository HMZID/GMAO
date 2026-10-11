import "server-only";
import { and, eq } from "drizzle-orm";
import { buildAuthContext, restrictAuthContext, type AuthContext, type Channel } from "@/server/authz/context";
import { db } from "@/server/db";
import { apiKeys, user } from "@/server/db/schema";
import { API_KEY_PERMISSIONS, API_KEY_ROLES, apiKeyState, hashApiKey, type ApiKeyAccess } from "@/server/domain/api-keys";

/** Intervalle minimal entre deux mises à jour de la date de dernière utilisation (limite les écritures). */
const LAST_USED_RESOLUTION_MS = 5 * 60 * 1000;

/**
 * Contexte d'une clé d'API : tout le groupe de l'organisation, restreint aux droits de son niveau d'accès.
 * Refusée si elle est révoquée, expirée, ou si son créateur est désactivé.
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
    })
    .from(apiKeys)
    .innerJoin(user, eq(user.id, apiKeys.createdById))
    .where(and(eq(apiKeys.keyHash, hashApiKey(key))));
  if (!row || !row.userActive || apiKeyState(row, now) !== "ACTIVE") return null;
  if (!row.lastUsedAt || now.getTime() - row.lastUsedAt.getTime() > LAST_USED_RESOLUTION_MS) {
    await db.update(apiKeys).set({ lastUsedAt: now }).where(eq(apiKeys.id, row.id));
  }
  const ctx = buildAuthContext(
    { id: row.userId, tenantId: row.tenantId, name: `Connecteur « ${row.name} »`, email: row.email },
    API_KEY_ROLES.map((role) => ({ role, scopeType: "TENANT" as const, scopeId: null })),
    { channel, now },
  );
  return restrictAuthContext(ctx, API_KEY_PERMISSIONS[row.access as ApiKeyAccess] ?? []);
}

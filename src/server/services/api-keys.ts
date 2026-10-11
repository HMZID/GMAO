import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { AuthContext } from "@/server/authz/context";
import { db } from "@/server/db";
import { apiKeys, user } from "@/server/db/schema";
import { API_KEY_ACCESS, API_KEY_DURATIONS, apiKeyState, generateApiKey } from "@/server/domain/api-keys";
import { BusinessRuleError, NotFoundError } from "@/server/errors";
import { clearable, text } from "@/server/validation";
import { assertCan, audit, parseInput } from "./_shared";

/* ------------------------------------------------------------------ */
/* Connecteur de l'organisation : clés d'API (INT-01, INT-05)           */
/* ------------------------------------------------------------------ */

export async function listApiKeys(ctx: AuthContext, now = new Date()) {
  assertCan(ctx, "settings.manage");
  const rows = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      prefix: apiKeys.prefix,
      access: apiKeys.access,
      createdAt: apiKeys.createdAt,
      expiresAt: apiKeys.expiresAt,
      lastUsedAt: apiKeys.lastUsedAt,
      revokedAt: apiKeys.revokedAt,
      createdBy: user.name,
    })
    .from(apiKeys)
    .innerJoin(user, eq(user.id, apiKeys.createdById))
    .where(eq(apiKeys.tenantId, ctx.tenantId))
    .orderBy(desc(apiKeys.createdAt));
  return rows.map((r) => ({ ...r, state: apiKeyState(r, now) }));
}

export const apiKeyInput = z.object({
  name: text(80, "Nom obligatoire (outil ou flux qui utilise la clé)"),
  access: z.enum(API_KEY_ACCESS, "Accès obligatoire"),
  durationDays: clearable(z.coerce.number().int()),
});

/**
 * Nouvelle clé : la valeur est renvoyée une seule fois (elle n'est pas conservée, seule son empreinte l'est).
 * Les actions faites avec la clé sont tracées au nom de son créateur, sur le canal API.
 */
export async function createApiKey(ctx: AuthContext, raw: unknown, now = new Date()) {
  assertCan(ctx, "settings.manage");
  const input = parseInput(apiKeyInput, raw);
  if (input.durationDays != null && !(API_KEY_DURATIONS as readonly number[]).includes(input.durationDays))
    throw new BusinessRuleError(["Durée de validité inconnue."]);
  const generated = generateApiKey();
  const expiresAt = input.durationDays ? new Date(now.getTime() + input.durationDays * 86_400_000) : null;
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(apiKeys)
      .values({
        tenantId: ctx.tenantId,
        name: input.name,
        prefix: generated.prefix,
        keyHash: generated.hash,
        access: input.access,
        createdById: ctx.userId,
        expiresAt,
      })
      .returning({ id: apiKeys.id, name: apiKeys.name, prefix: apiKeys.prefix, access: apiKeys.access, expiresAt: apiKeys.expiresAt });
    await audit(tx, ctx, { entityType: "api_key", entityId: row.id, action: "create", after: row });
    return { ...row, key: generated.key };
  });
}

/** Révocation immédiate : la clé est refusée dès la requête suivante. */
export async function revokeApiKey(ctx: AuthContext, id: string, now = new Date()) {
  assertCan(ctx, "settings.manage");
  const [row] = await db
    .select({ id: apiKeys.id, revokedAt: apiKeys.revokedAt, name: apiKeys.name, prefix: apiKeys.prefix })
    .from(apiKeys)
    .where(and(eq(apiKeys.id, id), eq(apiKeys.tenantId, ctx.tenantId)));
  if (!row) throw new NotFoundError("Clé d'API");
  if (row.revokedAt) return;
  await db.transaction(async (tx) => {
    await tx.update(apiKeys).set({ revokedAt: now, revokedById: ctx.userId }).where(eq(apiKeys.id, id));
    await audit(tx, ctx, { entityType: "api_key", entityId: id, action: "revoke", before: { name: row.name, prefix: row.prefix } });
  });
}

import "server-only";
import { assertPasswordNotBreached } from "@/server/auth/breached-password";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import type { AuthContext } from "@/server/authz/context";
import { db } from "@/server/db";
import { account, session, user } from "@/server/db/schema";
import { newPasswordRefusals } from "@/server/domain/credentials";
import { BusinessRuleError } from "@/server/errors";
import { audit, parseInput } from "./_shared";

/* ------------------------------------------------------------------ */
/* Compte de l'utilisateur connecté : première connexion               */
/* ------------------------------------------------------------------ */

/** Le compte a-t-il encore un mot de passe provisoire (compte ouvert depuis le site) ? */
export async function needsPasswordChange(userId: string) {
  const [row] = await db.select({ mustChangePassword: user.mustChangePassword }).from(user).where(eq(user.id, userId));
  return !!row?.mustChangePassword;
}

export const initialPasswordInput = z.object({
  password: z.string().max(128, "128 caractères au plus"),
  confirmation: z.string().max(128),
});

/**
 * Première connexion : l'utilisateur remplace son mot de passe provisoire par le sien (10 caractères au
 * moins, différent du provisoire). Les autres sessions ouvertes avec le provisoire sont fermées.
 */
export async function setInitialPassword(ctx: AuthContext, raw: unknown, currentSessionToken?: string | null) {
  const input = parseInput(initialPasswordInput, raw);
  const [credential] = await db
    .select({ id: account.id, password: account.password })
    .from(account)
    .where(and(eq(account.userId, ctx.userId), eq(account.providerId, "credential")));
  const [row] = await db.select({ mustChangePassword: user.mustChangePassword }).from(user).where(eq(user.id, ctx.userId));
  if (!row?.mustChangePassword || !credential?.password) throw new BusinessRuleError(["Votre mot de passe est déjà personnel."]);
  const errors = newPasswordRefusals({
    password: input.password,
    confirmation: input.confirmation,
    provisionalMatches: await verifyPassword({ hash: credential.password, password: input.password }),
  });
  if (errors.length) throw new BusinessRuleError(errors);
  await assertPasswordNotBreached(input.password);
  const passwordHash = await hashPassword(input.password);
  await db.transaction(async (tx) => {
    await tx.update(account).set({ password: passwordHash }).where(eq(account.id, credential.id));
    await tx.update(user).set({ mustChangePassword: false }).where(eq(user.id, ctx.userId));
    await tx.delete(session).where(and(eq(session.userId, ctx.userId), currentSessionToken ? ne(session.token, currentSessionToken) : undefined));
    await audit(tx, ctx, { entityType: "user", entityId: ctx.userId, action: "initial_password" });
  });
}

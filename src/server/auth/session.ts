import "server-only";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { buildAuthContext, type AuthContext, type Channel } from "@/server/authz/context";
import type { Role } from "@/server/authz/permissions";
import { db } from "@/server/db";
import { roleAssignments, technicians, user } from "@/server/db/schema";
import { UnauthorizedError } from "@/server/errors";
import { auth } from "./auth";

/** Charge l'utilisateur, ses affectations de rôle et son technicien éventuel. */
export async function loadAuthContext(userId: string, channel: Channel): Promise<AuthContext | null> {
  const [row] = await db
    .select({ id: user.id, tenantId: user.tenantId, name: user.name, email: user.email, isActive: user.isActive })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  if (!row || !row.isActive) return null;

  const [assignments, [tech]] = await Promise.all([
    db
      .select({
        role: roleAssignments.role,
        scopeType: roleAssignments.scopeType,
        scopeId: roleAssignments.scopeId,
        validFrom: roleAssignments.validFrom,
        validTo: roleAssignments.validTo,
      })
      .from(roleAssignments)
      .where(and(eq(roleAssignments.userId, row.id), eq(roleAssignments.tenantId, row.tenantId))),
    db
      .select({ id: technicians.id })
      .from(technicians)
      .where(and(eq(technicians.userId, row.id), eq(technicians.active, true)))
      .limit(1),
  ]);

  return buildAuthContext(
    { id: row.id, tenantId: row.tenantId, name: row.name, email: row.email, technicianId: tech?.id ?? null },
    assignments.map((a) => ({ ...a, role: a.role as Role })),
    { channel },
  );
}

/**
 * Contexte de l'utilisateur connecté pour les Server Components et Server Actions.
 * Lit la session (requête) : à appeler sous une frontière <Suspense> (Cache Components).
 * Redirige vers /login si la session est absente ou le compte désactivé.
 */
export const getAuthContext = cache(async (): Promise<AuthContext> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const ctx = await loadAuthContext(session.user.id, "WEB");
  if (!ctx) redirect("/login");
  return ctx;
});

/** Contexte pour les routes API : cookie de session ou en-tête `Authorization: Bearer`. */
export async function getApiContext(request: Request): Promise<AuthContext> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) throw new UnauthorizedError();
  const channel: Channel = request.headers.get("x-client") === "mobile" ? "MOBILE" : "API";
  const ctx = await loadAuthContext(session.user.id, channel);
  if (!ctx) throw new UnauthorizedError("Compte désactivé ou inconnu.");
  return ctx;
}

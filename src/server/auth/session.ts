import "server-only";
import { and, eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { buildAuthContext, type AuthContext, type Channel } from "@/server/authz/context";
import type { Role } from "@/server/authz/permissions";
import { db } from "@/server/db";
import { roleAssignments, technicians, tenants, user } from "@/server/db/schema";
import { tenantAccess } from "@/server/domain/tenants";
import { UnauthorizedError } from "@/server/errors";
import { apiKeyFromHeaders } from "@/server/domain/api-keys";
import { IMPERSONATION_COOKIE, verifyImpersonation } from "@/server/domain/impersonation";
import { isPlatformAdmin, needsAdminTwoFactorSetup } from "@/server/services/platform";
import { authenticateApiKey } from "./api-key";
import { auth } from "./auth";

/** Charge l'utilisateur, ses affectations de rôle et son technicien éventuel. */
export async function loadAuthContext(userId: string, channel: Channel, options: { ignoreTenantAccess?: boolean } = {}): Promise<AuthContext | null> {
  const [row] = await db
    .select({
      id: user.id,
      tenantId: user.tenantId,
      name: user.name,
      email: user.email,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
      twoFactorEnabled: user.twoFactorEnabled,
      tenantStatus: tenants.status,
      demoEndsAt: tenants.demoEndsAt,
    })
    .from(user)
    .innerJoin(tenants, eq(tenants.id, user.tenantId))
    .where(eq(user.id, userId))
    .limit(1);
  if (!row || !row.isActive) return null;
  // Organisation suspendue ou démonstration échue : plus d'accès, même avec une session ouverte.
  // (L'administrateur de la plateforme connecté « en tant que » garde l'accès, pour l'assistance.)
  if (!options.ignoreTenantAccess && !tenantAccess({ status: row.tenantStatus, demoEndsAt: row.demoEndsAt }, new Date()).allowed) return null;

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
      .where(and(eq(technicians.userId, row.id), eq(technicians.tenantId, row.tenantId), eq(technicians.active, true)))
      .limit(1),
  ]);

  const ctx = buildAuthContext(
    { id: row.id, tenantId: row.tenantId, name: row.name, email: row.email, technicianId: tech?.id ?? null },
    assignments.map((a) => ({ ...a, role: a.role as Role })),
    { channel },
  );
  return { ...ctx, twoFactorEnabled: row.twoFactorEnabled, ...(row.mustChangePassword ? { mustChangePassword: true } : {}) };
}

/**
 * Connexion « en tant que » : un administrateur de la plateforme (session personnelle requise) prend le
 * contexte de l'utilisateur désigné par le cookie signé ; ses actions restent tracées à son nom.
 */
async function withImpersonation(ctx: AuthContext, token: string | undefined): Promise<AuthContext> {
  if (!token || !isPlatformAdmin(ctx)) return ctx;
  const claim = verifyImpersonation(token, process.env.BETTER_AUTH_SECRET ?? "", new Date());
  if (!claim || claim.adminId !== ctx.userId) return ctx;
  const target = await loadAuthContext(claim.targetId, ctx.channel, { ignoreTenantAccess: true });
  // Compte désactivé ou devenu administrateur de la plateforme depuis l'ouverture : la connexion cesse.
  if (!target || target.can("platform.manage")) return ctx;
  return { ...target, impersonator: { id: ctx.userId, name: ctx.name, email: ctx.email } };
}

/** Valeur d'un cookie dans l'en-tête d'une requête API. */
function cookieFrom(request: Request, name: string) {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return undefined;
}

/** Contexte de l'administrateur lui-même, sans connexion « en tant que » (pour en sortir). */
export const getOwnAuthContext = cache(async (): Promise<AuthContext> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const ctx = await loadAuthContext(session.user.id, "WEB");
  if (!ctx) redirect("/login");
  return ctx;
});

/**
 * Contexte de l'utilisateur connecté pour les Server Components et Server Actions.
 * Lit la session (requête) : à appeler sous une frontière <Suspense> (Cache Components).
 * Redirige vers /login si la session est absente ou le compte désactivé.
 */
export const getAuthContext = cache(async (): Promise<AuthContext> => {
  const own = await getOwnAuthContext();
  // Mot de passe provisoire (compte ouvert depuis le site) : à remplacer avant toute autre page ou action.
  if (own.mustChangePassword) redirect("/premiere-connexion");
  // Administrateur de la plateforme sans double authentification : à configurer avant tout (TEC-04).
  if (needsAdminTwoFactorSetup(own)) redirect("/compte/securite?obligatoire=1");
  return withImpersonation(own, (await cookies()).get(IMPERSONATION_COOKIE)?.value);
});

/**
 * Contexte pour les routes API : clé d'API du connecteur (`Authorization: Bearer gmk_…` ou `X-Api-Key`),
 * sinon cookie de session ou jeton de session `Authorization: Bearer`.
 */
export async function getApiContext(request: Request): Promise<AuthContext> {
  const key = apiKeyFromHeaders(request.headers);
  if (key) {
    const ctx = await authenticateApiKey(key);
    if (!ctx) throw new UnauthorizedError("Clé d'API invalide, révoquée ou expirée.");
    return ctx;
  }
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) throw new UnauthorizedError();
  const channel: Channel = request.headers.get("x-client") === "mobile" ? "MOBILE" : "API";
  const ctx = await loadAuthContext(session.user.id, channel);
  if (!ctx) throw new UnauthorizedError("Compte désactivé ou inconnu.");
  return withImpersonation(ctx, cookieFrom(request, IMPERSONATION_COOKIE));
}

import "server-only";
import { assertPasswordNotBreached } from "@/server/auth/breached-password";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import type { AuthContext } from "@/server/authz/context";
import { db, type DbOrTx } from "@/server/db";
import { account, companies, equipmentCategories, roleAssignments, sites, tenants, user, warehouses, workshops } from "@/server/db/schema";
import { ROLES } from "@/server/authz/permissions";
import { IMPERSONATION_TTL_MS, impersonationRefusals, signImpersonation } from "@/server/domain/impersonation";
import { companyCodeFrom, DEMO_DURATIONS, demoEndsAt, platformAdmins, tenantAccess, type TenantStatus } from "@/server/domain/tenants";
import { BusinessRuleError, ConflictError, ForbiddenError, NotFoundError } from "@/server/errors";
import { text } from "@/server/validation";
import { audit, parseInput } from "./_shared";

/* ------------------------------------------------------------------ */
/* Plateforme : organisations clientes, démonstrations (administration) */
/* ------------------------------------------------------------------ */

/**
 * Administrateur de la plateforme : rôle « Administrateur » (droit platform.manage), connecté en personne
 * (jamais par une clé d'API). Si PLATFORM_ADMIN_EMAILS est renseignée, son courriel doit aussi y figurer.
 */
export function isPlatformAdmin(ctx: AuthContext) {
  if (ctx.apiKeyId || !ctx.can("platform.manage")) return false;
  const allowed = platformAdmins(process.env.PLATFORM_ADMIN_EMAILS);
  return allowed.size === 0 || allowed.has(ctx.email.toLowerCase());
}

export function assertPlatformAdmin(ctx: AuthContext) {
  if (!isPlatformAdmin(ctx)) throw new ForbiddenError("Réservé aux administrateurs de la plateforme.");
}

/** Organisations de la plateforme, avec leur état d'accès et leur volume. */
export async function listTenants(ctx: AuthContext, now = new Date()) {
  assertPlatformAdmin(ctx);
  const rows = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      displayName: tenants.displayName,
      status: tenants.status,
      demoEndsAt: tenants.demoEndsAt,
      contactEmail: tenants.contactEmail,
      createdAt: tenants.createdAt,
      users: sql<number>`(select count(*)::int from "user" u where u.tenant_id = "tenants"."id")`,
      equipment: sql<number>`(select count(*)::int from "equipment" e where e.tenant_id = "tenants"."id")`,
    })
    .from(tenants)
    .orderBy(asc(tenants.name));
  return rows.map((r) => ({ ...r, access: tenantAccess(r, now), own: r.id === ctx.tenantId }));
}

/** Catégories d'équipement proposées à une nouvelle organisation (modifiables ensuite). */
const STARTER_CATEGORIES: { code: string; name: string; defaultCriticality: "A" | "B" | "C" }[] = [
  { code: "PELLE", name: "Pelle hydraulique", defaultCriticality: "A" },
  { code: "CHARGEUSE", name: "Chargeuse", defaultCriticality: "A" },
  { code: "CAMION", name: "Camion porteur", defaultCriticality: "B" },
  { code: "VL", name: "Véhicule léger", defaultCriticality: "C" },
  { code: "LEVAGE", name: "Appareil de levage", defaultCriticality: "A" },
  { code: "GROUPE", name: "Groupe électrogène", defaultCriticality: "C" },
];

export const demoTenantInput = z.object({
  organizationName: text(120, "Nom de l'organisation obligatoire"),
  adminName: text(120, "Nom de l'administrateur obligatoire"),
  adminEmail: z.email("Courriel invalide").transform((s) => s.toLowerCase()),
  adminPassword: z.string().min(10, "10 caractères minimum").max(128),
  durationDays: z.coerce.number().int(),
});

/**
 * Nouvelle organisation de démonstration, prête à l'emploi pour la période choisie : société, site,
 * atelier, magasin, catégories d'équipement de départ et premier administrateur. Le client importe
 * ensuite ses données (engins, fournisseurs, ouvriers, stock). À l'échéance, l'accès est coupé.
 */
export async function createDemoTenant(ctx: AuthContext, raw: unknown, now = new Date()) {
  assertPlatformAdmin(ctx);
  const input = parseInput(demoTenantInput, raw);
  if (!(DEMO_DURATIONS as readonly number[]).includes(input.durationDays)) throw new BusinessRuleError(["Durée de démonstration inconnue."]);
  const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, input.adminEmail));
  if (existing) throw new ConflictError("Un compte existe déjà avec ce courriel.");
  await assertPasswordNotBreached(input.adminPassword);
  const passwordHash = await hashPassword(input.adminPassword);
  const endsAt = demoEndsAt(now, input.durationDays);

  return db.transaction(async (tx) => {
    const created = await provisionDemoTenant(tx, ctx, { ...input, passwordHash, endsAt, mustChangePassword: false });
    return { id: created.tenantId, name: created.name, demoEndsAt: endsAt, adminEmail: input.adminEmail };
  });
}

/**
 * Organisation de démonstration et son premier compte (direction du client), dans la transaction de
 * l'appelant : ouverture manuelle par la plateforme ou acceptation d'une demande déposée sur le site.
 * `mustChangePassword` : mot de passe provisoire, à remplacer à la première connexion.
 */
export async function provisionDemoTenant(
  tx: DbOrTx,
  ctx: AuthContext,
  input: { organizationName: string; adminName: string; adminEmail: string; passwordHash: string; endsAt: Date; mustChangePassword: boolean },
) {
  const { endsAt } = input;
  const [tenant] = await tx
    .insert(tenants)
    .values({ name: input.organizationName, status: "DEMO", demoEndsAt: endsAt, contactEmail: input.adminEmail })
    .returning({ id: tenants.id, name: tenants.name });
  const [company] = await tx
    .insert(companies)
    .values({ tenantId: tenant.id, code: companyCodeFrom(input.organizationName), name: input.organizationName })
    .returning({ id: companies.id });
  const [site] = await tx
    .insert(sites)
    .values({ tenantId: tenant.id, companyId: company.id, code: "SIEGE", name: "Site principal" })
    .returning({ id: sites.id });
  await tx.insert(workshops).values({ tenantId: tenant.id, siteId: site.id, code: "ATELIER", name: "Atelier principal" });
  await tx.insert(warehouses).values({ tenantId: tenant.id, siteId: site.id, code: "MAGASIN", name: "Magasin principal" });
  await tx.insert(equipmentCategories).values(STARTER_CATEGORIES.map((c) => ({ ...c, tenantId: tenant.id })));

  const userId = randomUUID();
  await tx.insert(user).values({
    id: userId,
    name: input.adminName,
    email: input.adminEmail,
    emailVerified: true,
    tenantId: tenant.id,
    isActive: true,
    mustChangePassword: input.mustChangePassword,
  });
  await tx.insert(account).values({ id: randomUUID(), accountId: userId, providerId: "credential", userId, password: input.passwordHash });
  // Le client est géré par sa direction : tous les droits de son organisation, dont la gestion des accès.
  await tx.insert(roleAssignments).values({ tenantId: tenant.id, userId, role: "EXECUTIVE", scopeType: "TENANT", scopeId: null });

  const after = { name: tenant.name, status: "DEMO", demoEndsAt: endsAt, admin: input.adminEmail };
  // Journal de la plateforme (organisation de l'administrateur) et journal du client.
  await audit(tx, ctx, { entityType: "tenant", entityId: tenant.id, action: "create_demo", after });
  await audit(tx, { ...ctx, tenantId: tenant.id }, { entityType: "tenant", entityId: tenant.id, action: "create_demo", after });
  return { tenantId: tenant.id, userId, name: tenant.name };
}

export const tenantActionInput = z.object({
  action: z.enum(["EXTEND", "ACTIVATE", "SUSPEND", "RESUME"]),
  days: z.coerce.number().int().optional(),
});

/** Prolonger une démonstration, passer en abonnement, suspendre ou rétablir l'accès d'une organisation. */
export async function updateTenantAccess(ctx: AuthContext, tenantId: string, raw: unknown, now = new Date()) {
  assertPlatformAdmin(ctx);
  const input = parseInput(tenantActionInput, raw);
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
  if (!tenant) throw new NotFoundError("Organisation");
  if (tenant.id === ctx.tenantId && input.action === "SUSPEND")
    throw new BusinessRuleError(["Vous ne pouvez pas suspendre votre propre organisation."]);

  let next: { status: TenantStatus; demoEndsAt: Date | null };
  switch (input.action) {
    case "EXTEND":
      if (!input.days || !(DEMO_DURATIONS as readonly number[]).includes(input.days))
        throw new BusinessRuleError(["Durée de prolongation inconnue."]);
      next = { status: "DEMO", demoEndsAt: demoEndsAt(now, input.days, tenant.demoEndsAt) };
      break;
    case "ACTIVATE":
      next = { status: "ACTIVE", demoEndsAt: null };
      break;
    case "SUSPEND":
      next = { status: "SUSPENDED", demoEndsAt: tenant.demoEndsAt };
      break;
    case "RESUME":
      // Rétablissement : retour en démonstration si sa date de fin est encore à venir, sinon abonnement.
      next =
        tenant.demoEndsAt && tenant.demoEndsAt > now ? { status: "DEMO", demoEndsAt: tenant.demoEndsAt } : { status: "ACTIVE", demoEndsAt: null };
      break;
  }
  await db.transaction(async (tx) => {
    await tx.update(tenants).set(next).where(eq(tenants.id, tenantId));
    await audit(tx, ctx, {
      entityType: "tenant",
      entityId: tenantId,
      action: input.action.toLowerCase(),
      before: { status: tenant.status, demoEndsAt: tenant.demoEndsAt },
      after: next,
    });
  });
  return next;
}

/** Accès de l'organisation de l'utilisateur (bandeau « démonstration », fin de période). */
export async function getOwnTenantAccess(ctx: AuthContext, now = new Date()) {
  const [tenant] = await db.select({ status: tenants.status, demoEndsAt: tenants.demoEndsAt }).from(tenants).where(eq(tenants.id, ctx.tenantId));
  return tenant ? tenantAccess(tenant, now) : null;
}

/* ------------------------------------------------------------------ */
/* Organisations : détail, comptes, connexion « en tant que »           */
/* ------------------------------------------------------------------ */

/** Une organisation vue par la plateforme : sociétés et sites, comptes et rôles. */
export async function getTenantDetail(ctx: AuthContext, tenantId: string, now = new Date()) {
  assertPlatformAdmin(ctx);
  if (!z.uuid().safeParse(tenantId).success) throw new NotFoundError("Organisation");
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
  if (!tenant) throw new NotFoundError("Organisation");
  const companyRows = await db.select().from(companies).where(eq(companies.tenantId, tenantId)).orderBy(asc(companies.name));
  const siteRows = await db.select().from(sites).where(eq(sites.tenantId, tenantId)).orderBy(asc(sites.name));
  const users = await db
    .select({ id: user.id, name: user.name, email: user.email, isActive: user.isActive })
    .from(user)
    .where(eq(user.tenantId, tenantId))
    .orderBy(asc(user.name));
  const assignments = users.length
    ? await db
        .select({
          userId: roleAssignments.userId,
          role: roleAssignments.role,
          scopeType: roleAssignments.scopeType,
          scopeId: roleAssignments.scopeId,
        })
        .from(roleAssignments)
        .where(
          and(
            eq(roleAssignments.tenantId, tenantId),
            inArray(
              roleAssignments.userId,
              users.map((u) => u.id),
            ),
          ),
        )
    : [];
  const scopeLabel = (a: (typeof assignments)[number]) =>
    a.scopeType === "TENANT"
      ? "Tout le groupe"
      : a.scopeType === "COMPANY"
        ? (companyRows.find((c) => c.id === a.scopeId)?.name ?? "Société")
        : (siteRows.find((x) => x.id === a.scopeId)?.name ?? "Site");
  return {
    tenant: { ...tenant, logoData: undefined, access: tenantAccess(tenant, now), own: tenant.id === ctx.tenantId },
    companies: companyRows.map((c) => ({ ...c, sites: siteRows.filter((x) => x.companyId === c.id) })),
    users: users.map((u) => {
      const roles = assignments.filter((a) => a.userId === u.id);
      return {
        ...u,
        roles: roles.map((a) => ({ role: a.role, scope: scopeLabel(a) })),
        platformAdmin: roles.some((a) => a.role === "ADMIN"),
      };
    }),
  };
}

export const tenantUserInput = z
  .object({
    name: text(120, "Nom obligatoire"),
    email: z.email("Courriel invalide").transform((v) => v.toLowerCase()),
    password: z.string().min(10, "10 caractères minimum").max(128),
    role: z.enum(ROLES.filter((r) => r !== "ADMIN") as [string, ...string[]], "Rôle obligatoire"),
    scope: z.string().min(1, "Périmètre obligatoire"),
  })
  .transform((v) => {
    const [scopeType, scopeId] = v.scope.split(":");
    return { ...v, scopeType: scopeType as "TENANT" | "COMPANY" | "SITE", scopeId: scopeId || null };
  });

/** Compte créé par la plateforme dans une organisation (rôle et périmètre de cette organisation). */
export async function createTenantUser(ctx: AuthContext, tenantId: string, raw: unknown) {
  assertPlatformAdmin(ctx);
  const input = parseInput(tenantUserInput, raw);
  const [tenant] = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.id, tenantId));
  if (!tenant) throw new NotFoundError("Organisation");
  if (input.scopeType === "COMPANY" || input.scopeType === "SITE") {
    const table = input.scopeType === "COMPANY" ? companies : sites;
    const [scope] = await db
      .select({ id: table.id })
      .from(table)
      .where(and(eq(table.id, input.scopeId ?? ""), eq(table.tenantId, tenantId)));
    if (!scope) throw new NotFoundError(input.scopeType === "COMPANY" ? "Société" : "Site");
  } else if (input.scopeType !== "TENANT") throw new BusinessRuleError(["Périmètre inconnu."]);
  const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, input.email));
  if (existing) throw new ConflictError("Un compte existe déjà avec ce courriel.");
  await assertPasswordNotBreached(input.password);
  const passwordHash = await hashPassword(input.password);
  return db.transaction(async (tx) => {
    const id = randomUUID();
    await tx.insert(user).values({ id, name: input.name, email: input.email, emailVerified: true, tenantId, isActive: true });
    await tx.insert(account).values({ id: randomUUID(), accountId: id, providerId: "credential", userId: id, password: passwordHash });
    await tx.insert(roleAssignments).values({
      tenantId,
      userId: id,
      role: input.role as (typeof ROLES)[number],
      scopeType: input.scopeType,
      scopeId: input.scopeType === "TENANT" ? null : input.scopeId,
    });
    const after = { id, name: input.name, email: input.email, role: input.role, scopeType: input.scopeType };
    await audit(tx, { ...ctx, tenantId }, { entityType: "user", entityId: id, action: "create_by_platform", after });
    return after;
  });
}

/**
 * Connexion « en tant que » : jeton signé à poser dans un cookie. Jamais vers un autre administrateur de
 * la plateforme ni vers un compte désactivé ; l'ouverture est tracée au journal de l'organisation.
 */
export async function startImpersonation(ctx: AuthContext, userId: string, now = new Date()) {
  assertPlatformAdmin(ctx);
  const [target] = await db
    .select({ id: user.id, name: user.name, email: user.email, tenantId: user.tenantId, isActive: user.isActive })
    .from(user)
    .where(eq(user.id, userId));
  if (!target) throw new NotFoundError("Utilisateur");
  const [platformRole] = await db
    .select({ id: roleAssignments.id })
    .from(roleAssignments)
    .where(and(eq(roleAssignments.userId, target.id), eq(roleAssignments.role, "ADMIN")));
  const refusals = impersonationRefusals({
    adminId: ctx.userId,
    alreadyImpersonating: !!ctx.impersonator,
    target: { id: target.id, isActive: target.isActive, isPlatformAdmin: !!platformRole },
  });
  if (refusals.length > 0) throw new BusinessRuleError(refusals);
  const expiresAt = now.getTime() + IMPERSONATION_TTL_MS;
  await db.transaction(async (tx) => {
    await audit(
      tx,
      // L'ouverture elle-même est marquée « via l'administrateur de la plateforme ».
      { ...ctx, tenantId: target.tenantId, impersonator: { id: ctx.userId, name: ctx.name, email: ctx.email } },
      {
        entityType: "user",
        entityId: target.id,
        action: "impersonation_start",
        after: { by: ctx.email, until: new Date(expiresAt) },
      },
    );
  });
  return {
    token: signImpersonation({ adminId: ctx.userId, targetId: target.id, expiresAt }, process.env.BETTER_AUTH_SECRET ?? ""),
    expiresAt: new Date(expiresAt),
    target: { name: target.name, email: target.email },
  };
}

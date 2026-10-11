import "server-only";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { AuthContext } from "@/server/authz/context";
import { db } from "@/server/db";
import { account, companies, equipmentCategories, roleAssignments, sites, tenants, user, warehouses, workshops } from "@/server/db/schema";
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

function assertPlatformAdmin(ctx: AuthContext) {
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
  const passwordHash = await hashPassword(input.adminPassword);
  const endsAt = demoEndsAt(now, input.durationDays);

  return db.transaction(async (tx) => {
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
    await tx
      .insert(user)
      .values({ id: userId, name: input.adminName, email: input.adminEmail, emailVerified: true, tenantId: tenant.id, isActive: true });
    await tx.insert(account).values({ id: randomUUID(), accountId: userId, providerId: "credential", userId, password: passwordHash });
    // Le client est géré par sa direction : tous les droits de son organisation, dont la gestion des accès.
    await tx.insert(roleAssignments).values({ tenantId: tenant.id, userId, role: "EXECUTIVE", scopeType: "TENANT", scopeId: null });

    const after = { name: tenant.name, status: "DEMO", demoEndsAt: endsAt, admin: input.adminEmail };
    // Journal de la plateforme (organisation de l'administrateur) et journal du client.
    await audit(tx, ctx, { entityType: "tenant", entityId: tenant.id, action: "create_demo", after });
    await audit(tx, { ...ctx, tenantId: tenant.id }, { entityType: "tenant", entityId: tenant.id, action: "create_demo", after });
    return { id: tenant.id, name: tenant.name, demoEndsAt: endsAt, adminEmail: input.adminEmail };
  });
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

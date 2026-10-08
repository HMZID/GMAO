import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { AuthContext } from "@/server/authz/context";
import { db } from "@/server/db";
import { companies, costCenters, jobsites, sites, storageLocations, warehouses, workshops } from "@/server/db/schema";
import { ConflictError, NotFoundError } from "@/server/errors";
import { bool, optionalDate } from "@/server/validation";
import { assertCan, audit, parseInput, scopeWhere } from "./_shared";

/**
 * Organisation (CDC §1.3) : sociétés, sites, ateliers, magasins, chantiers.
 * Lecture filtrée par le périmètre « équipements » de l'utilisateur ; écriture réservée à l'administrateur.
 */

export async function listCompanies(ctx: AuthContext) {
  const scope = ctx.scope("equipment.read");
  const rows = await db
    .select()
    .from(companies)
    .where(and(eq(companies.tenantId, ctx.tenantId)))
    .orderBy(asc(companies.name));
  if (scope.all) return rows;
  const siteCompanyIds = scope.siteIds.length
    ? (await db.select({ companyId: sites.companyId }).from(sites).where(inArray(sites.id, scope.siteIds))).map((s) => s.companyId)
    : [];
  const allowed = new Set([...scope.companyIds, ...siteCompanyIds]);
  return rows.filter((c) => allowed.has(c.id));
}

export async function listSites(ctx: AuthContext, options: { companyId?: string } = {}) {
  const scope = ctx.scope("equipment.read");
  return db
    .select({
      id: sites.id,
      code: sites.code,
      name: sites.name,
      companyId: sites.companyId,
      companyName: companies.name,
      timezone: sites.timezone,
      active: sites.active,
    })
    .from(sites)
    .innerJoin(companies, eq(companies.id, sites.companyId))
    .where(
      and(
        eq(sites.tenantId, ctx.tenantId),
        options.companyId ? eq(sites.companyId, options.companyId) : undefined,
        scopeWhere(scope, sites.companyId, sites.id),
      ),
    )
    .orderBy(asc(companies.name), asc(sites.name));
}

export async function listWorkshops(ctx: AuthContext) {
  const scope = ctx.scope("equipment.read");
  return db
    .select({ id: workshops.id, code: workshops.code, name: workshops.name, bays: workshops.bays, siteId: workshops.siteId, siteName: sites.name })
    .from(workshops)
    .innerJoin(sites, eq(sites.id, workshops.siteId))
    .where(and(eq(workshops.tenantId, ctx.tenantId), scopeWhere(scope, sites.companyId, sites.id)))
    .orderBy(asc(sites.name), asc(workshops.name));
}

export async function listWarehouses(ctx: AuthContext) {
  const scope = ctx.scope("stock.read").all ? ctx.scope("stock.read") : ctx.scope("equipment.read");
  return db
    .select({
      id: warehouses.id,
      code: warehouses.code,
      name: warehouses.name,
      isMobile: warehouses.isMobile,
      siteId: warehouses.siteId,
      siteName: sites.name,
      companyId: sites.companyId,
    })
    .from(warehouses)
    .innerJoin(sites, eq(sites.id, warehouses.siteId))
    .where(and(eq(warehouses.tenantId, ctx.tenantId), scopeWhere(scope, sites.companyId, sites.id)))
    .orderBy(asc(sites.name), asc(warehouses.name));
}

export async function listJobsites(ctx: AuthContext) {
  const scope = ctx.scope("equipment.read");
  return db
    .select({
      id: jobsites.id,
      code: jobsites.code,
      name: jobsites.name,
      address: jobsites.address,
      companyId: jobsites.companyId,
      companyName: companies.name,
      startDate: jobsites.startDate,
      endDate: jobsites.endDate,
      active: jobsites.active,
    })
    .from(jobsites)
    .innerJoin(companies, eq(companies.id, jobsites.companyId))
    .where(and(eq(jobsites.tenantId, ctx.tenantId), scopeWhere(scope, jobsites.companyId)))
    .orderBy(asc(jobsites.name));
}

export async function listCostCenters(ctx: AuthContext) {
  return db.select().from(costCenters).where(eq(costCenters.tenantId, ctx.tenantId)).orderBy(asc(costCenters.code));
}

/** Options des listes déroulantes de formulaires, dans le périmètre de l'utilisateur. */
export async function getOrganizationOptions(ctx: AuthContext) {
  const [companyRows, siteRows, workshopRows, warehouseRows, jobsiteRows] = await Promise.all([
    listCompanies(ctx),
    listSites(ctx),
    listWorkshops(ctx),
    listWarehouses(ctx),
    listJobsites(ctx),
  ]);
  return {
    companies: companyRows.map((c) => ({ id: c.id, label: c.name })),
    sites: siteRows.map((s) => ({ id: s.id, label: `${s.name} (${s.companyName})`, companyId: s.companyId })),
    workshops: workshopRows.map((w) => ({ id: w.id, label: `${w.name} — ${w.siteName}`, siteId: w.siteId })),
    warehouses: warehouseRows.map((w) => ({ id: w.id, label: `${w.name} — ${w.siteName}`, siteId: w.siteId })),
    jobsites: jobsiteRows.filter((j) => j.active).map((j) => ({ id: j.id, label: j.name, companyId: j.companyId })),
  };
}

/* ------------------------------------------------------------------ */
/* Administration                                                       */
/* ------------------------------------------------------------------ */

const code = z
  .string()
  .trim()
  .min(1, "Code obligatoire")
  .max(30)
  .transform((s) => s.toUpperCase());
const name = z.string().trim().min(1, "Nom obligatoire").max(120);

export const companyInput = z.object({
  code,
  name,
  country: z.string().trim().length(2).default("FR"),
  currency: z.string().trim().length(3).default("EUR"),
});

export const siteInput = z.object({
  companyId: z.uuid("Société obligatoire"),
  code,
  name,
  address: z.string().trim().max(250).optional(),
  timezone: z.string().trim().default("Europe/Paris"),
});

export const workshopInput = z.object({ siteId: z.uuid("Site obligatoire"), code, name, bays: z.coerce.number().int().min(1).default(1) });

export const warehouseInput = z.object({
  siteId: z.uuid("Site obligatoire"),
  code,
  name,
  isMobile: bool.default(false),
});

export const jobsiteInput = z.object({
  companyId: z.uuid("Société obligatoire"),
  code,
  name,
  address: z.string().trim().max(250).optional(),
  startDate: optionalDate,
  endDate: optionalDate,
});

async function guardUnique<T>(promise: Promise<T>, message: string) {
  try {
    return await promise;
  } catch (error) {
    if (isUniqueViolation(error)) throw new ConflictError(message);
    throw error;
  }
}

export function isUniqueViolation(error: unknown) {
  const e = error as { code?: string; cause?: { code?: string } };
  return e?.code === "23505" || e?.cause?.code === "23505";
}

export async function createCompany(ctx: AuthContext, raw: unknown) {
  assertCan(ctx, "settings.manage");
  const input = parseInput(companyInput, raw);
  return db.transaction(async (tx) => {
    const [row] = await guardUnique(
      tx
        .insert(companies)
        .values({ ...input, tenantId: ctx.tenantId })
        .returning(),
      "Ce code de société existe déjà.",
    );
    await audit(tx, ctx, { entityType: "company", entityId: row.id, action: "create", after: row });
    return row;
  });
}

export async function createSite(ctx: AuthContext, raw: unknown) {
  assertCan(ctx, "settings.manage");
  const input = parseInput(siteInput, raw);
  return db.transaction(async (tx) => {
    const [company] = await tx
      .select({ id: companies.id })
      .from(companies)
      .where(and(eq(companies.id, input.companyId), eq(companies.tenantId, ctx.tenantId)));
    if (!company) throw new NotFoundError("Société");
    const [row] = await guardUnique(
      tx
        .insert(sites)
        .values({ ...input, tenantId: ctx.tenantId })
        .returning(),
      "Ce code de site existe déjà.",
    );
    await audit(tx, ctx, { entityType: "site", entityId: row.id, action: "create", after: row });
    return row;
  });
}

async function assertSiteInTenant(ctx: AuthContext, siteId: string) {
  const [site] = await db
    .select({ id: sites.id })
    .from(sites)
    .where(and(eq(sites.id, siteId), eq(sites.tenantId, ctx.tenantId)));
  if (!site) throw new NotFoundError("Site");
}

export async function createWorkshop(ctx: AuthContext, raw: unknown) {
  assertCan(ctx, "settings.manage");
  const input = parseInput(workshopInput, raw);
  await assertSiteInTenant(ctx, input.siteId);
  return db.transaction(async (tx) => {
    const [row] = await guardUnique(
      tx
        .insert(workshops)
        .values({ ...input, tenantId: ctx.tenantId })
        .returning(),
      "Ce code d'atelier existe déjà.",
    );
    await audit(tx, ctx, { entityType: "workshop", entityId: row.id, action: "create", after: row });
    return row;
  });
}

export async function createWarehouse(ctx: AuthContext, raw: unknown) {
  assertCan(ctx, "settings.manage");
  const input = parseInput(warehouseInput, raw);
  await assertSiteInTenant(ctx, input.siteId);
  return db.transaction(async (tx) => {
    const [row] = await guardUnique(
      tx
        .insert(warehouses)
        .values({ ...input, tenantId: ctx.tenantId })
        .returning(),
      "Ce code de magasin existe déjà.",
    );
    await tx.insert(storageLocations).values({ tenantId: ctx.tenantId, warehouseId: row.id, code: "GEN", label: "Emplacement général" });
    await audit(tx, ctx, { entityType: "warehouse", entityId: row.id, action: "create", after: row });
    return row;
  });
}

export async function createJobsite(ctx: AuthContext, raw: unknown) {
  assertCan(ctx, "settings.manage");
  const input = parseInput(jobsiteInput, raw);
  return db.transaction(async (tx) => {
    const [company] = await tx
      .select({ id: companies.id })
      .from(companies)
      .where(and(eq(companies.id, input.companyId), eq(companies.tenantId, ctx.tenantId)));
    if (!company) throw new NotFoundError("Société");
    const [row] = await guardUnique(
      tx
        .insert(jobsites)
        .values({ ...input, tenantId: ctx.tenantId })
        .returning(),
      "Ce code de chantier existe déjà.",
    );
    await audit(tx, ctx, { entityType: "jobsite", entityId: row.id, action: "create", after: row });
    return row;
  });
}

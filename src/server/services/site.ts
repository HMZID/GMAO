import "server-only";
import { and, asc, eq, ne } from "drizzle-orm";
import { z } from "zod";
import type { AuthContext } from "@/server/authz/context";
import { db, type DbOrTx } from "@/server/db";
import { siteItems, sitePages, sitePlans, siteSettings } from "@/server/db/schema";
import {
  SITE_ICONS,
  SITE_ITEM_KINDS,
  SITE_SETTING_GROUPS,
  SITE_SETTINGS,
  SLUG_PATTERN,
  isSiteItemKind,
  resolveSettings,
  slugify,
  type SiteItemKind,
} from "@/server/domain/site";
import { DEFAULT_SITE_ITEMS, DEFAULT_SITE_PAGES, DEFAULT_SITE_PLANS } from "@/server/domain/site-defaults";
import { BusinessRuleError, ConflictError, NotFoundError } from "@/server/errors";
import { bool, clearable, text } from "@/server/validation";
import { audit, parseInput } from "./_shared";
import { assertPlatformAdmin } from "./platform";

/* ------------------------------------------------------------------ */
/* Site commercial : contenu public et administration du contenu        */
/* ------------------------------------------------------------------ */

/** Marque posée au premier chargement du contenu initial : supprimer tout le contenu ne le recharge pas. */
const INITIALIZED_KEY = "_initialized";

/**
 * Contenu initial (`site-defaults.ts`) chargé une seule fois dans une base neuve. La marque est posée dans
 * la même transaction, avec ON CONFLICT : deux premières visites simultanées ne chargent pas deux fois.
 */
export async function ensureSiteContent() {
  await db.transaction(async (tx) => {
    const marked = await tx
      .insert(siteSettings)
      .values({ key: INITIALIZED_KEY, value: new Date().toISOString() })
      .onConflictDoNothing()
      .returning({ key: siteSettings.key });
    if (marked.length === 0) return;
    const positions = new Map<string, number>();
    await tx.insert(siteItems).values(
      DEFAULT_SITE_ITEMS.map((item) => {
        const position = positions.get(item.kind) ?? 0;
        positions.set(item.kind, position + 1);
        return { ...item, position, published: item.published ?? true };
      }),
    );
    await tx.insert(sitePlans).values(DEFAULT_SITE_PLANS.map((plan, position) => ({ ...plan, features: plan.features.join("\n"), position })));
    await tx.insert(sitePages).values(DEFAULT_SITE_PAGES.map((page, position) => ({ ...page, position })));
  });
}

async function loadSettings(tx: DbOrTx = db) {
  let rows = await tx.select({ key: siteSettings.key, value: siteSettings.value }).from(siteSettings);
  if (!rows.some((r) => r.key === INITIALIZED_KEY)) {
    await ensureSiteContent();
    rows = await tx.select({ key: siteSettings.key, value: siteSettings.value }).from(siteSettings);
  }
  return resolveSettings(rows);
}

/** Réglages du site (textes généraux), complétés par les valeurs par défaut. */
export async function getSiteSettings() {
  return loadSettings();
}

export type PublicSiteItem = { id: string; title: string; body: string | null; meta: string | null; icon: string | null };

/** Tout le contenu publié de la vitrine : réglages, blocs par type, offres et pages du pied de page. */
export async function getPublicSite() {
  const settings = await loadSettings();
  const items = await db
    .select({ id: siteItems.id, kind: siteItems.kind, title: siteItems.title, body: siteItems.body, meta: siteItems.meta, icon: siteItems.icon })
    .from(siteItems)
    .where(eq(siteItems.published, true))
    .orderBy(asc(siteItems.position), asc(siteItems.createdAt));
  const plans = await db.select().from(sitePlans).where(eq(sitePlans.published, true)).orderBy(asc(sitePlans.position), asc(sitePlans.createdAt));
  const footerPages = await db
    .select({ slug: sitePages.slug, title: sitePages.title })
    .from(sitePages)
    .where(and(eq(sitePages.published, true), eq(sitePages.showInFooter, true)))
    .orderBy(asc(sitePages.position), asc(sitePages.title));
  const byKind = Object.fromEntries(SITE_ITEM_KINDS.map((k) => [k, [] as PublicSiteItem[]])) as Record<SiteItemKind, PublicSiteItem[]>;
  for (const { kind, ...item } of items) if (isSiteItemKind(kind)) byKind[kind].push(item);
  return { settings, items: byKind, plans, footerPages };
}

export type PublicSite = Awaited<ReturnType<typeof getPublicSite>>;

/** Page libre publiée, ou null. */
export async function getPublicPage(slug: string) {
  if (!SLUG_PATTERN.test(slug)) return null;
  const [page] = await db
    .select()
    .from(sitePages)
    .where(and(eq(sitePages.slug, slug), eq(sitePages.published, true)));
  return page ?? null;
}

/** Pages publiées (plan du site). */
export async function listPublishedPages() {
  return db.select({ slug: sitePages.slug, updatedAt: sitePages.updatedAt }).from(sitePages).where(eq(sitePages.published, true));
}

/* ------------------------------------------------------------------ */
/* Administration : réglages                                            */
/* ------------------------------------------------------------------ */

const settingsGroupInput = z.object({ group: z.enum(SITE_SETTING_GROUPS.map((g) => g.id) as [string, ...string[]]) });

/**
 * Enregistre les réglages d'une rubrique. Une case non cochée vaut « false » ; une valeur vide reprend
 * la valeur par défaut. Toutes les erreurs sont signalées en une fois.
 */
export async function updateSiteSettings(ctx: AuthContext, raw: Record<string, unknown>) {
  assertPlatformAdmin(ctx);
  const { group } = parseInput(settingsGroupInput, raw);
  const definitions = SITE_SETTINGS.filter((s) => s.group === group);
  const errors: string[] = [];
  const values: { key: string; value: string }[] = [];
  for (const def of definitions) {
    const input = raw[def.key];
    let value = typeof input === "string" ? input.trim() : "";
    if (def.type === "boolean") value = input === "on" || input === "true" ? "true" : "false";
    if (value === "") value = def.default;
    if (def.type === "number" && !Number.isFinite(Number(value.replace(",", ".")))) errors.push(`${def.label} : nombre attendu.`);
    if (def.type === "number") value = value.replace(",", ".");
    if (def.type === "email" && value && !z.email().safeParse(value).success) errors.push(`${def.label} : courriel invalide.`);
    if (value.length > (def.type === "textarea" ? 2000 : 300)) errors.push(`${def.label} : texte trop long.`);
    values.push({ key: def.key, value });
  }
  if (errors.length) throw new BusinessRuleError(errors);
  await db.transaction(async (tx) => {
    for (const v of values) {
      await tx
        .insert(siteSettings)
        .values(v)
        .onConflictDoUpdate({ target: siteSettings.key, set: { value: v.value, updatedAt: new Date() } });
    }
    await audit(tx, ctx, {
      entityType: "site_settings",
      entityId: group,
      action: "update",
      after: Object.fromEntries(values.map((v) => [v.key, v.value])),
    });
  });
}

/* ------------------------------------------------------------------ */
/* Administration : blocs                                               */
/* ------------------------------------------------------------------ */

const optionalString = (max: number) => clearable(z.string().trim().max(max));

export const siteItemInput = z.object({
  title: text(160, "Titre obligatoire"),
  body: optionalString(2000),
  meta: optionalString(160),
  icon: clearable(z.enum(SITE_ICONS, "Icône inconnue")),
  published: bool,
});

export async function listSiteItems(ctx: AuthContext, kind: SiteItemKind) {
  assertPlatformAdmin(ctx);
  return db.select().from(siteItems).where(eq(siteItems.kind, kind)).orderBy(asc(siteItems.position), asc(siteItems.createdAt));
}

export async function createSiteItem(ctx: AuthContext, kind: string, raw: unknown) {
  assertPlatformAdmin(ctx);
  if (!isSiteItemKind(kind)) throw new NotFoundError("Type de bloc");
  const input = parseInput(siteItemInput, raw);
  return db.transaction(async (tx) => {
    const last = await tx.select({ position: siteItems.position }).from(siteItems).where(eq(siteItems.kind, kind)).orderBy(asc(siteItems.position));
    const position = last.length ? last[last.length - 1].position + 1 : 0;
    const [created] = await tx
      .insert(siteItems)
      .values({ kind, ...input, body: input.body ?? null, meta: input.meta ?? null, icon: input.icon ?? null, position })
      .returning({ id: siteItems.id });
    await audit(tx, ctx, { entityType: "site_item", entityId: created.id, action: "create", after: { kind, ...input } });
    return created;
  });
}

async function loadItem(id: string) {
  if (!z.uuid().safeParse(id).success) throw new NotFoundError("Bloc");
  const [item] = await db.select().from(siteItems).where(eq(siteItems.id, id));
  if (!item) throw new NotFoundError("Bloc");
  return item;
}

export async function updateSiteItem(ctx: AuthContext, id: string, raw: unknown) {
  assertPlatformAdmin(ctx);
  const before = await loadItem(id);
  const input = parseInput(siteItemInput, raw);
  await db.transaction(async (tx) => {
    await tx.update(siteItems).set(input).where(eq(siteItems.id, id));
    await audit(tx, ctx, { entityType: "site_item", entityId: id, action: "update", before, after: input });
  });
}

export async function deleteSiteItem(ctx: AuthContext, id: string) {
  assertPlatformAdmin(ctx);
  const before = await loadItem(id);
  await db.transaction(async (tx) => {
    await tx.delete(siteItems).where(eq(siteItems.id, id));
    await audit(tx, ctx, { entityType: "site_item", entityId: id, action: "delete", before });
  });
}

/** Rang d'un élément dans sa liste : échange avec son voisin, puis renumérotation continue (0, 1, 2…). */
function reorder<T extends { id: string }>(rows: T[], id: string, direction: "up" | "down") {
  const index = rows.findIndex((r) => r.id === id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= rows.length) return null;
  const next = [...rows];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

const directionInput = z.object({ direction: z.enum(["up", "down"]) });

export async function moveSiteItem(ctx: AuthContext, id: string, raw: unknown) {
  assertPlatformAdmin(ctx);
  const item = await loadItem(id);
  const { direction } = parseInput(directionInput, raw);
  await db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: siteItems.id })
      .from(siteItems)
      .where(eq(siteItems.kind, item.kind))
      .orderBy(asc(siteItems.position), asc(siteItems.createdAt));
    const next = reorder(rows, id, direction);
    if (!next) return;
    for (const [position, row] of next.entries()) await tx.update(siteItems).set({ position }).where(eq(siteItems.id, row.id));
  });
}

/* ------------------------------------------------------------------ */
/* Administration : offres                                              */
/* ------------------------------------------------------------------ */

/** Prix saisi « 7,50 » ou « 7.50 » ; vide : sur devis. */
const price = z.preprocess(
  (v) => (typeof v === "string" ? v.replace(/\s/g, "").replace(",", ".") : v),
  z.coerce.number({ error: "Prix attendu" }).min(0, "Prix positif attendu").max(100_000),
);

export const sitePlanInput = z.object({
  name: text(60, "Nom obligatoire"),
  tagline: optionalString(200),
  priceMonthly: clearable(price),
  priceUnit: optionalString(80),
  priceNote: optionalString(160),
  features: z.string().trim().max(3000).default(""),
  ctaLabel: optionalString(60),
  badge: optionalString(40),
  highlighted: bool,
  published: bool,
});

export async function listSitePlans(ctx: AuthContext) {
  assertPlatformAdmin(ctx);
  return db.select().from(sitePlans).orderBy(asc(sitePlans.position), asc(sitePlans.createdAt));
}

export async function createSitePlan(ctx: AuthContext, raw: unknown) {
  assertPlatformAdmin(ctx);
  const input = parseInput(sitePlanInput, raw);
  return db.transaction(async (tx) => {
    const rows = await tx.select({ position: sitePlans.position }).from(sitePlans).orderBy(asc(sitePlans.position));
    const position = rows.length ? rows[rows.length - 1].position + 1 : 0;
    const [created] = await tx
      .insert(sitePlans)
      .values({ ...input, position })
      .returning({ id: sitePlans.id });
    await audit(tx, ctx, { entityType: "site_plan", entityId: created.id, action: "create", after: input });
    return created;
  });
}

async function loadPlan(id: string) {
  if (!z.uuid().safeParse(id).success) throw new NotFoundError("Offre");
  const [plan] = await db.select().from(sitePlans).where(eq(sitePlans.id, id));
  if (!plan) throw new NotFoundError("Offre");
  return plan;
}

export async function updateSitePlan(ctx: AuthContext, id: string, raw: unknown) {
  assertPlatformAdmin(ctx);
  const before = await loadPlan(id);
  const input = parseInput(sitePlanInput, raw);
  await db.transaction(async (tx) => {
    await tx.update(sitePlans).set(input).where(eq(sitePlans.id, id));
    await audit(tx, ctx, { entityType: "site_plan", entityId: id, action: "update", before, after: input });
  });
}

export async function deleteSitePlan(ctx: AuthContext, id: string) {
  assertPlatformAdmin(ctx);
  const before = await loadPlan(id);
  await db.transaction(async (tx) => {
    await tx.delete(sitePlans).where(eq(sitePlans.id, id));
    await audit(tx, ctx, { entityType: "site_plan", entityId: id, action: "delete", before });
  });
}

export async function moveSitePlan(ctx: AuthContext, id: string, raw: unknown) {
  assertPlatformAdmin(ctx);
  await loadPlan(id);
  const { direction } = parseInput(directionInput, raw);
  await db.transaction(async (tx) => {
    const rows = await tx.select({ id: sitePlans.id }).from(sitePlans).orderBy(asc(sitePlans.position), asc(sitePlans.createdAt));
    const next = reorder(rows, id, direction);
    if (!next) return;
    for (const [position, row] of next.entries()) await tx.update(sitePlans).set({ position }).where(eq(sitePlans.id, row.id));
  });
}

/* ------------------------------------------------------------------ */
/* Administration : pages libres                                        */
/* ------------------------------------------------------------------ */

export const sitePageInput = z.object({
  title: text(120, "Titre obligatoire"),
  slug: clearable(z.string().trim().max(80).regex(SLUG_PATTERN, "Adresse : minuscules, chiffres et tirets (ex. a-propos)")),
  summary: optionalString(300),
  body: z.string().max(20_000, "Texte trop long").default(""),
  showInFooter: bool,
  published: bool,
});

export async function listSitePages(ctx: AuthContext) {
  assertPlatformAdmin(ctx);
  return db
    .select({
      id: sitePages.id,
      slug: sitePages.slug,
      title: sitePages.title,
      published: sitePages.published,
      showInFooter: sitePages.showInFooter,
      updatedAt: sitePages.updatedAt,
    })
    .from(sitePages)
    .orderBy(asc(sitePages.position), asc(sitePages.title));
}

export async function getSitePage(ctx: AuthContext, id: string) {
  assertPlatformAdmin(ctx);
  if (!z.uuid().safeParse(id).success) throw new NotFoundError("Page");
  const [page] = await db.select().from(sitePages).where(eq(sitePages.id, id));
  if (!page) throw new NotFoundError("Page");
  return page;
}

async function assertFreeSlug(tx: DbOrTx, slug: string, exceptId?: string) {
  const [taken] = await tx
    .select({ id: sitePages.id })
    .from(sitePages)
    .where(and(eq(sitePages.slug, slug), exceptId ? ne(sitePages.id, exceptId) : undefined));
  if (taken) throw new ConflictError(`L'adresse « ${slug} » est déjà utilisée par une autre page.`);
}

export async function createSitePage(ctx: AuthContext, raw: unknown) {
  assertPlatformAdmin(ctx);
  const input = parseInput(sitePageInput, raw);
  const slug = input.slug || slugify(input.title);
  if (!slug) throw new BusinessRuleError(["Adresse de la page impossible à déduire du titre : la saisir."]);
  return db.transaction(async (tx) => {
    await assertFreeSlug(tx, slug);
    const rows = await tx.select({ position: sitePages.position }).from(sitePages).orderBy(asc(sitePages.position));
    const position = rows.length ? rows[rows.length - 1].position + 1 : 0;
    const [created] = await tx
      .insert(sitePages)
      .values({ ...input, slug, position })
      .returning({ id: sitePages.id });
    await audit(tx, ctx, { entityType: "site_page", entityId: created.id, action: "create", after: { ...input, slug } });
    return created;
  });
}

export async function updateSitePage(ctx: AuthContext, id: string, raw: unknown) {
  const before = await getSitePage(ctx, id);
  const input = parseInput(sitePageInput, raw);
  const slug = input.slug || slugify(input.title);
  if (!slug) throw new BusinessRuleError(["Adresse de la page impossible à déduire du titre : la saisir."]);
  await db.transaction(async (tx) => {
    await assertFreeSlug(tx, slug, id);
    await tx
      .update(sitePages)
      .set({ ...input, slug })
      .where(eq(sitePages.id, id));
    await audit(tx, ctx, { entityType: "site_page", entityId: id, action: "update", before, after: { ...input, slug } });
  });
}

export async function deleteSitePage(ctx: AuthContext, id: string) {
  const before = await getSitePage(ctx, id);
  await db.transaction(async (tx) => {
    await tx.delete(sitePages).where(eq(sitePages.id, id));
    await audit(tx, ctx, { entityType: "site_page", entityId: id, action: "delete", before: { slug: before.slug, title: before.title } });
  });
}

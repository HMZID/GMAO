import { boolean, index, integer, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { createdAt, id, money, ts, updatedAt } from "./columns";
import { tenants } from "./organization";

/**
 * Site commercial (vitrine publique) : contenu géré par l'administrateur de la plateforme, hors organisation.
 * Les textes généraux sont des réglages clé → valeur ; les listes (fonctionnalités, étapes, questions,
 * témoignages, chiffres) sont des blocs ordonnés ; les offres et les pages libres ont leur propre table.
 */

export const siteSettings = pgTable("site_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: updatedAt(),
});

/** Bloc de contenu d'une liste de la page d'accueil ; `kind` : voir SITE_ITEM_KINDS (`src/server/domain/site.ts`). */
export const siteItems = pgTable(
  "site_items",
  {
    id: id(),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    /** Complément selon le type : module, fonction et société d'un témoignage, unité d'un chiffre. */
    meta: text("meta"),
    icon: text("icon"),
    position: integer("position").notNull().default(0),
    published: boolean("published").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("site_items_kind_idx").on(t.kind, t.position)],
);

/** Offre tarifaire ; prix mensuel absent : « sur devis ». */
export const sitePlans = pgTable("site_plans", {
  id: id(),
  name: text("name").notNull(),
  tagline: text("tagline"),
  priceMonthly: money("price_monthly"),
  priceUnit: text("price_unit"),
  /** Condition affichée sous le prix (minimum d'équipements, engagement). */
  priceNote: text("price_note"),
  /** Avantages, un par ligne. */
  features: text("features").notNull().default(""),
  ctaLabel: text("cta_label"),
  badge: text("badge"),
  highlighted: boolean("highlighted").notNull().default(false),
  position: integer("position").notNull().default(0),
  published: boolean("published").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Page libre du site (mentions légales, confidentialité, à propos…), servie sous /infos/<slug>. */
export const sitePages = pgTable(
  "site_pages",
  {
    id: id(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    /** Résumé : description pour les moteurs de recherche et chapeau de la page. */
    summary: text("summary"),
    /** Texte simple : titres « ## », listes « - », liens [texte](adresse). */
    body: text("body").notNull().default(""),
    showInFooter: boolean("show_in_footer").notNull().default(true),
    published: boolean("published").notNull().default(true),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("site_pages_slug_uq").on(t.slug)],
);

/**
 * Demande de compte de démonstration déposée sur le site. L'administrateur de la plateforme l'accepte
 * (organisation de démonstration ouverte, accès envoyés par courriel) ou la refuse.
 */
export const demoRequests = pgTable(
  "demo_requests",
  {
    id: id(),
    company: text("company").notNull(),
    contactName: text("contact_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    jobTitle: text("job_title"),
    fleetSize: text("fleet_size"),
    sector: text("sector"),
    message: text("message"),
    /** Offre consultée avant la demande (nom de l'offre). */
    planInterest: text("plan_interest"),
    /** Langue du site au moment de la demande : celle des courriels adressés au prospect. */
    locale: text("locale").notNull().default("fr"),
    consentAt: ts("consent_at").notNull(),
    /** Empreinte de l'adresse IP (limitation des envois), jamais l'adresse elle-même. */
    ipHash: text("ip_hash"),
    /** PENDING, APPROVED ou REJECTED. */
    status: text("status").notNull().default("PENDING"),
    durationDays: integer("duration_days"),
    decidedAt: ts("decided_at"),
    decidedById: text("decided_by_id").references(() => user.id, { onDelete: "set null" }),
    decisionNote: text("decision_note"),
    tenantId: uuid("tenant_id").references(() => tenants.id),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    /** Dernier envoi des accès (mot de passe provisoire). */
    accessSentAt: ts("access_sent_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("demo_requests_status_idx").on(t.status, t.createdAt), index("demo_requests_email_idx").on(t.email)],
);

import { boolean, doublePrecision, index, integer, jsonb, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, ts, updatedAt } from "./columns";
import { auditChannelEnum } from "./enums";

/**
 * Organisation multi-sociétés (CDC §1.3) :
 * groupe (tenant) → sociétés → sites → ateliers / magasins ; chantiers rattachés à une société.
 */

export const tenants = pgTable("tenants", {
  id: id(),
  name: text("name").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const companies = pgTable(
  "companies",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    country: text("country").notNull().default("FR"),
    currency: text("currency").notNull().default("EUR"),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("companies_tenant_code_uq").on(t.tenantId, t.code)],
);

export const sites = pgTable(
  "sites",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    address: text("address"),
    timezone: text("timezone").notNull().default("Europe/Paris"),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("sites_tenant_code_uq").on(t.tenantId, t.code), index("sites_company_idx").on(t.companyId)],
);

export const workshops = pgTable(
  "workshops",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    /** Nombre de postes de travail simultanés (PLA-08). */
    bays: integer("bays").notNull().default(1),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("workshops_tenant_code_uq").on(t.tenantId, t.code)],
);

export const warehouses = pgTable(
  "warehouses",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    /** Camion atelier ou conteneur de chantier (CDC §7.1). */
    isMobile: boolean("is_mobile").notNull().default(false),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("warehouses_tenant_code_uq").on(t.tenantId, t.code)],
);

export const storageLocations = pgTable(
  "storage_locations",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id),
    code: text("code").notNull(),
    label: text("label"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("storage_locations_wh_code_uq").on(t.warehouseId, t.code)],
);

export const jobsites = pgTable(
  "jobsites",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    address: text("address"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    startDate: ts("start_date"),
    endDate: ts("end_date"),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("jobsites_tenant_code_uq").on(t.tenantId, t.code)],
);

export const costCenters = pgTable(
  "cost_centers",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("cost_centers_company_code_uq").on(t.companyId, t.code)],
);

/** Journal d'audit en ajout seul (HAB-06, TEC-05). */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    userId: text("user_id"),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    action: text("action").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    channel: auditChannelEnum("channel").notNull().default("WEB"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_logs_entity_idx").on(t.entityType, t.entityId), index("audit_logs_tenant_created_idx").on(t.tenantId, t.createdAt)],
);

/** Compteurs de numérotation (OT, DI) par société et par année (COR-05). */
export const sequences = pgTable(
  "sequences",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    kind: text("kind").notNull(),
    year: integer("year").notNull(),
    value: integer("value").notNull().default(0),
  },
  (t) => [uniqueIndex("sequences_uq").on(t.companyId, t.kind, t.year)],
);

import { boolean, index, integer, jsonb, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, meterValue, money, ts, updatedAt } from "./columns";
import {
  acquisitionModeEnum,
  criticalityEnum,
  equipmentStatusEnum,
  meterEventTypeEnum,
  meterTypeEnum,
  readingSourceEnum,
  readingStatusEnum,
} from "./enums";
import { companies, costCenters, jobsites, sites, tenants, workshops } from "./organization";
import { user } from "./auth";

/** Référentiel des équipements (CDC §3) : catégorie → modèle → équipement → sous-ensembles. */

export const equipmentCategories = pgTable(
  "equipment_categories",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    parentId: uuid("parent_id"),
    code: text("code").notNull(),
    name: text("name").notNull(),
    defaultCriticality: criticalityEnum("default_criticality").notNull().default("B"),
    /** EQP-03 : attributs techniques propres à la catégorie, ex. [{ key: "capaciteLevage", label: "Capacité de levage", unit: "kg" }]. */
    attributeDefinitions: jsonb("attribute_definitions").$type<AttributeDefinition[]>().notNull().default([]),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("equipment_categories_tenant_code_uq").on(t.tenantId, t.code)],
);

export type AttributeDefinition = { key: string; label: string; unit?: string };

export const equipmentModels = pgTable(
  "equipment_models",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => equipmentCategories.id),
    manufacturer: text("manufacturer").notNull(),
    name: text("name").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("equipment_models_uq").on(t.tenantId, t.manufacturer, t.name)],
);

export const equipment = pgTable(
  "equipment",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    /** Société propriétaire (CDC §1.3). */
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    /** Site de rattachement. */
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => equipmentCategories.id),
    modelId: uuid("model_id").references(() => equipmentModels.id),
    /** Code parc, unique dans le groupe. */
    code: text("code").notNull(),
    name: text("name").notNull(),
    manufacturer: text("manufacturer").notNull(),
    serialNumber: text("serial_number"),
    registration: text("registration"),
    year: integer("year"),
    status: equipmentStatusEnum("status").notNull().default("AVAILABLE"),
    criticality: criticalityEnum("criticality").notNull().default("B"),
    acquisitionMode: acquisitionModeEnum("acquisition_mode").notNull().default("PURCHASE"),
    acquisitionDate: ts("acquisition_date"),
    acquisitionValue: money("acquisition_value"),
    commissioningDate: ts("commissioning_date"),
    warrantyEndDate: ts("warranty_end_date"),
    warrantyEndMeter: meterValue("warranty_end_meter"),
    costCenterId: uuid("cost_center_id").references(() => costCenters.id),
    /** Valeurs des attributs de la catégorie (EQP-03). */
    attributes: jsonb("attributes").$type<Record<string, string | number | null>>().notNull().default({}),
    /** Jeton encodé dans le QR code (EQP-09) ; stable lors des réimpressions. */
    qrToken: text("qr_token").notNull(),
    notes: text("notes"),
    retiredAt: ts("retired_at"),
    retirementReason: text("retirement_reason"),
    disposalValue: money("disposal_value"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("equipment_tenant_code_uq").on(t.tenantId, t.code),
    // EQP-02 : marque + numéro de série unique dans le groupe
    uniqueIndex("equipment_tenant_serial_uq").on(t.tenantId, t.manufacturer, t.serialNumber),
    uniqueIndex("equipment_qr_token_uq").on(t.qrToken),
    index("equipment_scope_idx").on(t.tenantId, t.companyId, t.siteId),
    index("equipment_status_idx").on(t.tenantId, t.status),
  ],
);

/** Historique daté et motivé des états opérationnels (EQP-05). */
export const equipmentStatusHistory = pgTable(
  "equipment_status_history",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    equipmentId: uuid("equipment_id")
      .notNull()
      .references(() => equipment.id),
    fromStatus: equipmentStatusEnum("from_status"),
    toStatus: equipmentStatusEnum("to_status").notNull(),
    reason: text("reason"),
    /** Lien informatif vers l'OT à l'origine du changement (sans contrainte, pour éviter un cycle de schéma). */
    workOrderId: uuid("work_order_id"),
    changedById: text("changed_by_id").references(() => user.id),
    changedAt: createdAt(),
  },
  (t) => [index("equipment_status_history_eq_idx").on(t.equipmentId, t.changedAt)],
);

/** Sous-ensembles maintenables (EQP-08). */
export const components = pgTable(
  "components",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    equipmentId: uuid("equipment_id").references(() => equipment.id),
    type: text("type").notNull(),
    name: text("name").notNull(),
    serialNumber: text("serial_number"),
    installedAt: ts("installed_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("components_equipment_idx").on(t.equipmentId)],
);

/** Affectations datées à un site, un chantier ou un atelier (EQP-10, DON-13). */
export const assignments = pgTable(
  "assignments",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    equipmentId: uuid("equipment_id")
      .notNull()
      .references(() => equipment.id),
    siteId: uuid("site_id").references(() => sites.id),
    jobsiteId: uuid("jobsite_id").references(() => jobsites.id),
    workshopId: uuid("workshop_id").references(() => workshops.id),
    responsibleUserId: text("responsible_user_id").references(() => user.id),
    startAt: ts("start_at").notNull(),
    endAt: ts("end_at"),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (t) => [index("assignments_equipment_idx").on(t.equipmentId, t.startAt)],
);

/** Documents et photos (EQP-07). Le stockage des fichiers est à brancher (S3, Azure Blob…). */
export const documents = pgTable(
  "documents",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    storageKey: text("storage_key"),
    url: text("url"),
    expiresAt: ts("expires_at"),
    uploadedById: text("uploaded_by_id").references(() => user.id),
    createdAt: createdAt(),
  },
  (t) => [index("documents_entity_idx").on(t.entityType, t.entityId)],
);

/**
 * Compteurs (EQP-04). La valeur cumulée = valeur lue + offset ;
 * l'offset accumule les remplacements de compteur (DON-04).
 */
export const meters = pgTable(
  "meters",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    equipmentId: uuid("equipment_id")
      .notNull()
      .references(() => equipment.id),
    componentId: uuid("component_id").references(() => components.id),
    type: meterTypeEnum("type").notNull(),
    unit: text("unit").notNull(),
    label: text("label").notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    offset: meterValue("offset").notNull().default(0),
    lastValue: meterValue("last_value"),
    lastCumulativeValue: meterValue("last_cumulative_value"),
    lastReadAt: ts("last_read_at"),
    /** Utilisation moyenne par jour (30 derniers jours), pour projeter les échéances (PRV-07). */
    averageDailyUsage: meterValue("average_daily_usage"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("meters_equipment_idx").on(t.equipmentId)],
);

/** Relevés de compteur, horodatés et sourcés (DON-03). */
export const meterReadings = pgTable(
  "meter_readings",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    meterId: uuid("meter_id")
      .notNull()
      .references(() => meters.id),
    readAt: ts("read_at").notNull(),
    /** Valeur affichée par le compteur physique. */
    value: meterValue("value").notNull(),
    /** Valeur cumulée depuis la mise en service (valeur + offset du moment). */
    cumulativeValue: meterValue("cumulative_value").notNull(),
    source: readingSourceEnum("source").notNull().default("MANUAL"),
    status: readingStatusEnum("status").notNull().default("VALID"),
    statusReasons: jsonb("status_reasons").$type<string[]>().notNull().default([]),
    /** Identifiant généré par le client (mobile, interface) : garantit l'idempotence (MOB-08). */
    clientId: text("client_id"),
    workOrderId: uuid("work_order_id"),
    comment: text("comment"),
    createdById: text("created_by_id").references(() => user.id),
    createdAt: createdAt(),
  },
  (t) => [index("meter_readings_meter_idx").on(t.meterId, t.readAt), uniqueIndex("meter_readings_client_uq").on(t.tenantId, t.clientId)],
);

/** Remplacements et corrections de compteur (DON-04, DON-05). */
export const meterEvents = pgTable(
  "meter_events",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    meterId: uuid("meter_id")
      .notNull()
      .references(() => meters.id),
    type: meterEventTypeEnum("type").notNull(),
    occurredAt: ts("occurred_at").notNull(),
    oldFinalValue: meterValue("old_final_value"),
    newInitialValue: meterValue("new_initial_value"),
    readingId: uuid("reading_id").references(() => meterReadings.id),
    reason: text("reason").notNull(),
    createdById: text("created_by_id").references(() => user.id),
    createdAt: createdAt(),
  },
  (t) => [index("meter_events_meter_idx").on(t.meterId, t.occurredAt)],
);

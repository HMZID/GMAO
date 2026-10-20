import { boolean, index, jsonb, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { createdAt, id, meterValue, money, quantity, ts, updatedAt } from "./columns";
import { fluidKindEnum, fuelEntryStatusEnum, fuelReviewEnum, fuelSourceEnum } from "./enums";
import { equipment, meters } from "./equipment";
import { companies, sites, tenants } from "./organization";

/**
 * Réglages carburant d'un équipement : carburant attendu, capacité du réservoir et consommation de référence
 * (L/h ou L/100 km selon le compteur principal). Sans référence, la médiane des pleins précédents sert de repère.
 */
export const equipmentFuelSettings = pgTable("equipment_fuel_settings", {
  equipmentId: uuid("equipment_id")
    .primaryKey()
    .references(() => equipment.id),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  fuelType: fluidKindEnum("fuel_type"),
  tankCapacity: quantity("tank_capacity"),
  referenceConsumption: quantity("reference_consumption"),
  updatedAt: updatedAt(),
});

/**
 * Cartes carburant (Agil, Total, Shell, Star…). Seuls les 4 derniers chiffres sont conservés, jamais le numéro
 * complet. Une carte peut être affectée à un équipement : son usage sur un autre équipement est signalé.
 */
export const fuelCards = pgTable(
  "fuel_cards",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    provider: text("provider").notNull(),
    last4: text("last4").notNull(),
    label: text("label"),
    equipmentId: uuid("equipment_id").references(() => equipment.id),
    holderName: text("holder_name"),
    validTo: ts("valid_to"),
    monthlyLimitLitres: quantity("monthly_limit_litres"),
    active: boolean("active").notNull().default(true),
    createdById: text("created_by_id").references(() => user.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("fuel_cards_uq").on(t.tenantId, t.provider, t.last4), index("fuel_cards_equipment_idx").on(t.equipmentId)],
);

/**
 * Pleins et appoints (carburant, AdBlue, huiles, liquides). Jamais supprimés (DON-06) : un plein erroné est annulé
 * avec un motif et sort des calculs. Les anomalies détectées à la saisie sont conservées avec leur examen.
 */
export const fuelEntries = pgTable(
  "fuel_entries",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id),
    equipmentId: uuid("equipment_id")
      .notNull()
      .references(() => equipment.id),
    fluid: fluidKindEnum("fluid").notNull(),
    quantity: quantity("quantity").notNull(),
    /** Prix au litre : 3 décimales (millimes du dinar). */
    unitPrice: quantity("unit_price"),
    amount: money("amount"),
    filledAt: ts("filled_at").notNull(),
    /** Compteur principal : valeur lue au plein et valeur cumulée (après remplacement de compteur, DON-04). */
    meterId: uuid("meter_id").references(() => meters.id),
    meterValue: meterValue("meter_value"),
    cumulativeMeterValue: meterValue("cumulative_meter_value"),
    fullTank: boolean("full_tank").notNull().default(true),
    station: text("station"),
    reference: text("reference"),
    fuelCardId: uuid("fuel_card_id").references(() => fuelCards.id),
    source: fuelSourceEnum("source").notNull().default("MANUAL"),
    anomalies: jsonb("anomalies").$type<{ code: string; message: string }[]>().notNull().default([]),
    reviewStatus: fuelReviewEnum("review_status").notNull().default("NONE"),
    reviewComment: text("review_comment"),
    reviewedById: text("reviewed_by_id").references(() => user.id),
    reviewedAt: ts("reviewed_at"),
    status: fuelEntryStatusEnum("status").notNull().default("VALID"),
    cancelReason: text("cancel_reason"),
    /** Idempotence des saisies hors connexion et des imports de relevés de carte. */
    clientId: text("client_id"),
    createdById: text("created_by_id").references(() => user.id),
    createdAt: createdAt(),
  },
  (t) => [
    index("fuel_entries_equipment_idx").on(t.equipmentId, t.filledAt),
    index("fuel_entries_scope_idx").on(t.tenantId, t.companyId, t.siteId, t.filledAt),
    index("fuel_entries_review_idx").on(t.tenantId, t.reviewStatus),
    uniqueIndex("fuel_entries_client_uq").on(t.tenantId, t.clientId),
  ],
);

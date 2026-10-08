import { boolean, index, integer, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, money, quantity, updatedAt } from "./columns";
import { criticalityEnum, partTrackingEnum } from "./enums";
import { equipment, equipmentModels } from "./equipment";
import { storageLocations, tenants, warehouses } from "./organization";

/** Pièces détachées, fournisseurs et niveaux de stock (CDC §7, §8). */

export const suppliers = pgTable(
  "suppliers",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    name: text("name").notNull(),
    /** Identifiant fiscal : clé de dédoublonnage (DON-12). */
    taxId: text("tax_id"),
    email: text("email"),
    phone: text("phone"),
    address: text("address"),
    isContractor: boolean("is_contractor").notNull().default(false),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("suppliers_tenant_tax_uq").on(t.tenantId, t.taxId)],
);

export const parts = pgTable(
  "parts",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    /** Référence interne. */
    sku: text("sku").notNull(),
    name: text("name").notNull(),
    family: text("family"),
    unit: text("unit").notNull().default("u"),
    manufacturer: text("manufacturer"),
    manufacturerRef: text("manufacturer_ref"),
    tracking: partTrackingEnum("tracking").notNull().default("QUANTITY"),
    isRepairable: boolean("is_repairable").notNull().default(false),
    criticality: criticalityEnum("criticality").notNull().default("C"),
    /** Coût moyen pondéré (STK-15). */
    averageCost: money("average_cost").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("parts_tenant_sku_uq").on(t.tenantId, t.sku),
    // STK-01 : marque + référence fabricant unique
    uniqueIndex("parts_tenant_mfr_ref_uq").on(t.tenantId, t.manufacturer, t.manufacturerRef),
  ],
);

/** Compatibilités article ↔ modèle ou équipement (STK-02). */
export const partCompatibilities = pgTable(
  "part_compatibilities",
  {
    id: id(),
    partId: uuid("part_id")
      .notNull()
      .references(() => parts.id, { onDelete: "cascade" }),
    modelId: uuid("model_id").references(() => equipmentModels.id),
    equipmentId: uuid("equipment_id").references(() => equipment.id),
  },
  (t) => [index("part_compat_part_idx").on(t.partId)],
);

export const partSuppliers = pgTable(
  "part_suppliers",
  {
    id: id(),
    partId: uuid("part_id")
      .notNull()
      .references(() => parts.id, { onDelete: "cascade" }),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id),
    supplierRef: text("supplier_ref"),
    price: money("price"),
    leadTimeDays: integer("lead_time_days"),
    preferred: boolean("preferred").notNull().default(false),
  },
  (t) => [uniqueIndex("part_suppliers_uq").on(t.partId, t.supplierId)],
);

/**
 * Niveau de stock par article et magasin (et emplacement facultatif).
 * disponible = onHand − reserved (STK-05).
 */
export const stockLevels = pgTable(
  "stock_levels",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    partId: uuid("part_id")
      .notNull()
      .references(() => parts.id),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id),
    locationId: uuid("location_id").references(() => storageLocations.id),
    onHand: quantity("on_hand").notNull().default(0),
    reserved: quantity("reserved").notNull().default(0),
    inTransit: quantity("in_transit").notNull().default(0),
    minQty: quantity("min_qty"),
    reorderPoint: quantity("reorder_point"),
    maxQty: quantity("max_qty"),
    safetyStock: quantity("safety_stock"),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("stock_levels_part_wh_uq").on(t.partId, t.warehouseId), index("stock_levels_wh_idx").on(t.warehouseId)],
);

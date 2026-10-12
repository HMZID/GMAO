import { index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, money, quantity, ts } from "./columns";
import { inventoryCountStatusEnum, movementTypeEnum, reservationStatusEnum } from "./enums";
import { user } from "./auth";
import { workOrders } from "./maintenance";
import { costCenters, storageLocations, tenants, warehouses } from "./organization";
import { parts } from "./stock";

/**
 * Mouvements de stock (CDC §7.3) — jamais modifiés ni supprimés :
 * une correction est un mouvement inverse qui référence l'original (règle 5 de §7.5).
 * La quantité est toujours positive ; le sens est donné par le type.
 */
export const stockMovements = pgTable(
  "stock_movements",
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
    type: movementTypeEnum("type").notNull(),
    quantity: quantity("quantity").notNull(),
    unitCost: money("unit_cost").notNull().default(0),
    workOrderId: uuid("work_order_id").references(() => workOrders.id),
    costCenterId: uuid("cost_center_id").references(() => costCenters.id),
    /** Pour un transfert : magasin de destination ou d'origine. */
    counterpartWarehouseId: uuid("counterpart_warehouse_id").references(() => warehouses.id),
    reference: text("reference"),
    reason: text("reason"),
    reversalOfId: uuid("reversal_of_id"),
    /** Identifiant généré par le client : un mouvement reçu deux fois n'est enregistré qu'une fois (règle 2). */
    clientId: text("client_id"),
    createdById: text("created_by_id").references(() => user.id),
    createdAt: createdAt(),
  },
  (t) => [
    index("stock_movements_part_idx").on(t.partId, t.createdAt),
    index("stock_movements_wo_idx").on(t.workOrderId),
    uniqueIndex("stock_movements_client_uq").on(t.tenantId, t.clientId),
  ],
);

/** Réservations de pièces pour un OT (STK-05). */
export const stockReservations = pgTable(
  "stock_reservations",
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
    workOrderId: uuid("work_order_id")
      .notNull()
      .references(() => workOrders.id, { onDelete: "cascade" }),
    quantity: quantity("quantity").notNull(),
    consumedQuantity: quantity("consumed_quantity").notNull().default(0),
    status: reservationStatusEnum("status").notNull().default("ACTIVE"),
    createdAt: createdAt(),
  },
  (t) => [index("stock_reservations_wo_idx").on(t.workOrderId), index("stock_reservations_part_idx").on(t.partId)],
);

/**
 * Comptages d'inventaire (STK-07, règle 8 de §7.5). L'écart est calculé sur le stock théorique à l'heure
 * du comptage : les mouvements postérieurs (sortie sur OT pendant l'inventaire) restent enregistrés à part.
 * Au-delà du seuil en valeur, l'écart est « à valider » et ne modifie pas le stock avant la validation.
 */
export const inventoryCounts = pgTable(
  "inventory_counts",
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
    countedQuantity: quantity("counted_quantity").notNull(),
    /** Stock physique théorique à l'heure du comptage. */
    expectedQuantity: quantity("expected_quantity").notNull(),
    difference: quantity("difference").notNull(),
    /** Coût moyen pondéré au comptage : valeur de l'écart comparée au seuil. */
    unitCost: money("unit_cost").notNull(),
    countedAt: ts("counted_at").notNull(),
    status: inventoryCountStatusEnum("status").notNull(),
    comment: text("comment"),
    decisionComment: text("decision_comment"),
    /** Mouvement d'ajustement créé à l'application de l'écart. */
    adjustmentId: uuid("adjustment_id").references(() => stockMovements.id),
    /** Identifiant généré par le client : un comptage reçu deux fois n'est enregistré qu'une fois. */
    clientId: text("client_id"),
    createdById: text("created_by_id").references(() => user.id),
    decidedById: text("decided_by_id").references(() => user.id),
    decidedAt: ts("decided_at"),
    createdAt: createdAt(),
  },
  (t) => [
    index("inventory_counts_status_idx").on(t.tenantId, t.status),
    index("inventory_counts_part_idx").on(t.partId, t.warehouseId),
    uniqueIndex("inventory_counts_client_uq").on(t.tenantId, t.clientId),
  ],
);

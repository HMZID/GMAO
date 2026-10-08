import { index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, money, quantity } from "./columns";
import { movementTypeEnum, reservationStatusEnum } from "./enums";
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

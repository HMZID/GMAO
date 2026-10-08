import { numeric, timestamp, uuid } from "drizzle-orm/pg-core";

/** Clé primaire UUID générée par PostgreSQL. */
export const id = () => uuid("id").primaryKey().defaultRandom();

/** Horodatage avec fuseau, stocké en UTC (DON-16). */
export const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const createdAt = () => ts("created_at").defaultNow().notNull();

export const updatedAt = () =>
  ts("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date());

/** Montant monétaire (2 décimales). */
export const money = (name: string) => numeric(name, { precision: 14, scale: 2, mode: "number" });

/** Quantité de stock (3 décimales pour les litres, mètres, etc.). */
export const quantity = (name: string) => numeric(name, { precision: 14, scale: 3, mode: "number" });

/** Valeur de compteur (heures, km, cycles). */
export const meterValue = (name: string) => numeric(name, { precision: 14, scale: 1, mode: "number" });

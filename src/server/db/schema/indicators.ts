import { index, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { createdAt, id, updatedAt } from "./columns";
import { tenants } from "./organization";

/**
 * Indicateurs personnalisés (KPI-11) : définitions composées par l'organisation à partir des sources,
 * mesures et regroupements autorisés (`src/server/domain/indicators.ts`), calculées à l'affichage.
 */
export const customIndicators = pgTable(
  "custom_indicators",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    name: text("name").notNull(),
    source: text("source").notNull(),
    aggregate: text("aggregate").notNull(),
    field: text("field"),
    groupBy: text("group_by"),
    filterKey: text("filter_key"),
    filterValue: text("filter_value"),
    periodDays: integer("period_days"),
    chart: text("chart").notNull(),
    position: integer("position").notNull().default(0),
    createdById: text("created_by_id").references(() => user.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("custom_indicators_tenant_idx").on(t.tenantId, t.position)],
);

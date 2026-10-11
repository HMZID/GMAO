import "server-only";
import { and, asc, desc, eq, gte, max, sql, type SQL } from "drizzle-orm";
import type { PgSelect } from "drizzle-orm/pg-core";
import { z } from "zod";
import type { AuthContext } from "@/server/authz/context";
import type { Permission } from "@/server/authz/permissions";
import { db } from "@/server/db";
import {
  customIndicators,
  equipment,
  equipmentCategories,
  parts,
  sites,
  stockMovements,
  suppliers,
  technicians,
  timeEntries,
  warehouses,
  workOrders,
  workRequests,
} from "@/server/db/schema";
import {
  describeIndicator,
  groupLabel,
  INDICATOR_AGGREGATES,
  INDICATOR_CHARTS,
  INDICATOR_SOURCES,
  indicatorUnit,
  roundValue,
  validateIndicator,
  type IndicatorDefinition,
  type IndicatorSource,
} from "@/server/domain/indicators";
import { BusinessRuleError, NotFoundError } from "@/server/errors";
import { clearable, text } from "@/server/validation";
import { assertCan, audit, parseInput, scopeWhere } from "./_shared";

/* ------------------------------------------------------------------ */
/* Indicateurs personnalisés (KPI-11)                                  */
/* ------------------------------------------------------------------ */

/** Fuseau des regroupements par mois : écrit en clair dans la requête (une expression regroupée ne peut pas porter de paramètre). */
const TIME_ZONE = "Europe/Paris";
/** Nombre maximal de regroupements affichés (les plus grands). */
const MAX_GROUPS = 30;

const monthOf = (column: SQL | Parameters<typeof gte>[0]) => sql<string>`to_char(${column} at time zone ${sql.raw(`'${TIME_ZONE}'`)}, 'YYYY-MM')`;

/**
 * Traduction d'une source en SQL : requête de base (jointures), date de la période, champs et
 * regroupements. Seules ces expressions, écrites ici, peuvent entrer dans un calcul.
 */
type SourceSpec = {
  permission: Permission;
  base: (selection: Record<string, SQL>) => PgSelect;
  tenant: SQL;
  scope: (ctx: AuthContext) => SQL | undefined;
  date: Parameters<typeof gte>[0];
  fields: Record<string, SQL>;
  dims: Record<string, SQL>;
};

function spec(ctx: AuthContext, source: IndicatorSource): SourceSpec {
  switch (source) {
    case "work-orders":
      return {
        permission: "workorder.read",
        base: (selection) =>
          db
            .select(selection)
            .from(workOrders)
            .innerJoin(sites, eq(sites.id, workOrders.siteId))
            .innerJoin(equipment, eq(equipment.id, workOrders.equipmentId))
            .innerJoin(equipmentCategories, eq(equipmentCategories.id, equipment.categoryId))
            .leftJoin(suppliers, eq(suppliers.id, workOrders.supplierId))
            .$dynamic(),
        tenant: eq(workOrders.tenantId, ctx.tenantId),
        scope: (c) => scopeWhere(c.scope("workorder.read"), workOrders.companyId, workOrders.siteId),
        date: workOrders.createdAt,
        fields: {
          externalCost: sql`${workOrders.externalCost}`,
          estimatedHours: sql`${workOrders.estimatedMinutes} / 60.0`,
        },
        dims: {
          status: sql`${workOrders.status}::text`,
          type: sql`${workOrders.type}::text`,
          priority: sql`${workOrders.priority}::text`,
          site: sql`${sites.name}`,
          category: sql`${equipmentCategories.name}`,
          equipment: sql`${equipment.code}`,
          supplier: sql`${suppliers.name}`,
          month: monthOf(workOrders.createdAt),
        },
      };
    case "work-requests":
      return {
        permission: "request.read",
        base: (selection) =>
          db
            .select(selection)
            .from(workRequests)
            .innerJoin(sites, eq(sites.id, workRequests.siteId))
            .innerJoin(equipment, eq(equipment.id, workRequests.equipmentId))
            .$dynamic(),
        tenant: eq(workRequests.tenantId, ctx.tenantId),
        scope: (c) => scopeWhere(c.scope("request.read"), workRequests.companyId, workRequests.siteId),
        date: workRequests.reportedAt,
        fields: {},
        dims: {
          status: sql`${workRequests.status}::text`,
          priority: sql`${workRequests.priority}::text`,
          type: sql`${workRequests.type}::text`,
          site: sql`${sites.name}`,
          equipment: sql`${equipment.code}`,
          month: monthOf(workRequests.reportedAt),
        },
      };
    case "equipment":
      return {
        permission: "equipment.read",
        base: (selection) =>
          db
            .select(selection)
            .from(equipment)
            .innerJoin(sites, eq(sites.id, equipment.siteId))
            .innerJoin(equipmentCategories, eq(equipmentCategories.id, equipment.categoryId))
            .$dynamic(),
        tenant: eq(equipment.tenantId, ctx.tenantId),
        scope: (c) => scopeWhere(c.scope("equipment.read"), equipment.companyId, equipment.siteId),
        date: equipment.commissioningDate,
        fields: { acquisitionValue: sql`${equipment.acquisitionValue}` },
        dims: {
          status: sql`${equipment.status}::text`,
          criticality: sql`${equipment.criticality}::text`,
          site: sql`${sites.name}`,
          category: sql`${equipmentCategories.name}`,
          manufacturer: sql`${equipment.manufacturer}`,
        },
      };
    case "labor":
      return {
        permission: "workorder.read",
        base: (selection) =>
          db
            .select(selection)
            .from(timeEntries)
            .innerJoin(workOrders, eq(workOrders.id, timeEntries.workOrderId))
            .innerJoin(sites, eq(sites.id, workOrders.siteId))
            .leftJoin(technicians, eq(technicians.id, timeEntries.technicianId))
            .$dynamic(),
        tenant: eq(timeEntries.tenantId, ctx.tenantId),
        scope: (c) => scopeWhere(c.scope("workorder.read"), workOrders.companyId, workOrders.siteId),
        date: timeEntries.startedAt,
        fields: {
          hours: sql`coalesce(${timeEntries.minutes}, 0) / 60.0`,
          laborCost: sql`coalesce(${timeEntries.minutes}, 0) / 60.0 * coalesce(${timeEntries.hourlyRate}, 0)`,
        },
        dims: {
          technician: sql`${technicians.firstName} || ' ' || ${technicians.lastName}`,
          site: sql`${sites.name}`,
          workOrderType: sql`${workOrders.type}::text`,
          month: monthOf(timeEntries.startedAt),
        },
      };
    case "stock-movements":
      return {
        permission: "stock.read",
        base: (selection) =>
          db
            .select(selection)
            .from(stockMovements)
            .innerJoin(parts, eq(parts.id, stockMovements.partId))
            .innerJoin(warehouses, eq(warehouses.id, stockMovements.warehouseId))
            .innerJoin(sites, eq(sites.id, warehouses.siteId))
            .$dynamic(),
        tenant: eq(stockMovements.tenantId, ctx.tenantId),
        scope: (c) => scopeWhere(c.scope("stock.read"), sites.companyId, sites.id),
        date: stockMovements.createdAt,
        fields: {
          quantity: sql`${stockMovements.quantity}`,
          value: sql`${stockMovements.quantity} * coalesce(${stockMovements.unitCost}, 0)`,
        },
        dims: {
          type: sql`${stockMovements.type}::text`,
          warehouse: sql`${warehouses.name}`,
          part: sql`${parts.sku} || ' — ' || ${parts.name}`,
          month: monthOf(stockMovements.createdAt),
        },
      };
  }
}

export type IndicatorResult = {
  /** Valeur d'ensemble (toutes lignes confondues). */
  value: number;
  /** Valeurs par regroupement (vide sans regroupement). */
  groups: { key: string | null; label: string; value: number }[];
  unit: string;
};

/** Calcul d'un indicateur, dans le périmètre de l'utilisateur (droit de lecture de la source). */
export async function computeIndicator(ctx: AuthContext, def: IndicatorDefinition, now = new Date()): Promise<IndicatorResult> {
  const s = spec(ctx, def.source);
  assertCan(ctx, s.permission);
  const measure =
    def.aggregate === "count"
      ? sql<number>`count(*)::float8`
      : def.aggregate === "sum"
        ? sql<number>`coalesce(sum(${s.fields[def.field ?? ""]}), 0)::float8`
        : sql<number>`coalesce(avg(${s.fields[def.field ?? ""]}), 0)::float8`;
  const conditions: (SQL | undefined)[] = [s.tenant, s.scope(ctx)];
  if (def.periodDays) conditions.push(gte(s.date, new Date(now.getTime() - def.periodDays * 86_400_000)));
  if (def.filterKey && def.filterValue) conditions.push(sql`${s.dims[def.filterKey]} = ${def.filterValue}`);
  const where = and(...conditions.filter((c): c is SQL => !!c));

  const [total] = (await s.base({ value: measure }).where(where)) as { value: number }[];
  let groups: IndicatorResult["groups"] = [];
  if (def.groupBy) {
    const key = s.dims[def.groupBy];
    const query = s
      .base({ key: sql<string | null>`${key}`, value: measure })
      .where(where)
      .groupBy(key)
      .orderBy(def.groupBy === "month" ? asc(key) : desc(measure))
      .limit(MAX_GROUPS);
    const rows = (await query) as { key: string | null; value: number }[];
    groups = rows.map((r) => ({ key: r.key, label: groupLabel(def.source, def.groupBy, r.key), value: roundValue(Number(r.value)) }));
  }
  return { value: roundValue(Number(total?.value ?? 0)), groups, unit: indicatorUnit(def) };
}

/* ------------------------------------------------------------------ */
/* Définitions enregistrées                                             */
/* ------------------------------------------------------------------ */

export const indicatorInput = z.object({
  name: text(80, "Nom obligatoire"),
  source: z.enum(INDICATOR_SOURCES, "Source obligatoire"),
  aggregate: z.enum(INDICATOR_AGGREGATES, "Mesure obligatoire"),
  field: clearable(z.string().max(40)),
  groupBy: clearable(z.string().max(40)),
  filterKey: clearable(z.string().max(40)),
  filterValue: clearable(z.string().max(60)),
  periodDays: clearable(z.coerce.number().int()),
  chart: z.enum(INDICATOR_CHARTS, "Présentation obligatoire"),
});

/** Nouvel indicateur : définition contrôlée (toutes les anomalies en une fois), ajoutée en fin de liste. */
export async function createIndicator(ctx: AuthContext, raw: unknown) {
  assertCan(ctx, "indicator.manage");
  const input = parseInput(indicatorInput, raw);
  const def: IndicatorDefinition = {
    ...input,
    field: input.field || null,
    groupBy: input.groupBy || null,
    filterKey: input.filterKey || null,
    filterValue: input.filterKey ? input.filterValue || null : null,
    periodDays: input.periodDays ?? null,
  };
  const errors = validateIndicator(def);
  if (errors.length > 0) throw new BusinessRuleError(errors);
  return db.transaction(async (tx) => {
    const [last] = await tx
      .select({ position: max(customIndicators.position) })
      .from(customIndicators)
      .where(eq(customIndicators.tenantId, ctx.tenantId));
    const [row] = await tx
      .insert(customIndicators)
      .values({ ...def, tenantId: ctx.tenantId, position: (last?.position ?? 0) + 1, createdById: ctx.userId })
      .returning();
    await audit(tx, ctx, { entityType: "custom_indicator", entityId: row.id, action: "create", after: row });
    return row;
  });
}

export async function deleteIndicator(ctx: AuthContext, id: string) {
  assertCan(ctx, "indicator.manage");
  const [row] = await db
    .select()
    .from(customIndicators)
    .where(and(eq(customIndicators.id, id), eq(customIndicators.tenantId, ctx.tenantId)));
  if (!row) throw new NotFoundError("Indicateur");
  await db.transaction(async (tx) => {
    await tx.delete(customIndicators).where(eq(customIndicators.id, id));
    await audit(tx, ctx, { entityType: "custom_indicator", entityId: id, action: "delete", before: row });
  });
}

function toDefinition(row: typeof customIndicators.$inferSelect): IndicatorDefinition {
  return {
    name: row.name,
    source: row.source as IndicatorSource,
    aggregate: row.aggregate as IndicatorDefinition["aggregate"],
    field: row.field,
    groupBy: row.groupBy,
    filterKey: row.filterKey,
    filterValue: row.filterValue,
    periodDays: row.periodDays,
    chart: row.chart as IndicatorDefinition["chart"],
  };
}

/**
 * Indicateurs de l'organisation, calculés pour l'utilisateur. Un indicateur dont la source n'est pas
 * lisible avec son profil est signalé sans valeur (jamais de donnée hors droits).
 */
export async function listIndicators(ctx: AuthContext) {
  assertCan(ctx, "kpi.read");
  const rows = await db
    .select()
    .from(customIndicators)
    .where(eq(customIndicators.tenantId, ctx.tenantId))
    .orderBy(asc(customIndicators.position), asc(customIndicators.createdAt));
  const result = [];
  for (const row of rows) {
    const def = toDefinition(row);
    const readable = ctx.can(spec(ctx, def.source).permission) && validateIndicator(def).length === 0;
    result.push({
      id: row.id,
      ...def,
      description: describeIndicator(def),
      result: readable ? await computeIndicator(ctx, def) : null,
    });
  }
  return result;
}

/** Un indicateur et sa valeur (API, couche MCP). */
export async function getIndicator(ctx: AuthContext, id: string) {
  assertCan(ctx, "kpi.read");
  const [row] = await db
    .select()
    .from(customIndicators)
    .where(and(eq(customIndicators.id, id), eq(customIndicators.tenantId, ctx.tenantId)));
  if (!row) throw new NotFoundError("Indicateur");
  const def = toDefinition(row);
  return { id: row.id, ...def, description: describeIndicator(def), result: await computeIndicator(ctx, def) };
}

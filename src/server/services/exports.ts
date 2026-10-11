import "server-only";
import { and, asc, count, eq, gte, sql, type SQL } from "drizzle-orm";
import { alias, type PgSelect } from "drizzle-orm/pg-core";
import ExcelJS from "exceljs";
import { z } from "zod";
import type { AuthContext } from "@/server/authz/context";
import type { Permission } from "@/server/authz/permissions";
import { db } from "@/server/db";
import {
  companies,
  equipment,
  equipmentCategories,
  equipmentModels,
  meterReadings,
  meters,
  parts,
  sites,
  stockLevels,
  stockMovements,
  suppliers,
  technicians,
  tenants,
  warehouses,
  workOrders,
  workRequests,
} from "@/server/db/schema";
import { brandLabel } from "@/server/domain/branding";
import {
  EXPORT_DATASETS,
  EXPORT_DEFINITIONS,
  EXPORT_FORMATS,
  exportFileName,
  labelOf,
  MAX_PAGE_SIZE,
  toCsv,
  type ExportDataset,
  type ExportFormat,
} from "@/server/domain/exports";
import { ForbiddenError } from "@/server/errors";
import { optionalDate } from "@/server/validation";
import { assertCan, parseInput, scopeWhere } from "./_shared";

/* ------------------------------------------------------------------ */
/* Export des données de l'organisation (INT-01)                       */
/* ------------------------------------------------------------------ */

/** Droit de lecture de chaque jeu de données : l'export ne montre que ce que l'écran montre, dans le périmètre. */
const READ_PERMISSION: Record<ExportDataset, Permission> = {
  equipment: "equipment.read",
  "work-orders": "workorder.read",
  "work-requests": "request.read",
  "meter-readings": "meter.read",
  suppliers: "supplier.read",
  technicians: "planning.read",
  parts: "part.read",
  "stock-levels": "stock.read",
  "stock-movements": "stock.read",
};

/** Jeux de données exportables par l'utilisateur. */
export function exportableDatasets(ctx: AuthContext): ExportDataset[] {
  if (!ctx.can("data.export")) return [];
  return EXPORT_DATASETS.filter((d) => ctx.can(READ_PERMISSION[d]));
}

function assertDataset(ctx: AuthContext, dataset: ExportDataset) {
  assertCan(ctx, "data.export");
  if (!ctx.can(READ_PERMISSION[dataset])) throw new ForbiddenError(`Export « ${EXPORT_DEFINITIONS[dataset].label} » : droit de lecture requis.`);
}

export const datasetSchema = z.enum(EXPORT_DATASETS, `Jeu de données attendu : ${EXPORT_DATASETS.join(", ")}`);

export const exportQuery = z.object({
  format: z.enum(EXPORT_FORMATS, "Format attendu : xlsx, csv ou json").default("json"),
  /** Extraction incrémentale : lignes créées ou modifiées depuis cette date (ISO 8601). */
  updatedSince: optionalDate,
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(1000),
  offset: z.coerce.number().int().min(0).default(0),
});

type Page = { updatedSince?: Date; limit?: number; offset?: number };
type Row = Record<string, unknown>;

/** Lignes d'un jeu de données, dans le périmètre de l'utilisateur, triées par date de modification puis identifiant. */
export async function fetchDataset(ctx: AuthContext, dataset: ExportDataset, page: Page = {}): Promise<Row[]> {
  const query = datasetQuery(ctx, dataset, page.updatedSince);
  return (page.limit === undefined ? query : query.limit(page.limit).offset(page.offset ?? 0)) as unknown as Promise<Row[]>;
}

/** Nombre de lignes d'un jeu de données dans le périmètre, compté par la base. */
export async function countDataset(ctx: AuthContext, dataset: ExportDataset, updatedSince?: Date) {
  const [row] = await db.select({ n: count() }).from(datasetQuery(ctx, dataset, updatedSince).as("dataset"));
  return row?.n ?? 0;
}

/** Requête d'un jeu de données (droits contrôlés, périmètre appliqué), sans pagination. */
function datasetQuery(ctx: AuthContext, dataset: ExportDataset, updatedSince?: Date): PgSelect {
  assertDataset(ctx, dataset);
  const scope = ctx.scope(READ_PERMISSION[dataset]);
  const since = (column: Parameters<typeof gte>[0]) => (updatedSince ? gte(column, updatedSince) : undefined);
  const where = (...conditions: (SQL | undefined)[]) => and(...conditions.filter((c): c is SQL => !!c));

  switch (dataset) {
    case "equipment":
      return db
        .select({
          id: equipment.id,
          code: equipment.code,
          name: equipment.name,
          companyCode: companies.code,
          siteCode: sites.code,
          categoryCode: equipmentCategories.code,
          manufacturer: equipment.manufacturer,
          modelName: equipmentModels.name,
          serialNumber: equipment.serialNumber,
          registration: equipment.registration,
          year: equipment.year,
          status: equipment.status,
          criticality: equipment.criticality,
          acquisitionMode: equipment.acquisitionMode,
          acquisitionDate: equipment.acquisitionDate,
          acquisitionValue: equipment.acquisitionValue,
          commissioningDate: equipment.commissioningDate,
          warrantyEndDate: equipment.warrantyEndDate,
          retiredAt: equipment.retiredAt,
          createdAt: equipment.createdAt,
          updatedAt: equipment.updatedAt,
        })
        .from(equipment)
        .innerJoin(companies, eq(companies.id, equipment.companyId))
        .innerJoin(sites, eq(sites.id, equipment.siteId))
        .innerJoin(equipmentCategories, eq(equipmentCategories.id, equipment.categoryId))
        .leftJoin(equipmentModels, eq(equipmentModels.id, equipment.modelId))
        .where(where(eq(equipment.tenantId, ctx.tenantId), scopeWhere(scope, equipment.companyId, equipment.siteId), since(equipment.updatedAt)))
        .orderBy(asc(equipment.updatedAt), asc(equipment.id))
        .$dynamic();
    case "work-orders":
      return db
        .select({
          id: workOrders.id,
          number: workOrders.number,
          companyCode: companies.code,
          siteCode: sites.code,
          equipmentCode: equipment.code,
          type: workOrders.type,
          status: workOrders.status,
          priority: workOrders.priority,
          title: workOrders.title,
          description: workOrders.description,
          isImmobilizing: workOrders.isImmobilizing,
          isExternal: workOrders.isExternal,
          supplierName: suppliers.name,
          externalCost: workOrders.externalCost,
          plannedStart: workOrders.plannedStart,
          plannedEnd: workOrders.plannedEnd,
          estimatedMinutes: workOrders.estimatedMinutes,
          startedAt: workOrders.startedAt,
          workDoneAt: workOrders.workDoneAt,
          techClosedAt: workOrders.techClosedAt,
          closedAt: workOrders.closedAt,
          cancelledAt: workOrders.cancelledAt,
          outcome: workOrders.outcome,
          workSummary: workOrders.workSummary,
          createdAt: workOrders.createdAt,
          updatedAt: workOrders.updatedAt,
        })
        .from(workOrders)
        .innerJoin(companies, eq(companies.id, workOrders.companyId))
        .innerJoin(sites, eq(sites.id, workOrders.siteId))
        .innerJoin(equipment, eq(equipment.id, workOrders.equipmentId))
        .leftJoin(suppliers, eq(suppliers.id, workOrders.supplierId))
        .where(where(eq(workOrders.tenantId, ctx.tenantId), scopeWhere(scope, workOrders.companyId, workOrders.siteId), since(workOrders.updatedAt)))
        .orderBy(asc(workOrders.updatedAt), asc(workOrders.id))
        .$dynamic();
    case "work-requests":
      return db
        .select({
          id: workRequests.id,
          number: workRequests.number,
          companyCode: companies.code,
          siteCode: sites.code,
          equipmentCode: equipment.code,
          reportedAt: workRequests.reportedAt,
          symptom: workRequests.symptom,
          description: workRequests.description,
          isStopped: workRequests.isStopped,
          isSafetyRisk: workRequests.isSafetyRisk,
          status: workRequests.status,
          priority: workRequests.priority,
          type: workRequests.type,
          workOrderNumber: workOrders.number,
          qualifiedAt: workRequests.qualifiedAt,
          createdAt: workRequests.createdAt,
          updatedAt: workRequests.updatedAt,
        })
        .from(workRequests)
        .innerJoin(companies, eq(companies.id, workRequests.companyId))
        .innerJoin(sites, eq(sites.id, workRequests.siteId))
        .innerJoin(equipment, eq(equipment.id, workRequests.equipmentId))
        .leftJoin(workOrders, eq(workOrders.id, workRequests.workOrderId))
        .where(
          where(
            eq(workRequests.tenantId, ctx.tenantId),
            scopeWhere(scope, workRequests.companyId, workRequests.siteId),
            since(workRequests.updatedAt),
          ),
        )
        .orderBy(asc(workRequests.updatedAt), asc(workRequests.id))
        .$dynamic();
    case "meter-readings":
      return db
        .select({
          id: meterReadings.id,
          equipmentCode: equipment.code,
          meterType: meters.type,
          unit: meters.unit,
          readAt: meterReadings.readAt,
          value: meterReadings.value,
          cumulativeValue: meterReadings.cumulativeValue,
          source: meterReadings.source,
          status: meterReadings.status,
          comment: meterReadings.comment,
          createdAt: meterReadings.createdAt,
        })
        .from(meterReadings)
        .innerJoin(meters, eq(meters.id, meterReadings.meterId))
        .innerJoin(equipment, eq(equipment.id, meters.equipmentId))
        .where(
          where(eq(meterReadings.tenantId, ctx.tenantId), scopeWhere(scope, equipment.companyId, equipment.siteId), since(meterReadings.createdAt)),
        )
        .orderBy(asc(meterReadings.createdAt), asc(meterReadings.id))
        .$dynamic();
    case "suppliers":
      return db
        .select({
          id: suppliers.id,
          name: suppliers.name,
          taxId: suppliers.taxId,
          email: suppliers.email,
          phone: suppliers.phone,
          address: suppliers.address,
          isContractor: suppliers.isContractor,
          active: suppliers.active,
          createdAt: suppliers.createdAt,
          updatedAt: suppliers.updatedAt,
        })
        .from(suppliers)
        .where(where(eq(suppliers.tenantId, ctx.tenantId), since(suppliers.updatedAt)))
        .orderBy(asc(suppliers.updatedAt), asc(suppliers.id))
        .$dynamic();
    case "technicians":
      return db
        .select({
          id: technicians.id,
          employeeNumber: technicians.employeeNumber,
          lastName: technicians.lastName,
          firstName: technicians.firstName,
          siteCode: sites.code,
          qualification: technicians.qualification,
          dailyHours: technicians.dailyHours,
          // Taux en vigueur : le plus récent. Référence extérieure écrite en clair (sous-requête corrélée).
          hourlyRate: sql<
            number | null
          >`(select lr.hourly_rate::float8 from "labor_rates" lr where lr.technician_id = "technicians"."id" order by lr.valid_from desc limit 1)`.as(
            "hourly_rate",
          ),
          active: technicians.active,
          createdAt: technicians.createdAt,
          updatedAt: technicians.updatedAt,
        })
        .from(technicians)
        .innerJoin(sites, eq(sites.id, technicians.siteId))
        .where(where(eq(technicians.tenantId, ctx.tenantId), scopeWhere(scope, sites.companyId, technicians.siteId), since(technicians.updatedAt)))
        .orderBy(asc(technicians.updatedAt), asc(technicians.id))
        .$dynamic();
    case "parts":
      return db
        .select({
          id: parts.id,
          sku: parts.sku,
          name: parts.name,
          family: parts.family,
          unit: parts.unit,
          manufacturer: parts.manufacturer,
          manufacturerRef: parts.manufacturerRef,
          tracking: parts.tracking,
          isRepairable: parts.isRepairable,
          criticality: parts.criticality,
          averageCost: parts.averageCost,
          active: parts.active,
          createdAt: parts.createdAt,
          updatedAt: parts.updatedAt,
        })
        .from(parts)
        .where(where(eq(parts.tenantId, ctx.tenantId), since(parts.updatedAt)))
        .orderBy(asc(parts.updatedAt), asc(parts.id))
        .$dynamic();
    case "stock-levels":
      return db
        .select({
          id: stockLevels.id,
          sku: parts.sku,
          partName: parts.name,
          warehouseCode: warehouses.code,
          onHand: stockLevels.onHand,
          reserved: stockLevels.reserved,
          minQty: stockLevels.minQty,
          reorderPoint: stockLevels.reorderPoint,
          maxQty: stockLevels.maxQty,
          updatedAt: stockLevels.updatedAt,
        })
        .from(stockLevels)
        .innerJoin(parts, eq(parts.id, stockLevels.partId))
        .innerJoin(warehouses, eq(warehouses.id, stockLevels.warehouseId))
        .innerJoin(sites, eq(sites.id, warehouses.siteId))
        .where(where(eq(stockLevels.tenantId, ctx.tenantId), scopeWhere(scope, sites.companyId, sites.id), since(stockLevels.updatedAt)))
        .orderBy(asc(stockLevels.updatedAt), asc(stockLevels.id))
        .$dynamic();
    case "stock-movements": {
      const movementWorkOrder = alias(workOrders, "movement_work_order");
      return db
        .select({
          id: stockMovements.id,
          createdAt: stockMovements.createdAt,
          type: stockMovements.type,
          sku: parts.sku,
          warehouseCode: warehouses.code,
          quantity: stockMovements.quantity,
          unitCost: stockMovements.unitCost,
          workOrderNumber: movementWorkOrder.number,
          reference: stockMovements.reference,
          reason: stockMovements.reason,
        })
        .from(stockMovements)
        .innerJoin(parts, eq(parts.id, stockMovements.partId))
        .innerJoin(warehouses, eq(warehouses.id, stockMovements.warehouseId))
        .innerJoin(sites, eq(sites.id, warehouses.siteId))
        .leftJoin(movementWorkOrder, eq(movementWorkOrder.id, stockMovements.workOrderId))
        .where(where(eq(stockMovements.tenantId, ctx.tenantId), scopeWhere(scope, sites.companyId, sites.id), since(stockMovements.createdAt)))
        .orderBy(asc(stockMovements.createdAt), asc(stockMovements.id))
        .$dynamic();
    }
  }
}

/** Page JSON d'un jeu de données (API et connecteur ETL) : `next` donne le décalage de la page suivante. */
export async function exportPage(ctx: AuthContext, dataset: ExportDataset, raw: unknown) {
  const query = parseInput(exportQuery, raw);
  const items = await fetchDataset(ctx, dataset, { updatedSince: query.updatedSince, limit: query.limit, offset: query.offset });
  return {
    dataset,
    columns: EXPORT_DEFINITIONS[dataset].columns.map(({ key, label, type }) => ({ key, label, type })),
    items,
    page: {
      limit: query.limit,
      offset: query.offset,
      returned: items.length,
      next: items.length === query.limit ? query.offset + query.limit : null,
      updatedSince: query.updatedSince ?? null,
    },
  };
}

/** Fichier complet d'un jeu de données : CSV (codes, ISO 8601), JSON ou Excel (libellés). */
export async function exportFile(ctx: AuthContext, dataset: ExportDataset, format: ExportFormat, updatedSince?: Date, now = new Date()) {
  const rows = await fetchDataset(ctx, dataset, { updatedSince });
  const definition = EXPORT_DEFINITIONS[dataset];
  const fileName = exportFileName(dataset, format, now);
  if (format === "csv") return { fileName, contentType: "text/csv; charset=utf-8", body: toCsv(definition.columns, rows) };
  if (format === "json") return { fileName, contentType: "application/json; charset=utf-8", body: JSON.stringify({ dataset, items: rows }) };
  const workbook = await buildWorkbook(ctx, [{ dataset, rows }], now);
  return { fileName, contentType: XLSX, body: workbook as BodyInit };
}

/** Classeur Excel de toutes les données exportables : un onglet par jeu de données, et un onglet d'informations. */
export async function exportWorkbook(ctx: AuthContext, now = new Date()) {
  assertCan(ctx, "data.export");
  const datasets = exportableDatasets(ctx);
  const sheets: { dataset: ExportDataset; rows: Row[] }[] = [];
  for (const dataset of datasets) sheets.push({ dataset, rows: await fetchDataset(ctx, dataset) });
  return { fileName: exportFileName("donnees", "xlsx", now), buffer: await buildWorkbook(ctx, sheets, now) };
}

/** Nombre de lignes de chaque jeu de données exportable (écran d'export). */
export async function exportSummary(ctx: AuthContext) {
  assertCan(ctx, "data.export");
  const result: { dataset: ExportDataset; label: string; description: string; rows: number }[] = [];
  for (const dataset of exportableDatasets(ctx)) {
    const definition = EXPORT_DEFINITIONS[dataset];
    result.push({ dataset, label: definition.label, description: definition.description, rows: await countDataset(ctx, dataset) });
  }
  return result;
}

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } };

async function buildWorkbook(ctx: AuthContext, sheets: { dataset: ExportDataset; rows: Row[] }[], now: Date) {
  const [tenant] = await db.select({ name: tenants.name, displayName: tenants.displayName }).from(tenants).where(eq(tenants.id, ctx.tenantId));
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "GMAO";
  workbook.created = now;

  const info = workbook.addWorksheet("Informations");
  info.columns = [{ width: 34 }, { width: 70 }];
  info.addRow(["Organisation", tenant ? brandLabel(tenant) : ""]);
  info.addRow(["Exporté le", now]);
  info.getCell("B2").numFmt = "dd/mm/yyyy hh:mm";
  info.addRow(["Par", `${ctx.name} (${ctx.email})`]);
  info.addRow([]);
  info.addRow(["Onglet", "Lignes"]).font = { bold: true };
  for (const { dataset, rows } of sheets) info.addRow([EXPORT_DEFINITIONS[dataset].sheet, rows.length]);
  info.addRow([]);
  info.addRow(["Remarque", "Codes et identifiants stables : préférer CSV ou JSON (API ou connecteur) pour une intégration automatique."]);
  info.getColumn(1).font = { bold: true };

  for (const { dataset, rows } of sheets) {
    const definition = EXPORT_DEFINITIONS[dataset];
    const sheet = workbook.addWorksheet(definition.sheet, { views: [{ state: "frozen", ySplit: 1 }] });
    sheet.columns = definition.columns.map((c) => ({
      header: c.label,
      key: c.key,
      width: c.key === "id" ? 38 : Math.max(12, Math.min(40, c.label.length + 4)),
      style: c.type === "date" ? { numFmt: "dd/mm/yyyy hh:mm" } : {},
    }));
    const header = sheet.getRow(1);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = HEADER_FILL;
    for (const row of rows) {
      sheet.addRow(
        Object.fromEntries(
          definition.columns.map((c) => {
            const value = labelOf(c, row[c.key]);
            return [c.key, c.type === "boolean" && typeof value === "boolean" ? (value ? "Oui" : "Non") : (value ?? null)];
          }),
        ),
      );
    }
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: definition.columns.length } };
  }
  return new Uint8Array((await workbook.xlsx.writeBuffer()) as ArrayBuffer);
}

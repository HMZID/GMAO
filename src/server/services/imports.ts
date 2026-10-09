import "server-only";
import { createHash } from "node:crypto";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import ExcelJS from "exceljs";
import { z } from "zod";
import type { AuthContext } from "@/server/authz/context";
import type { Permission } from "@/server/authz/permissions";
import { db, type DbOrTx } from "@/server/db";
import {
  companies,
  equipment,
  equipmentCategories,
  equipmentModels,
  importJobs,
  parts,
  sites,
  stockLevels,
  stockMovements,
  user,
  warehouses,
} from "@/server/db/schema";
import {
  IMPORT_DEFINITIONS,
  IMPORT_KINDS,
  MAX_IMPORT_FILE_BYTES,
  MAX_IMPORT_ROWS,
  canExecute,
  duplicateLines,
  mapHeaders,
  parseRow,
  rowKey,
  secondaryDuplicateLines,
  simplifyCell,
  summarize,
  type CellValue,
  type ImportColumn,
  type ImportKind,
  type ImportRow,
} from "@/server/domain/imports";
import { AppError, BusinessRuleError, ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/errors";
import { assertCan, audit, parseInput } from "./_shared";
import { checkEquipmentCreation, createEquipment } from "./equipment";
import { checkPartCreation, createMovement, createPart, stockLevelSettingsInput, updateStockLevelSettings } from "./stock";

/* ------------------------------------------------------------------ */
/* Droits                                                               */
/* ------------------------------------------------------------------ */

/** Droit requis par type d'import : le même que pour la saisie à l'écran. */
export const IMPORT_PERMISSION: Record<ImportKind, Permission> = {
  EQUIPMENT: "equipment.write",
  PARTS: "part.write",
  INITIAL_STOCK: "stock.move",
};

export function importableKinds(ctx: AuthContext) {
  return IMPORT_KINDS.filter((k) => ctx.can(IMPORT_PERMISSION[k]));
}

/** Les créations d'un import sont tracées sur le canal IMPORT du journal d'audit. */
function importContext(ctx: AuthContext): AuthContext {
  return { ...ctx, channel: "IMPORT" };
}

const kindSchema = z.enum(IMPORT_KINDS, "Type d'import attendu : EQUIPMENT, PARTS ou INITIAL_STOCK");

/* ------------------------------------------------------------------ */
/* Référentiels (codes → identifiants)                                  */
/* ------------------------------------------------------------------ */

const upper = (v: unknown) =>
  String(v ?? "")
    .trim()
    .toUpperCase();

async function loadReferences(ctx: AuthContext) {
  const [companyRows, siteRows, categoryRows, modelRows, warehouseRows] = await Promise.all([
    db.select({ id: companies.id, code: companies.code, name: companies.name }).from(companies).where(eq(companies.tenantId, ctx.tenantId)),
    db.select({ id: sites.id, code: sites.code, name: sites.name, companyId: sites.companyId }).from(sites).where(eq(sites.tenantId, ctx.tenantId)),
    db
      .select({ id: equipmentCategories.id, code: equipmentCategories.code, name: equipmentCategories.name })
      .from(equipmentCategories)
      .where(eq(equipmentCategories.tenantId, ctx.tenantId)),
    db
      .select({ id: equipmentModels.id, manufacturer: equipmentModels.manufacturer, name: equipmentModels.name })
      .from(equipmentModels)
      .where(eq(equipmentModels.tenantId, ctx.tenantId)),
    db
      .select({ id: warehouses.id, code: warehouses.code, name: warehouses.name, siteId: warehouses.siteId, companyId: sites.companyId })
      .from(warehouses)
      .innerJoin(sites, eq(sites.id, warehouses.siteId))
      .where(and(eq(warehouses.tenantId, ctx.tenantId), eq(warehouses.active, true))),
  ]);
  return {
    companies: new Map(companyRows.map((r) => [upper(r.code), r])),
    sites: new Map(siteRows.map((r) => [upper(r.code), r])),
    categories: new Map(categoryRows.map((r) => [upper(r.code), r])),
    models: new Map(modelRows.map((r) => [`${upper(r.manufacturer)}|${upper(r.name)}`, r])),
    warehouses: new Map(warehouseRows.map((r) => [upper(r.code), r])),
    lists: { companyRows, siteRows, categoryRows, warehouseRows },
  };
}

type References = Awaited<ReturnType<typeof loadReferences>>;

/* ------------------------------------------------------------------ */
/* Lecture du fichier                                                   */
/* ------------------------------------------------------------------ */

export type ImportFile = { name: string; bytes: Uint8Array };

type ReadResult = { fileErrors: string[]; rows: { line: number; values: Record<string, unknown>; errors: string[] }[] };

async function readWorkbook(kind: ImportKind, file: ImportFile): Promise<ReadResult> {
  const definition = IMPORT_DEFINITIONS[kind];
  if (!file.name.toLowerCase().endsWith(".xlsx")) return { fileErrors: ["Fichier Excel .xlsx attendu (utiliser le modèle fourni)."], rows: [] };
  if (file.bytes.byteLength > MAX_IMPORT_FILE_BYTES) return { fileErrors: ["Fichier trop volumineux (10 Mo au plus)."], rows: [] };
  // Un fichier .xlsx est une archive ZIP : signature « PK ».
  if (file.bytes[0] !== 0x50 || file.bytes[1] !== 0x4b) return { fileErrors: ["Le fichier n'est pas un classeur Excel valide."], rows: [] };

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(Buffer.from(file.bytes) as unknown as ExcelJS.Buffer);
  } catch {
    return { fileErrors: ["Le classeur Excel n'a pas pu être lu (fichier endommagé ou protégé par mot de passe)."], rows: [] };
  }
  const sheet = workbook.getWorksheet(definition.sheet) ?? workbook.worksheets.find((w) => !["Aide", "Listes"].includes(w.name));
  if (!sheet) return { fileErrors: [`Onglet « ${definition.sheet} » introuvable.`], rows: [] };

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  for (let c = 1; c <= headerRow.cellCount; c++) headers.push(String(simplifyCell(headerRow.getCell(c).value) ?? ""));
  const map = mapHeaders(headers, definition.columns);
  const fileErrors: string[] = [];
  if (map.missing.length > 0) fileErrors.push(`Colonnes obligatoires absentes : ${map.missing.join(", ")}.`);
  if (fileErrors.length > 0) return { fileErrors, rows: [] };

  const rows: ReadResult["rows"] = [];
  const width = headers.length;
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const cells: CellValue[] = [];
    for (let c = 1; c <= width; c++) cells.push(simplifyCell(row.getCell(c).value));
    const parsed = parseRow(cells, definition.columns, map.indexByKey);
    if (parsed.empty) continue;
    if (rows.length >= MAX_IMPORT_ROWS) return { fileErrors: [`Fichier limité à ${MAX_IMPORT_ROWS} lignes : le découper.`], rows: [] };
    rows.push({ line: r, values: parsed.values, errors: parsed.errors });
  }
  if (rows.length === 0) fileErrors.push("Aucune ligne de données sous la ligne d'en-tête.");
  return { fileErrors, rows };
}

/* ------------------------------------------------------------------ */
/* Contrôle des lignes (mêmes contrôles qu'en saisie)                   */
/* ------------------------------------------------------------------ */

const FIELD_LABELS: Record<string, string> = {
  companyId: "Société",
  siteId: "Site",
  categoryId: "Catégorie",
  modelId: "Modèle",
  partId: "Référence interne",
  warehouseId: "Magasin",
};

/** Traduit l'erreur d'un service en messages lisibles pour le rapport. */
function messagesOf(error: unknown, columns: ImportColumn[]): string[] {
  const label = (field: string) => FIELD_LABELS[field] ?? columns.find((c) => c.key === field)?.label ?? field;
  if (error instanceof ValidationError) {
    const fields = Object.entries(error.fieldErrors).flatMap(([field, msgs]) => (msgs ?? []).map((m) => `${label(field)} : ${m}`));
    return fields.length > 0 ? fields : [error.message];
  }
  if (error instanceof BusinessRuleError) return error.errors;
  if (error instanceof ForbiddenError) return ["Hors de votre périmètre : droit insuffisant sur cette société ou ce site."];
  if (error instanceof AppError) return [error.message];
  console.error("[import] erreur inattendue", error);
  return ["Erreur inattendue sur cette ligne."];
}

type RowCheck = { status: "READY" | "EXISTS" | "ERROR"; messages: string[]; input?: Record<string, unknown> };

/** Résout les codes de la ligne en identifiants ; les codes inconnus sont tous signalés. */
function resolveEquipment(values: Record<string, unknown>, refs: References) {
  const errors: string[] = [];
  const company = refs.companies.get(upper(values.companyCode));
  const site = refs.sites.get(upper(values.siteCode));
  const category = refs.categories.get(upper(values.categoryCode));
  if (values.companyCode && !company) errors.push(`Société « ${values.companyCode} » inconnue.`);
  if (values.siteCode && !site) errors.push(`Site « ${values.siteCode} » inconnu.`);
  if (values.categoryCode && !category) errors.push(`Catégorie « ${values.categoryCode} » inconnue.`);
  let modelId: string | undefined;
  if (values.modelName) {
    const model = refs.models.get(`${upper(values.manufacturer)}|${upper(values.modelName)}`);
    if (!model) errors.push(`Modèle « ${values.modelName} » inconnu pour la marque ${values.manufacturer ?? "?"} (le déclarer dans le référentiel).`);
    modelId = model?.id;
  }
  const { companyCode: _c, siteCode: _s, categoryCode: _k, modelName: _m, ...rest } = values;
  return { errors, input: { ...rest, companyId: company?.id, siteId: site?.id, categoryId: category?.id, modelId } };
}

function resolveStock(ctx: AuthContext, values: Record<string, unknown>, refs: References, partsBySku: Map<string, { id: string }>) {
  const errors: string[] = [];
  const part = partsBySku.get(upper(values.sku));
  const warehouse = refs.warehouses.get(upper(values.warehouseCode));
  if (values.sku && !part) errors.push(`Article « ${values.sku} » inconnu : importer d'abord les articles.`);
  if (values.warehouseCode && !warehouse) errors.push(`Magasin « ${values.warehouseCode} » inconnu ou inactif.`);
  if (warehouse && !ctx.canOn("stock.move", warehouse)) errors.push(`Magasin « ${values.warehouseCode} » hors de votre périmètre.`);
  const thresholds = { minQty: values.minQty, reorderPoint: values.reorderPoint, maxQty: values.maxQty };
  const hasThresholds = Object.values(thresholds).some((v) => v !== undefined);
  if (hasThresholds && warehouse && !ctx.canOn("part.write", warehouse))
    errors.push("Seuils de réapprovisionnement : droit de gestion des articles requis.");
  if (hasThresholds) {
    const check = stockLevelSettingsInput.safeParse(thresholds);
    if (!check.success) errors.push(...check.error.issues.map((i) => i.message));
  }
  return {
    errors,
    input: {
      partId: part?.id,
      warehouseId: warehouse?.id,
      quantity: values.quantity,
      unitCost: values.unitCost,
      ...(hasThresholds ? { thresholds } : {}),
    },
  };
}

/** Lignes déjà présentes en base (réimportation) : ignorées, jamais recréées. */
async function existingKeys(ctx: AuthContext, kind: ImportKind, rows: { values: Record<string, unknown>; input?: Record<string, unknown> }[]) {
  if (kind === "EQUIPMENT") {
    const codes = [...new Set(rows.map((r) => upper(r.values.code)).filter(Boolean))];
    if (codes.length === 0) return new Set<string>();
    const found = await db
      .select({ code: equipment.code })
      .from(equipment)
      .where(and(eq(equipment.tenantId, ctx.tenantId), inArray(equipment.code, codes)));
    return new Set(found.map((f) => upper(f.code)));
  }
  if (kind === "PARTS") {
    const skus = [...new Set(rows.map((r) => upper(r.values.sku)).filter(Boolean))];
    if (skus.length === 0) return new Set<string>();
    const found = await db
      .select({ sku: parts.sku })
      .from(parts)
      .where(and(eq(parts.tenantId, ctx.tenantId), inArray(parts.sku, skus)));
    return new Set(found.map((f) => upper(f.sku)));
  }
  // Stock initial : un article déjà mouvementé dans ce magasin n'est plus « initial ».
  const partIds = [...new Set(rows.map((r) => r.input?.partId as string | undefined).filter((v): v is string => !!v))];
  if (partIds.length === 0) return new Set<string>();
  const found = await db
    .selectDistinct({ partId: stockMovements.partId, warehouseId: stockMovements.warehouseId })
    .from(stockMovements)
    .where(and(eq(stockMovements.tenantId, ctx.tenantId), inArray(stockMovements.partId, partIds)));
  return new Set(found.map((f) => `${f.partId}|${f.warehouseId}`));
}

/** Diagnostic complet des lignes : format, doublons du fichier, références, doublons en base, contrôles de saisie. */
async function checkRows(ctx: AuthContext, kind: ImportKind, read: ReadResult["rows"]): Promise<ImportRow[]> {
  const definition = IMPORT_DEFINITIONS[kind];
  const refs = await loadReferences(ctx);
  const keyLabel = kind === "INITIAL_STOCK" ? "Article et magasin" : (definition.columns.find((c) => c.key === definition.key)?.label ?? "Clé");
  const keyed = read.map((r) => ({ line: r.line, values: r.values, readErrors: r.errors, key: rowKey(kind, r.values) }));
  const dupByLine = duplicateLines(keyed, keyLabel);
  const secondary =
    kind === "EQUIPMENT"
      ? secondaryDuplicateLines(read, ["manufacturer", "serialNumber"], "Marque et numéro de série")
      : kind === "PARTS"
        ? secondaryDuplicateLines(read, ["manufacturer", "manufacturerRef"], "Marque et référence fabricant")
        : new Map<number, string>();

  let partsBySku = new Map<string, { id: string }>();
  if (kind === "INITIAL_STOCK") {
    const skus = [...new Set(read.map((r) => upper(r.values.sku)).filter(Boolean))];
    if (skus.length > 0) {
      const found = await db
        .select({ id: parts.id, sku: parts.sku })
        .from(parts)
        .where(and(eq(parts.tenantId, ctx.tenantId), inArray(parts.sku, skus)));
      partsBySku = new Map(found.map((p) => [upper(p.sku), { id: p.id }]));
    }
  }

  const resolved = keyed.map((r) => {
    if (kind === "EQUIPMENT") return { ...r, ...(resolveEquipment(r.values, refs) as { errors: string[]; input: Record<string, unknown> }) };
    if (kind === "INITIAL_STOCK")
      return { ...r, ...(resolveStock(ctx, r.values, refs, partsBySku) as { errors: string[]; input: Record<string, unknown> }) };
    return { ...r, errors: [] as string[], input: { ...r.values } as Record<string, unknown> };
  });
  const existing = await existingKeys(ctx, kind, resolved);
  const importCtx = importContext(ctx);

  const result: ImportRow[] = [];
  for (const r of resolved) {
    const messages = [...r.errors, ...r.readErrors];
    const dup = dupByLine.get(r.line) ?? secondary.get(r.line);
    if (dup) messages.unshift(dup);
    const base = { line: r.line, key: r.key, values: r.values };
    if (messages.length > 0) {
      result.push({ ...base, status: "ERROR", messages });
      continue;
    }
    const existsKey = kind === "INITIAL_STOCK" ? `${r.input.partId}|${r.input.warehouseId}` : upper(r.values[definition.key]);
    if (existing.has(existsKey)) {
      result.push({
        ...base,
        status: "EXISTS",
        messages: [kind === "INITIAL_STOCK" ? "Stock déjà initialisé (mouvements existants) : ligne ignorée." : "Déjà présent : ligne ignorée."],
      });
      continue;
    }
    const check = await checkRow(importCtx, kind, r.input);
    result.push({ ...base, ...check, messages: check.messages });
  }
  return result;
}

/** Contrôles du service de saisie, sans écriture. */
async function checkRow(ctx: AuthContext, kind: ImportKind, input: Record<string, unknown>): Promise<RowCheck> {
  const columns = IMPORT_DEFINITIONS[kind].columns;
  try {
    if (kind === "EQUIPMENT") await checkEquipmentCreation(ctx, input);
    else if (kind === "PARTS") await checkPartCreation(ctx, input);
    else {
      const quantity = Number(input.quantity);
      if (!(quantity > 0)) throw new BusinessRuleError(["Quantité : supérieure à 0 attendue."]);
    }
    return { status: "READY", messages: [], input };
  } catch (error) {
    if (error instanceof ConflictError) return { status: "ERROR", messages: [error.message] };
    return { status: "ERROR", messages: messagesOf(error, columns) };
  }
}

/** Création d'une ligne par le service de saisie (mêmes règles, audit sur le canal IMPORT). */
async function importRow(ctx: AuthContext, kind: ImportKind, input: Record<string, unknown>): Promise<string> {
  if (kind === "EQUIPMENT") return (await createEquipment(ctx, input)).id;
  if (kind === "PARTS") return (await createPart(ctx, input)).id;
  const movement = await createMovement(ctx, {
    type: "RECEIPT",
    partId: input.partId,
    warehouseId: input.warehouseId,
    quantity: input.quantity,
    unitCost: input.unitCost,
    reference: "Stock initial (import)",
    // Idempotence : un article n'est initialisé qu'une fois par magasin, même si l'exécution est rejouée.
    clientId: `import-stock-${input.partId}-${input.warehouseId}`,
  });
  if (input.thresholds) {
    const [level] = await db
      .select({ id: stockLevels.id })
      .from(stockLevels)
      .where(and(eq(stockLevels.partId, input.partId as string), eq(stockLevels.warehouseId, input.warehouseId as string)));
    if (level) await updateStockLevelSettings(ctx, level.id, input.thresholds);
  }
  return movement.id;
}

/* ------------------------------------------------------------------ */
/* Simulation, exécution, consultation                                  */
/* ------------------------------------------------------------------ */

/**
 * Simulation (§11.2) : lit le fichier, applique tous les contrôles de la saisie et enregistre le
 * diagnostic ligne par ligne, sans rien créer. L'exécution se fait ensuite à partir de ce diagnostic.
 */
export async function simulateImport(ctx: AuthContext, rawKind: unknown, file: ImportFile | null) {
  const kind = parseInput(kindSchema, rawKind);
  assertCan(ctx, IMPORT_PERMISSION[kind]);
  if (!file || file.bytes.byteLength === 0) throw new BusinessRuleError(["Aucun fichier reçu."]);

  const read = await readWorkbook(kind, file);
  const rows = read.fileErrors.length > 0 ? [] : await checkRows(ctx, kind, read.rows);
  const summary = summarize(rows);
  const [job] = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(importJobs)
      .values({
        tenantId: ctx.tenantId,
        kind,
        fileName: file.name.slice(-200),
        sha256: createHash("sha256").update(file.bytes).digest("hex"),
        totalRows: summary.total,
        readyRows: summary.ready,
        existingRows: summary.exists,
        errorRows: summary.errors,
        fileErrors: read.fileErrors,
        rows,
        createdById: ctx.userId,
      })
      .returning({ id: importJobs.id });
    await audit(tx, ctx, {
      entityType: "import",
      entityId: inserted[0].id,
      action: "import.simulate",
      after: { kind, fileName: file.name, ...summary },
    });
    return inserted;
  });
  return { id: job.id, kind, summary, fileErrors: read.fileErrors };
}

async function loadJob(ctx: AuthContext, id: string) {
  if (!z.uuid().safeParse(id).success) throw new NotFoundError("Import");
  const [job] = await db
    .select()
    .from(importJobs)
    .where(and(eq(importJobs.id, id), eq(importJobs.tenantId, ctx.tenantId)));
  // Un import d'un type non autorisé est « introuvable » pour l'utilisateur.
  if (!job || !ctx.can(IMPORT_PERMISSION[job.kind])) throw new NotFoundError("Import");
  return job;
}

export async function getImportJob(ctx: AuthContext, id: string) {
  const job = await loadJob(ctx, id);
  const [previous] = await db
    .select({ id: importJobs.id, executedAt: importJobs.executedAt })
    .from(importJobs)
    .where(and(eq(importJobs.tenantId, ctx.tenantId), eq(importJobs.sha256, job.sha256), eq(importJobs.status, "DONE"), ne(importJobs.id, job.id)))
    .orderBy(desc(importJobs.executedAt))
    .limit(1);
  const [author] = await db.select({ name: user.name }).from(user).where(eq(user.id, job.createdById));
  return { ...job, author: author?.name ?? null, summary: summarize(job.rows), alreadyImported: previous ?? null };
}

export async function listImportJobs(ctx: AuthContext, limit = 30) {
  const kinds = importableKinds(ctx);
  if (kinds.length === 0) return [];
  return db
    .select({
      id: importJobs.id,
      kind: importJobs.kind,
      fileName: importJobs.fileName,
      status: importJobs.status,
      mode: importJobs.mode,
      totalRows: importJobs.totalRows,
      readyRows: importJobs.readyRows,
      existingRows: importJobs.existingRows,
      errorRows: importJobs.errorRows,
      importedRows: importJobs.importedRows,
      createdAt: importJobs.createdAt,
      executedAt: importJobs.executedAt,
      author: user.name,
    })
    .from(importJobs)
    .innerJoin(user, eq(user.id, importJobs.createdById))
    .where(and(eq(importJobs.tenantId, ctx.tenantId), inArray(importJobs.kind, kinds)))
    .orderBy(desc(importJobs.createdAt))
    .limit(limit);
}

export const executeInput = z.object({ mode: z.enum(["ALL_OR_NOTHING", "VALID_ONLY"], "Mode attendu : ALL_OR_NOTHING ou VALID_ONLY") });

/** Durée de validité d'une simulation : au-delà, les données ont pu changer, il faut la relancer. */
const SIMULATION_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Exécution (§11.2) : « tout ou rien » refuse s'il reste une erreur ; « lignes valides seulement »
 * importe les lignes prêtes. Les lignes sont recontrôlées juste avant, puis créées une à une par les
 * services de saisie ; une ligne déjà présente n'est jamais recréée (réimportation sans doublon).
 */
export async function executeImport(ctx: AuthContext, id: string, raw: unknown, now: Date = new Date()) {
  const { mode } = parseInput(executeInput, raw);
  const job = await loadJob(ctx, id);
  assertCan(ctx, IMPORT_PERMISSION[job.kind]);
  if (job.status !== "SIMULATED") throw new ConflictError("Cet import a déjà été exécuté.");
  if (now.getTime() - job.createdAt.getTime() > SIMULATION_TTL_MS) {
    throw new BusinessRuleError(["Simulation de plus de 24 h : relancer la simulation avec le fichier."]);
  }

  // Verrou : une seule exécution, même en cas de double clic ou d'appels simultanés.
  const [locked] = await db
    .update(importJobs)
    .set({ status: "RUNNING" })
    .where(and(eq(importJobs.id, job.id), eq(importJobs.status, "SIMULATED")))
    .returning({ id: importJobs.id });
  if (!locked) throw new ConflictError("Cet import est déjà en cours ou exécuté.");

  const importCtx = importContext(ctx);
  try {
    // Nouveau contrôle des lignes prêtes : la base a pu changer depuis la simulation.
    const ready = job.rows.filter((r) => r.status === "READY");
    const refreshed = await checkRows(
      ctx,
      job.kind,
      ready.map((r) => ({ line: r.line, values: r.values, errors: [] })),
    );
    const byLine = new Map(refreshed.map((r) => [r.line, r]));
    let rows: ImportRow[] = job.rows.map((r) => (r.status === "READY" ? (byLine.get(r.line) ?? r) : r));

    const decision = canExecute(mode, summarize(rows));
    if (!decision.ok) {
      await saveJob(job.id, rows, { status: "SIMULATED" });
      throw new BusinessRuleError([decision.reason]);
    }

    const done: ImportRow[] = [];
    for (const row of rows) {
      if (row.status !== "READY" || !row.input) {
        done.push(row);
        continue;
      }
      try {
        const entityId = await importRow(importCtx, job.kind, row.input);
        done.push({ ...row, status: "IMPORTED", entityId, messages: [] });
      } catch (error) {
        done.push({ ...row, status: "ERROR", messages: messagesOf(error, IMPORT_DEFINITIONS[job.kind].columns) });
      }
    }
    rows = done;
    const summary = summarize(rows);
    await db.transaction(async (tx) => {
      await saveJob(job.id, rows, { status: "DONE", mode, executedAt: now }, tx);
      await audit(tx, ctx, { entityType: "import", entityId: job.id, action: "import.execute", after: { kind: job.kind, mode, ...summary } });
    });
    return { id: job.id, summary };
  } catch (error) {
    // Échec imprévu : l'import repasse à « simulé » pour pouvoir être relancé (les lignes créées ne seront pas recréées).
    await db
      .update(importJobs)
      .set({ status: "SIMULATED" })
      .where(and(eq(importJobs.id, job.id), eq(importJobs.status, "RUNNING")));
    throw error;
  }
}

async function saveJob(
  id: string,
  rows: ImportRow[],
  set: { status: "SIMULATED" | "DONE"; mode?: "ALL_OR_NOTHING" | "VALID_ONLY"; executedAt?: Date },
  tx: DbOrTx = db,
) {
  const s = summarize(rows);
  await tx
    .update(importJobs)
    .set({
      ...set,
      rows,
      totalRows: s.total,
      readyRows: s.ready,
      existingRows: s.exists,
      errorRows: s.errors,
      importedRows: s.imported,
    })
    .where(eq(importJobs.id, id));
}

/* ------------------------------------------------------------------ */
/* Fichiers Excel : modèle et rapport                                   */
/* ------------------------------------------------------------------ */

const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } };
const DATA_ROWS = 2000;

function columnLetter(index: number) {
  let n = index;
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/**
 * Modèle Excel d'un import : onglet de saisie (en-têtes, formats, listes déroulantes),
 * onglet « Aide » (règles de chaque colonne) et onglet « Listes » (codes du périmètre de l'utilisateur).
 */
export async function importTemplate(ctx: AuthContext, rawKind: unknown) {
  const kind = parseInput(kindSchema, rawKind);
  assertCan(ctx, IMPORT_PERMISSION[kind]);
  const definition = IMPORT_DEFINITIONS[kind];
  const refs = await loadReferences(ctx);
  const permission = IMPORT_PERMISSION[kind];

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "GMAO";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(definition.sheet, { views: [{ state: "frozen", ySplit: 1 }] });
  // Validations par plage : présentes à l'exécution d'exceljs, absentes de ses déclarations de types.
  const validations = (sheet as unknown as { dataValidations: { add(range: string, validation: ExcelJS.DataValidation): void } }).dataValidations;
  const help = workbook.addWorksheet("Aide");
  const lists = workbook.addWorksheet("Listes");

  // Listes de codes, limitées au périmètre de l'utilisateur pour ce type d'import.
  const inScope = (target: { companyId: string; siteId?: string | null }) => ctx.canOn(permission, target);
  const listColumns: Record<string, { title: string; rows: [string, string][] }> = {
    companies: {
      title: "Sociétés",
      rows: refs.lists.companyRows
        .filter(
          (c) => inScope({ companyId: c.id }) || refs.lists.siteRows.some((s) => s.companyId === c.id && inScope({ companyId: c.id, siteId: s.id })),
        )
        .map((c) => [c.code, c.name]),
    },
    sites: {
      title: "Sites",
      rows: refs.lists.siteRows.filter((s) => inScope({ companyId: s.companyId, siteId: s.id })).map((s) => [s.code, s.name]),
    },
    categories: { title: "Catégories", rows: refs.lists.categoryRows.map((c) => [c.code, c.name]) },
    warehouses: {
      title: "Magasins",
      rows: refs.lists.warehouseRows.filter((w) => inScope({ companyId: w.companyId, siteId: w.siteId })).map((w) => [w.code, w.name]),
    },
  };
  const usedLists = [...new Set(definition.columns.map((c) => c.list).filter((l): l is NonNullable<ImportColumn["list"]> => !!l))];
  const listRanges: Record<string, string> = {};
  usedLists.forEach((name, i) => {
    const col = i * 3 + 1;
    const { title, rows } = listColumns[name];
    lists.getCell(1, col).value = `${title} (code)`;
    lists.getCell(1, col + 1).value = "Nom";
    rows.forEach(([code, label], r) => {
      lists.getCell(r + 2, col).value = code;
      lists.getCell(r + 2, col + 1).value = label;
    });
    lists.getColumn(col).width = 18;
    lists.getColumn(col + 1).width = 32;
    if (rows.length > 0) listRanges[name] = `Listes!$${columnLetter(col)}$2:$${columnLetter(col)}$${rows.length + 1}`;
  });
  lists.getRow(1).font = { bold: true };

  definition.columns.forEach((column, i) => {
    const index = i + 1;
    const cell = sheet.getCell(1, index);
    cell.value = column.required ? `${column.label} *` : column.label;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = HEADER_FILL;
    cell.note = column.help;
    const col = sheet.getColumn(index);
    col.width = Math.max(14, column.label.length + 4);
    if (column.type === "date") col.numFmt = "dd/mm/yyyy";
    const range = `${columnLetter(index)}2:${columnLetter(index)}${DATA_ROWS + 1}`;
    if (column.type === "enum" && column.choices) {
      validations.add(range, {
        type: "list",
        allowBlank: !column.required,
        formulae: [`"${Object.keys(column.choices).join(",")}"`],
        showErrorMessage: true,
        errorTitle: column.label,
        error: `Valeurs possibles : ${Object.keys(column.choices).join(", ")}`,
      });
    } else if (column.type === "boolean") {
      validations.add(range, { type: "list", allowBlank: true, formulae: ['"Oui,Non"'] });
    } else if (column.list && listRanges[column.list]) {
      validations.add(range, {
        type: "list",
        allowBlank: !column.required,
        formulae: [listRanges[column.list]],
        showErrorMessage: true,
        errorTitle: column.label,
        error: "Code absent de l'onglet Listes.",
      });
    }
  });

  help.columns = [
    { header: "Colonne", width: 26 },
    { header: "Obligatoire", width: 12 },
    { header: "Règle", width: 60 },
    { header: "Valeurs possibles", width: 40 },
    { header: "Exemple", width: 24 },
  ];
  help.getRow(1).font = { bold: true };
  for (const column of definition.columns) {
    help.addRow([
      column.label,
      column.required ? "Oui" : "Non",
      column.help,
      column.choices ? Object.keys(column.choices).join(", ") : column.type === "boolean" ? "Oui, Non" : column.list ? "Voir l'onglet Listes" : "",
      column.example,
    ]);
  }
  help.addRow([]);
  help.addRow([`Réimportation : une ligne dont la clé existe déjà (${definition.key}) est ignorée, jamais recréée.`]);
  help.addRow(["Chaque import passe d'abord par une simulation qui contrôle toutes les lignes et produit un rapport."]);

  const buffer = await workbook.xlsx.writeBuffer();
  return { fileName: `modele-import-${kind.toLowerCase().replace("_", "-")}.xlsx`, buffer: new Uint8Array(buffer as ArrayBuffer) };
}

const STATUS_LABEL: Record<string, string> = { READY: "À importer", EXISTS: "Déjà présent (ignoré)", ERROR: "Erreur", IMPORTED: "Importé" };

/** Rapport Excel : chaque ligne du fichier avec son statut et ses anomalies, prêt à corriger. */
export async function importReport(ctx: AuthContext, id: string) {
  const job = await loadJob(ctx, id);
  const definition = IMPORT_DEFINITIONS[job.kind];
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Rapport", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = [
    { header: "Ligne", width: 8 },
    { header: "Statut", width: 22 },
    { header: "Anomalies à corriger", width: 70 },
    ...definition.columns.map((c) => ({ header: c.label, width: Math.max(14, c.label.length + 4) })),
  ];
  sheet.getRow(1).font = { bold: true };
  for (const message of job.fileErrors) sheet.addRow(["—", "Erreur", message]);
  for (const row of job.rows) {
    const added = sheet.addRow([
      row.line,
      STATUS_LABEL[row.status] ?? row.status,
      row.messages.join("\n"),
      ...definition.columns.map((c) => {
        const v = row.values[c.key];
        if (v === undefined || v === null) return null;
        if (c.type === "date") return new Date(String(v));
        if (c.choices) return Object.entries(c.choices).find(([, value]) => value === v)?.[0] ?? v;
        if (c.type === "boolean") return v ? "Oui" : "Non";
        return v as string | number;
      }),
    ]);
    added.getCell(3).alignment = { wrapText: true, vertical: "top" };
    if (row.status === "ERROR") added.getCell(2).font = { color: { argb: "FFB91C1C" }, bold: true };
  }
  definition.columns.forEach((c, i) => {
    if (c.type === "date") sheet.getColumn(i + 4).numFmt = "dd/mm/yyyy";
  });
  const buffer = await workbook.xlsx.writeBuffer();
  const base = job.fileName.replace(/\.xlsx$/i, "");
  return { fileName: `rapport-${base}.xlsx`, buffer: new Uint8Array(buffer as ArrayBuffer) };
}

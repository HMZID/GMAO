/**
 * Imports Excel (EQP-13, INT-01, §11.2) : description des colonnes de chaque modèle, lecture et contrôle
 * des cellules, repérage des doublons dans le fichier. Module pur, testé dans `__tests__/imports.test.ts`.
 * Les contrôles métier (références, droits, doublons en base) sont ceux des services de saisie.
 */

export const IMPORT_KINDS = ["EQUIPMENT", "PARTS", "INITIAL_STOCK"] as const;
export type ImportKind = (typeof IMPORT_KINDS)[number];

export type ColumnType = "text" | "number" | "integer" | "date" | "enum" | "boolean";

export type ImportColumn = {
  key: string;
  label: string;
  required?: boolean;
  type: ColumnType;
  /** Valeurs proposées (libellé affiché → valeur enregistrée). */
  choices?: Record<string, string>;
  /** Liste de référence de l'onglet « Listes » (codes de l'organisation). */
  list?: "companies" | "sites" | "categories" | "warehouses";
  max?: number;
  min?: number;
  help: string;
  example: string;
};

const CRITICALITY = { A: "A", B: "B", C: "C" };

export const IMPORT_DEFINITIONS: Record<ImportKind, { label: string; sheet: string; key: string; columns: ImportColumn[] }> = {
  EQUIPMENT: {
    label: "Équipements",
    sheet: "Équipements",
    key: "code",
    columns: [
      {
        key: "code",
        label: "Code parc",
        required: true,
        type: "text",
        max: 40,
        help: "Unique dans le groupe ; clé de réimportation",
        example: "PE-021",
      },
      { key: "name", label: "Désignation", required: true, type: "text", max: 160, help: "Libellé de l'engin", example: "Pelle sur chenilles 25 t" },
      {
        key: "companyCode",
        label: "Société",
        required: true,
        type: "text",
        list: "companies",
        help: "Code de la société propriétaire",
        example: "SBTP",
      },
      {
        key: "siteCode",
        label: "Site",
        required: true,
        type: "text",
        list: "sites",
        help: "Code du site de rattachement, de la même société",
        example: "LYON",
      },
      {
        key: "categoryCode",
        label: "Catégorie",
        required: true,
        type: "text",
        list: "categories",
        help: "Code de la catégorie : plans d'entretien appliqués",
        example: "PELLE",
      },
      { key: "manufacturer", label: "Marque", required: true, type: "text", max: 80, help: "Marque du constructeur", example: "Caterpillar" },
      { key: "modelName", label: "Modèle", type: "text", max: 120, help: "Modèle déjà déclaré pour cette marque (facultatif)", example: "320" },
      {
        key: "serialNumber",
        label: "Numéro de série",
        required: true,
        type: "text",
        max: 80,
        help: "Marque + numéro de série uniques (DON-12)",
        example: "CAT0320XKZ12345",
      },
      { key: "registration", label: "Immatriculation", type: "text", max: 30, help: "Unique parmi les équipements en service", example: "" },
      { key: "year", label: "Année", type: "integer", min: 1950, max: 2100, help: "Année de fabrication", example: "2022" },
      {
        key: "criticality",
        label: "Criticité",
        type: "enum",
        choices: CRITICALITY,
        help: "A, B ou C ; par défaut celle de la catégorie",
        example: "B",
      },
      {
        key: "acquisitionMode",
        label: "Mode d'acquisition",
        type: "enum",
        choices: {
          Achat: "PURCHASE",
          "Crédit-bail": "LEASE",
          "Location longue durée": "LONG_TERM_RENTAL",
          "Location courte durée": "SHORT_TERM_RENTAL",
        },
        help: "Achat par défaut",
        example: "Achat",
      },
      { key: "acquisitionDate", label: "Date d'acquisition", type: "date", help: "JJ/MM/AAAA", example: "15/03/2022" },
      { key: "acquisitionValue", label: "Valeur d'acquisition", type: "number", min: 0, help: "En euros", example: "185000" },
      { key: "commissioningDate", label: "Date de mise en service", required: true, type: "date", help: "JJ/MM/AAAA", example: "01/04/2022" },
      { key: "warrantyEndDate", label: "Fin de garantie", type: "date", help: "JJ/MM/AAAA", example: "01/04/2024" },
      {
        key: "primaryMeterType",
        label: "Compteur principal",
        type: "enum",
        choices: { "Heures moteur": "HOURS", Kilométrage: "KM", Cycles: "CYCLES", Autre: "OTHER" },
        help: "Crée le compteur principal",
        example: "Heures moteur",
      },
      {
        key: "primaryMeterValue",
        label: "Valeur du compteur",
        type: "number",
        min: 0,
        help: "Valeur initiale du compteur principal",
        example: "3250",
      },
      { key: "notes", label: "Observations", type: "text", max: 2000, help: "Texte libre", example: "" },
    ],
  },
  PARTS: {
    label: "Pièces détachées",
    sheet: "Articles",
    key: "sku",
    columns: [
      {
        key: "sku",
        label: "Référence interne",
        required: true,
        type: "text",
        max: 40,
        help: "Unique ; clé de réimportation",
        example: "FLT-HYD-0420",
      },
      {
        key: "name",
        label: "Désignation",
        required: true,
        type: "text",
        max: 160,
        help: "Libellé de l'article",
        example: "Filtre hydraulique retour",
      },
      { key: "family", label: "Famille", type: "text", max: 60, help: "Regroupement libre", example: "Filtration" },
      { key: "unit", label: "Unité", type: "text", max: 10, help: "u, l, m, kg… (u par défaut)", example: "u" },
      { key: "manufacturer", label: "Marque", type: "text", max: 80, help: "Marque + référence fabricant uniques (DON-12)", example: "Hydac" },
      { key: "manufacturerRef", label: "Référence fabricant", type: "text", max: 80, help: "Référence du fabricant", example: "0160R010BN4HC" },
      {
        key: "tracking",
        label: "Suivi",
        type: "enum",
        choices: { Quantité: "QUANTITY", Lot: "LOT", "Numéro de série": "SERIAL" },
        help: "Quantité par défaut",
        example: "Quantité",
      },
      { key: "isRepairable", label: "Réparable", type: "boolean", help: "Oui ou Non", example: "Non" },
      { key: "criticality", label: "Criticité", type: "enum", choices: CRITICALITY, help: "A, B ou C (C par défaut)", example: "B" },
    ],
  },
  INITIAL_STOCK: {
    label: "Stocks initiaux",
    sheet: "Stocks initiaux",
    key: "sku+warehouseCode",
    columns: [
      {
        key: "sku",
        label: "Référence interne",
        required: true,
        type: "text",
        max: 40,
        help: "Article existant (importer les articles d'abord)",
        example: "FLT-HYD-0420",
      },
      { key: "warehouseCode", label: "Magasin", required: true, type: "text", list: "warehouses", help: "Code du magasin", example: "MAG-LYON" },
      { key: "quantity", label: "Quantité", required: true, type: "number", min: 0.001, help: "Stock physique compté, supérieur à 0", example: "12" },
      { key: "unitCost", label: "Coût unitaire", type: "number", min: 0, help: "En euros ; coût moyen actuel par défaut", example: "38.5" },
      { key: "minQty", label: "Stock minimum", type: "number", min: 0, help: "Facultatif", example: "2" },
      { key: "reorderPoint", label: "Point de commande", type: "number", min: 0, help: "Facultatif (STK-08)", example: "4" },
      { key: "maxQty", label: "Stock maximum", type: "number", min: 0, help: "Facultatif, ≥ point de commande", example: "20" },
    ],
  },
};

/** Nombre maximal de lignes par fichier. */
export const MAX_IMPORT_ROWS = 5000;

/** Taille maximale d'un fichier d'import, en octets. */
export const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024;

/* ------------------------------------------------------------------ */
/* En-têtes                                                             */
/* ------------------------------------------------------------------ */

/** Libellé comparable : sans accents, astérisque, ponctuation ni casse. */
export function normalizeLabel(label: string) {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[*'’]/g, " ")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

export type HeaderMap = { indexByKey: Record<string, number>; missing: string[]; unknown: string[] };

/** Associe les colonnes du fichier à celles du modèle, quel que soit leur ordre. */
export function mapHeaders(headers: (string | null | undefined)[], columns: ImportColumn[]): HeaderMap {
  const byLabel = new Map(columns.map((c) => [normalizeLabel(c.label), c.key]));
  const indexByKey: Record<string, number> = {};
  const unknown: string[] = [];
  headers.forEach((header, index) => {
    if (!header || !String(header).trim()) return;
    const key = byLabel.get(normalizeLabel(String(header)));
    if (key && indexByKey[key] === undefined) indexByKey[key] = index;
    else if (!key) unknown.push(String(header).trim());
  });
  const missing = columns.filter((c) => c.required && indexByKey[c.key] === undefined).map((c) => c.label);
  return { indexByKey, missing, unknown };
}

/* ------------------------------------------------------------------ */
/* Cellules                                                             */
/* ------------------------------------------------------------------ */

/** Valeur brute d'une cellule, déjà simplifiée (texte, nombre, date, booléen ou vide). */
export type CellValue = string | number | boolean | Date | null;

/** Simplifie une valeur de cellule Excel (texte enrichi, formule, lien hypertexte) en valeur simple. */
export function simplifyCell(value: unknown): CellValue {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value;
  if (typeof value === "object") {
    const v = value as { richText?: { text: string }[]; result?: unknown; text?: unknown; error?: string };
    if (Array.isArray(v.richText)) return v.richText.map((r) => r.text).join("");
    if ("result" in v) return simplifyCell(v.result);
    if (typeof v.text === "string") return v.text;
    if (v.error) return null;
  }
  return String(value);
}

const DATE_FR = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/;
const DATE_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Date du calendrier (minuit UTC), comme les champs date des formulaires. */
function calendarDate(year: number, month: number, day: number): Date | null {
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day ? d : null;
}

function parseNumber(value: CellValue): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[\s  €]/g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  return Number(cleaned);
}

export type ParsedCell = { ok: true; value: string | number | boolean | Date | undefined } | { ok: false; error: string };

/** Lit et contrôle une cellule selon sa colonne ; une cellule vide d'une colonne facultative vaut undefined. */
export function parseCell(raw: CellValue, column: ImportColumn): ParsedCell {
  const empty = raw === null || (typeof raw === "string" && raw.trim() === "");
  if (empty) return column.required ? { ok: false, error: `${column.label} : valeur obligatoire.` } : { ok: true, value: undefined };

  switch (column.type) {
    case "text": {
      const text = raw instanceof Date ? raw.toISOString().slice(0, 10) : String(raw).trim();
      if (column.max && text.length > column.max) return { ok: false, error: `${column.label} : ${column.max} caractères au plus.` };
      return { ok: true, value: text };
    }
    case "number":
    case "integer": {
      const n = parseNumber(raw);
      if (n === null) return { ok: false, error: `${column.label} : nombre attendu (« ${String(raw)} »).` };
      if (column.type === "integer" && !Number.isInteger(n)) return { ok: false, error: `${column.label} : nombre entier attendu.` };
      if (column.min !== undefined && n < column.min) return { ok: false, error: `${column.label} : ${column.min} au minimum.` };
      if (column.type === "integer" && column.max !== undefined && n > column.max)
        return { ok: false, error: `${column.label} : ${column.max} au maximum.` };
      return { ok: true, value: n };
    }
    case "date": {
      if (raw instanceof Date) {
        const d = calendarDate(raw.getUTCFullYear(), raw.getUTCMonth() + 1, raw.getUTCDate());
        return d ? { ok: true, value: d } : { ok: false, error: `${column.label} : date invalide.` };
      }
      const text = String(raw).trim();
      const fr = DATE_FR.exec(text);
      const iso = DATE_ISO.exec(text);
      const d = fr ? calendarDate(+fr[3], +fr[2], +fr[1]) : iso ? calendarDate(+iso[1], +iso[2], +iso[3]) : null;
      return d ? { ok: true, value: d } : { ok: false, error: `${column.label} : date attendue au format JJ/MM/AAAA (« ${text} »).` };
    }
    case "boolean": {
      const text = normalizeLabel(String(raw));
      if (["oui", "o", "yes", "true", "vrai", "1", "x"].includes(text)) return { ok: true, value: true };
      if (["non", "n", "no", "false", "faux", "0"].includes(text)) return { ok: true, value: false };
      return { ok: false, error: `${column.label} : Oui ou Non attendu.` };
    }
    case "enum": {
      const choices = column.choices ?? {};
      const wanted = normalizeLabel(String(raw));
      const match = Object.entries(choices).find(([label, value]) => normalizeLabel(label) === wanted || normalizeLabel(value) === wanted);
      if (!match) return { ok: false, error: `${column.label} : valeur « ${String(raw)} » inconnue (${Object.keys(choices).join(", ")}).` };
      return { ok: true, value: match[1] };
    }
  }
}

export type ParsedRow = { values: Record<string, unknown>; errors: string[]; empty: boolean };

/** Lit une ligne : toutes les anomalies de format sont listées en une fois (DON-11). */
export function parseRow(cells: CellValue[], columns: ImportColumn[], indexByKey: Record<string, number>): ParsedRow {
  const values: Record<string, unknown> = {};
  const errors: string[] = [];
  const present = columns.filter((c) => indexByKey[c.key] !== undefined);
  const empty = present.every((c) => {
    const v = cells[indexByKey[c.key]];
    return v === null || v === undefined || (typeof v === "string" && v.trim() === "");
  });
  if (empty) return { values, errors, empty: true };

  for (const column of columns) {
    const index = indexByKey[column.key];
    const parsed = parseCell(index === undefined ? null : (cells[index] ?? null), column);
    if (parsed.ok) {
      if (parsed.value !== undefined) values[column.key] = parsed.value;
    } else {
      errors.push(parsed.error);
    }
  }
  return { values, errors, empty: false };
}

/** Clé de dédoublonnage d'une ligne (comparaison sans casse ni espaces superflus). */
export function rowKey(kind: ImportKind, values: Record<string, unknown>) {
  const norm = (v: unknown) =>
    String(v ?? "")
      .trim()
      .toUpperCase();
  return kind === "INITIAL_STOCK" ? `${norm(values.sku)}|${norm(values.warehouseCode)}` : norm(values[IMPORT_DEFINITIONS[kind].key]);
}

/**
 * Doublons à l'intérieur du fichier : la première occurrence est retenue, les suivantes sont en erreur
 * avec le numéro de la ligne d'origine. Renvoie, par numéro de ligne, le message d'erreur.
 */
export function duplicateLines(rows: { line: number; key: string }[], label: string): Map<number, string> {
  const firstLine = new Map<string, number>();
  const result = new Map<number, string>();
  for (const row of rows) {
    if (!row.key || row.key === "|") continue;
    const first = firstLine.get(row.key);
    if (first === undefined) firstLine.set(row.key, row.line);
    else result.set(row.line, `${label} en double dans le fichier (déjà en ligne ${first}).`);
  }
  return result;
}

/** Doublons secondaires (marque + numéro de série, marque + référence fabricant) dans le fichier. */
export function secondaryDuplicateLines(
  rows: { line: number; values: Record<string, unknown> }[],
  fields: [string, string],
  label: string,
): Map<number, string> {
  const keyed = rows.map((r) => {
    const a = String(r.values[fields[0]] ?? "").trim();
    const b = String(r.values[fields[1]] ?? "").trim();
    return { line: r.line, key: a && b ? `${a.toUpperCase()}|${b.toUpperCase()}` : "" };
  });
  return duplicateLines(keyed, label);
}

/* ------------------------------------------------------------------ */
/* Résultat                                                             */
/* ------------------------------------------------------------------ */

/** READY : importable ; EXISTS : déjà présent, ignoré (réimportation) ; ERROR : à corriger ; IMPORTED : créé. */
export type RowStatus = "READY" | "EXISTS" | "ERROR" | "IMPORTED";

export type ImportRow = {
  line: number;
  key: string;
  status: RowStatus;
  messages: string[];
  /** Valeurs lues, pour l'aperçu et le rapport. */
  values: Record<string, unknown>;
  /** Entrée du service de création, références résolues. */
  input?: Record<string, unknown>;
  entityId?: string;
};

export function summarize(rows: Pick<ImportRow, "status">[]) {
  const count = (s: RowStatus) => rows.filter((r) => r.status === s).length;
  return { total: rows.length, ready: count("READY"), exists: count("EXISTS"), errors: count("ERROR"), imported: count("IMPORTED") };
}

/** Le mode « tout ou rien » n'est possible que sans aucune ligne en erreur (§11.2). */
export function canExecute(
  mode: "ALL_OR_NOTHING" | "VALID_ONLY",
  summary: ReturnType<typeof summarize>,
): { ok: true } | { ok: false; reason: string } {
  if (summary.ready === 0) return { ok: false, reason: "Aucune ligne à importer." };
  if (mode === "ALL_OR_NOTHING" && summary.errors > 0)
    return { ok: false, reason: `${summary.errors} ligne(s) en erreur : corriger le fichier ou importer les lignes valides seulement.` };
  return { ok: true };
}

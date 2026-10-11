/**
 * Indicateurs personnalisés (KPI-11) : chaque organisation compose ses indicateurs à partir d'une liste
 * fermée de sources, de mesures, de regroupements et de filtres. Aucune requête libre : la définition est
 * validée ici, puis traduite en SQL par le service avec des colonnes connues et le périmètre de l'utilisateur.
 * Module pur, testé dans `__tests__/indicators.test.ts`.
 */
import {
  CRITICALITY,
  EQUIPMENT_STATUS,
  MOVEMENT_TYPE,
  PRIORITY,
  REQUEST_STATUS,
  REQUEST_TYPE,
  WORK_ORDER_STATUS,
  WORK_ORDER_TYPE,
} from "@/lib/labels";

export const INDICATOR_SOURCES = ["work-orders", "work-requests", "equipment", "labor", "stock-movements"] as const;
export type IndicatorSource = (typeof INDICATOR_SOURCES)[number];

export const INDICATOR_CHARTS = ["number", "bar", "table"] as const;
export type IndicatorChart = (typeof INDICATOR_CHARTS)[number];

export const INDICATOR_AGGREGATES = ["count", "sum", "avg"] as const;
export type IndicatorAggregate = (typeof INDICATOR_AGGREGATES)[number];

/** Périodes proposées (en jours) ; null = toute la période. */
export const INDICATOR_PERIODS = [7, 30, 90, 365] as const;

type Choices = Record<string, string | { label: string }>;

export type IndicatorField = { key: string; label: string; unit?: string };
export type IndicatorDimension = { key: string; label: string; choices?: Choices };

export type IndicatorSourceDefinition = {
  label: string;
  /** Ce qui est compté (« ordres de travail », « heures »…). */
  noun: string;
  /** Date qui situe une ligne dans la période. */
  dateLabel: string;
  /** Champs numériques additionnables. */
  fields: IndicatorField[];
  /** Regroupements possibles ; ceux qui ont des valeurs fixes servent aussi de filtres. */
  dimensions: IndicatorDimension[];
};

const month: IndicatorDimension = { key: "month", label: "Mois" };
const site: IndicatorDimension = { key: "site", label: "Site" };

export const INDICATOR_DEFINITIONS: Record<IndicatorSource, IndicatorSourceDefinition> = {
  "work-orders": {
    label: "Ordres de travail",
    noun: "ordre(s) de travail",
    dateLabel: "date de création",
    fields: [
      { key: "externalCost", label: "Coût prestataire", unit: "€" },
      { key: "estimatedHours", label: "Durée estimée", unit: "h" },
    ],
    dimensions: [
      { key: "status", label: "Statut", choices: WORK_ORDER_STATUS },
      { key: "type", label: "Type", choices: WORK_ORDER_TYPE },
      { key: "priority", label: "Priorité", choices: PRIORITY },
      site,
      { key: "category", label: "Catégorie d'équipement" },
      { key: "equipment", label: "Équipement" },
      { key: "supplier", label: "Prestataire" },
      month,
    ],
  },
  "work-requests": {
    label: "Demandes d'intervention",
    noun: "demande(s)",
    dateLabel: "date de signalement",
    fields: [],
    dimensions: [
      { key: "status", label: "Statut", choices: REQUEST_STATUS },
      { key: "priority", label: "Priorité", choices: PRIORITY },
      { key: "type", label: "Type", choices: REQUEST_TYPE },
      site,
      { key: "equipment", label: "Équipement" },
      month,
    ],
  },
  equipment: {
    label: "Équipements",
    noun: "équipement(s)",
    dateLabel: "date de mise en service",
    fields: [{ key: "acquisitionValue", label: "Valeur d'acquisition", unit: "€" }],
    dimensions: [
      { key: "status", label: "Statut", choices: EQUIPMENT_STATUS },
      { key: "criticality", label: "Criticité", choices: CRITICALITY },
      site,
      { key: "category", label: "Catégorie" },
      { key: "manufacturer", label: "Marque" },
    ],
  },
  labor: {
    label: "Temps passés (main-d'œuvre)",
    noun: "pointage(s)",
    dateLabel: "date du pointage",
    fields: [
      { key: "hours", label: "Heures", unit: "h" },
      { key: "laborCost", label: "Coût de main-d'œuvre", unit: "€" },
    ],
    dimensions: [
      { key: "technician", label: "Technicien" },
      site,
      { key: "workOrderType", label: "Type d'ordre de travail", choices: WORK_ORDER_TYPE },
      month,
    ],
  },
  "stock-movements": {
    label: "Mouvements de stock",
    noun: "mouvement(s)",
    dateLabel: "date du mouvement",
    fields: [
      { key: "quantity", label: "Quantité" },
      { key: "value", label: "Valeur", unit: "€" },
    ],
    dimensions: [
      { key: "type", label: "Type de mouvement", choices: MOVEMENT_TYPE },
      { key: "warehouse", label: "Magasin" },
      { key: "part", label: "Article" },
      month,
    ],
  },
};

export type IndicatorDefinition = {
  name: string;
  source: IndicatorSource;
  aggregate: IndicatorAggregate;
  /** Champ additionné ou moyenné (absent pour un comptage). */
  field?: string | null;
  /** Regroupement (absent : une seule valeur). */
  groupBy?: string | null;
  /** Filtre sur une dimension à valeurs fixes. */
  filterKey?: string | null;
  filterValue?: string | null;
  /** Période glissante en jours (absent : toute la période). */
  periodDays?: number | null;
  chart: IndicatorChart;
};

/** Contrôle d'une définition : toutes les anomalies en une fois (DON-11). */
export function validateIndicator(def: IndicatorDefinition): string[] {
  const errors: string[] = [];
  const source = INDICATOR_DEFINITIONS[def.source];
  if (!source) return ["Source inconnue."];
  if (def.aggregate === "count") {
    if (def.field) errors.push("Un comptage ne porte pas sur un champ.");
  } else if (!def.field) {
    errors.push(`Choisir le champ à ${def.aggregate === "sum" ? "additionner" : "moyenner"}.`);
  } else if (!source.fields.some((f) => f.key === def.field)) {
    errors.push(`Champ « ${def.field} » indisponible pour ${source.label.toLowerCase()}.`);
  }
  if (def.groupBy && !source.dimensions.some((d) => d.key === def.groupBy)) errors.push(`Regroupement « ${def.groupBy} » indisponible.`);
  if (def.filterKey) {
    const dimension = source.dimensions.find((d) => d.key === def.filterKey);
    if (!dimension?.choices) errors.push(`Filtre « ${def.filterKey} » indisponible.`);
    else if (!def.filterValue || !(def.filterValue in dimension.choices)) errors.push("Choisir la valeur du filtre.");
  }
  if (def.periodDays != null && !(INDICATOR_PERIODS as readonly number[]).includes(def.periodDays)) errors.push("Période inconnue.");
  if (def.chart !== "number" && !def.groupBy) errors.push("Un graphique ou un tableau demande un regroupement.");
  if (def.chart === "number" && def.groupBy) errors.push("Une valeur unique ne se regroupe pas : choisir un graphique ou un tableau.");
  return errors;
}

/** Libellé d'une valeur de regroupement (code d'énumération → libellé ; autres valeurs telles quelles). */
export function groupLabel(source: IndicatorSource, groupBy: string | null | undefined, key: string | null): string {
  if (key === null || key === "") return "Non renseigné";
  const dimension = INDICATOR_DEFINITIONS[source].dimensions.find((d) => d.key === groupBy);
  const entry = dimension?.choices?.[key];
  if (entry === undefined) return groupBy === "month" ? monthLabel(key) : key;
  return typeof entry === "string" ? entry : entry.label;
}

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/** « 2026-03 » → « mars 2026 ». */
export function monthLabel(key: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (!match) return key;
  return `${MONTHS[Number(match[2]) - 1] ?? match[2]} ${match[1]}`;
}

/** Unité affichée d'un indicateur : celle du champ, sinon le nom de ce qui est compté. */
export function indicatorUnit(def: Pick<IndicatorDefinition, "source" | "aggregate" | "field">) {
  const source = INDICATOR_DEFINITIONS[def.source];
  if (def.aggregate === "count") return source.noun;
  return source.fields.find((f) => f.key === def.field)?.unit ?? "";
}

/** « de » élidé devant une voyelle : « d'ordres », « de demandes ». */
const of = (word: string) => (/^[aeiouyéèêàâh]/i.test(word) ? `d'${word}` : `de ${word}`);

/** Phrase qui décrit l'indicateur (sous-titre de la carte). */
export function describeIndicator(def: IndicatorDefinition) {
  const source = INDICATOR_DEFINITIONS[def.source];
  const field = source.fields.find((f) => f.key === def.field);
  const what =
    def.aggregate === "count"
      ? `Nombre ${of(source.label.toLowerCase())}`
      : `${def.aggregate === "sum" ? "Total" : "Moyenne"} : ${field?.label.toLowerCase() ?? def.field}`;
  const by = def.groupBy ? ` par ${source.dimensions.find((d) => d.key === def.groupBy)?.label.toLowerCase() ?? def.groupBy}` : "";
  const filter =
    def.filterKey && def.filterValue
      ? `, ${source.dimensions.find((d) => d.key === def.filterKey)?.label.toLowerCase()} : ${groupLabel(def.source, def.filterKey, def.filterValue).toLowerCase()}`
      : "";
  const period = def.periodDays ? `, ${def.periodDays} derniers jours (${source.dateLabel})` : "";
  return `${what}${by}${filter}${period}`;
}

/** Arrondi d'affichage : 2 décimales au plus. */
export function roundValue(value: number) {
  return Math.round(value * 100) / 100;
}

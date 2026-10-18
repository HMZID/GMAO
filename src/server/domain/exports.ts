/**
 * Export des données de l'organisation (INT-01) : description des jeux de données et de leurs colonnes,
 * mise en forme CSV et JSON. Mêmes définitions pour l'écran d'export, l'API et le connecteur ETL.
 * Module pur, testé dans `__tests__/exports.test.ts`.
 */
import {
  ACQUISITION_MODE,
  CRITICALITY,
  EQUIPMENT_STATUS,
  METER_TYPE,
  MOVEMENT_TYPE,
  PART_TRACKING,
  PRIORITY,
  READING_SOURCE,
  READING_STATUS,
  REQUEST_STATUS,
  REQUEST_TYPE,
  WORK_ORDER_OUTCOME,
  WORK_ORDER_STATUS,
  WORK_ORDER_TYPE,
} from "@/lib/labels";

export const EXPORT_DATASETS = [
  "equipment",
  "work-orders",
  "work-requests",
  "meter-readings",
  "suppliers",
  "technicians",
  "parts",
  "stock-levels",
  "stock-movements",
] as const;
export type ExportDataset = (typeof EXPORT_DATASETS)[number];

export const EXPORT_FORMATS = ["xlsx", "csv", "json"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export type ExportColumn = {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "boolean";
  /** Libellés des codes : appliqués dans le classeur Excel ; CSV et JSON gardent les codes (stables pour un ETL). */
  labels?: Record<string, string | { label: string }>;
};

export type ExportDefinition = {
  label: string;
  /** Nom de l'onglet Excel (31 caractères au plus). */
  sheet: string;
  description: string;
  /** Colonne de date de modification : filtre `updatedSince` des extractions incrémentales. */
  changedAt: "updatedAt" | "createdAt";
  columns: ExportColumn[];
};

const id: ExportColumn = { key: "id", label: "Identifiant", type: "text" };
const createdAt: ExportColumn = { key: "createdAt", label: "Créé le", type: "date" };
const updatedAt: ExportColumn = { key: "updatedAt", label: "Modifié le", type: "date" };

export const EXPORT_DEFINITIONS: Record<ExportDataset, ExportDefinition> = {
  equipment: {
    label: "Équipements",
    sheet: "Équipements",
    description: "Parc d'engins, véhicules et équipements : identification, rattachement, acquisition, statut.",
    changedAt: "updatedAt",
    columns: [
      id,
      { key: "code", label: "Code parc", type: "text" },
      { key: "name", label: "Désignation", type: "text" },
      { key: "companyCode", label: "Société", type: "text" },
      { key: "siteCode", label: "Site", type: "text" },
      { key: "categoryCode", label: "Catégorie", type: "text" },
      { key: "manufacturer", label: "Marque", type: "text" },
      { key: "modelName", label: "Modèle", type: "text" },
      { key: "serialNumber", label: "Numéro de série", type: "text" },
      { key: "registration", label: "Immatriculation", type: "text" },
      { key: "year", label: "Année", type: "number" },
      { key: "status", label: "Statut", type: "text", labels: EQUIPMENT_STATUS },
      { key: "criticality", label: "Criticité", type: "text", labels: CRITICALITY },
      { key: "acquisitionMode", label: "Mode d'acquisition", type: "text", labels: ACQUISITION_MODE },
      { key: "acquisitionDate", label: "Date d'acquisition", type: "date" },
      { key: "acquisitionValue", label: "Valeur d'acquisition", type: "number" },
      { key: "commissioningDate", label: "Mise en service", type: "date" },
      { key: "warrantyEndDate", label: "Fin de garantie", type: "date" },
      { key: "retiredAt", label: "Réformé le", type: "date" },
      createdAt,
      updatedAt,
    ],
  },
  "work-orders": {
    label: "Interventions à réaliser",
    sheet: "Interventions à réaliser",
    description: "Interventions préventives, correctives et réglementaires : planification, réalisation, coûts externes.",
    changedAt: "updatedAt",
    columns: [
      id,
      { key: "number", label: "Numéro", type: "text" },
      { key: "companyCode", label: "Société", type: "text" },
      { key: "siteCode", label: "Site", type: "text" },
      { key: "equipmentCode", label: "Équipement", type: "text" },
      { key: "type", label: "Type", type: "text", labels: WORK_ORDER_TYPE },
      { key: "status", label: "Statut", type: "text", labels: WORK_ORDER_STATUS },
      { key: "priority", label: "Priorité", type: "text", labels: PRIORITY },
      { key: "title", label: "Intitulé", type: "text" },
      { key: "description", label: "Description", type: "text" },
      { key: "isImmobilizing", label: "Immobilisant", type: "boolean" },
      { key: "isExternal", label: "Sous-traité", type: "boolean" },
      { key: "supplierName", label: "Prestataire", type: "text" },
      { key: "externalCost", label: "Coût externe", type: "number" },
      { key: "plannedStart", label: "Début prévu", type: "date" },
      { key: "plannedEnd", label: "Fin prévue", type: "date" },
      { key: "estimatedMinutes", label: "Durée estimée (min)", type: "number" },
      { key: "startedAt", label: "Démarré le", type: "date" },
      { key: "workDoneAt", label: "Travaux terminés le", type: "date" },
      { key: "techClosedAt", label: "Clôture technique le", type: "date" },
      { key: "closedAt", label: "Clôturé le", type: "date" },
      { key: "cancelledAt", label: "Annulé le", type: "date" },
      { key: "outcome", label: "Résultat", type: "text", labels: WORK_ORDER_OUTCOME },
      { key: "workSummary", label: "Compte rendu", type: "text" },
      createdAt,
      updatedAt,
    ],
  },
  "work-requests": {
    label: "Demandes d'intervention",
    sheet: "Demandes",
    description: "Signalements de pannes et anomalies, leur qualification et l'intervention créée.",
    changedAt: "updatedAt",
    columns: [
      id,
      { key: "number", label: "Numéro", type: "text" },
      { key: "companyCode", label: "Société", type: "text" },
      { key: "siteCode", label: "Site", type: "text" },
      { key: "equipmentCode", label: "Équipement", type: "text" },
      { key: "reportedAt", label: "Signalée le", type: "date" },
      { key: "symptom", label: "Symptôme", type: "text" },
      { key: "description", label: "Description", type: "text" },
      { key: "isStopped", label: "Engin à l'arrêt", type: "boolean" },
      { key: "isSafetyRisk", label: "Risque pour la sécurité", type: "boolean" },
      { key: "status", label: "Statut", type: "text", labels: REQUEST_STATUS },
      { key: "priority", label: "Priorité", type: "text", labels: PRIORITY },
      { key: "type", label: "Type", type: "text", labels: REQUEST_TYPE },
      { key: "workOrderNumber", label: "Intervention à réaliser", type: "text" },
      { key: "qualifiedAt", label: "Qualifiée le", type: "date" },
      createdAt,
      updatedAt,
    ],
  },
  "meter-readings": {
    label: "Relevés de compteurs",
    sheet: "Relevés",
    description: "Heures moteur, kilométrages et cycles relevés, avec leur statut de validation.",
    changedAt: "createdAt",
    columns: [
      id,
      { key: "equipmentCode", label: "Équipement", type: "text" },
      { key: "meterType", label: "Compteur", type: "text", labels: METER_TYPE },
      { key: "unit", label: "Unité", type: "text" },
      { key: "readAt", label: "Relevé le", type: "date" },
      { key: "value", label: "Valeur lue", type: "number" },
      { key: "cumulativeValue", label: "Valeur cumulée", type: "number" },
      { key: "source", label: "Origine", type: "text", labels: READING_SOURCE },
      { key: "status", label: "Statut", type: "text", labels: READING_STATUS },
      { key: "comment", label: "Commentaire", type: "text" },
      createdAt,
    ],
  },
  suppliers: {
    label: "Fournisseurs et prestataires",
    sheet: "Fournisseurs",
    description: "Fournisseurs de pièces et prestataires de maintenance.",
    changedAt: "updatedAt",
    columns: [
      id,
      { key: "name", label: "Raison sociale", type: "text" },
      { key: "taxId", label: "Identifiant fiscal", type: "text" },
      { key: "email", label: "Courriel", type: "text" },
      { key: "phone", label: "Téléphone", type: "text" },
      { key: "address", label: "Adresse", type: "text" },
      { key: "isContractor", label: "Prestataire", type: "boolean" },
      { key: "active", label: "Actif", type: "boolean" },
      createdAt,
      updatedAt,
    ],
  },
  technicians: {
    label: "Ouvriers et techniciens",
    sheet: "Ouvriers",
    description: "Ressources de maintenance : matricule, site, qualification, horaire et taux horaire en vigueur.",
    changedAt: "updatedAt",
    columns: [
      id,
      { key: "employeeNumber", label: "Matricule", type: "text" },
      { key: "lastName", label: "Nom", type: "text" },
      { key: "firstName", label: "Prénom", type: "text" },
      { key: "siteCode", label: "Site", type: "text" },
      { key: "qualification", label: "Qualification", type: "text" },
      { key: "dailyHours", label: "Heures par jour", type: "number" },
      { key: "hourlyRate", label: "Taux horaire", type: "number" },
      { key: "active", label: "Actif", type: "boolean" },
      createdAt,
      updatedAt,
    ],
  },
  parts: {
    label: "Articles (pièces détachées)",
    sheet: "Articles",
    description: "Catalogue des pièces : références, suivi, criticité, coût moyen.",
    changedAt: "updatedAt",
    columns: [
      id,
      { key: "sku", label: "Référence interne", type: "text" },
      { key: "name", label: "Désignation", type: "text" },
      { key: "family", label: "Famille", type: "text" },
      { key: "unit", label: "Unité", type: "text" },
      { key: "manufacturer", label: "Marque", type: "text" },
      { key: "manufacturerRef", label: "Référence fabricant", type: "text" },
      { key: "tracking", label: "Suivi", type: "text", labels: PART_TRACKING },
      { key: "isRepairable", label: "Réparable", type: "boolean" },
      { key: "criticality", label: "Criticité", type: "text", labels: CRITICALITY },
      { key: "averageCost", label: "Coût moyen", type: "number" },
      { key: "active", label: "Actif", type: "boolean" },
      createdAt,
      updatedAt,
    ],
  },
  "stock-levels": {
    label: "Niveaux de stock",
    sheet: "Stocks",
    description: "Quantités en stock par article et par magasin, avec les seuils de réapprovisionnement.",
    changedAt: "updatedAt",
    columns: [
      id,
      { key: "sku", label: "Référence interne", type: "text" },
      { key: "partName", label: "Désignation", type: "text" },
      { key: "warehouseCode", label: "Magasin", type: "text" },
      { key: "onHand", label: "Stock physique", type: "number" },
      { key: "reserved", label: "Réservé", type: "number" },
      { key: "minQty", label: "Stock minimum", type: "number" },
      { key: "reorderPoint", label: "Point de commande", type: "number" },
      { key: "maxQty", label: "Stock maximum", type: "number" },
      updatedAt,
    ],
  },
  "stock-movements": {
    label: "Mouvements de stock",
    sheet: "Mouvements",
    description: "Entrées, sorties, transferts et ajustements, avec l'intervention concernée.",
    changedAt: "createdAt",
    columns: [
      id,
      createdAt,
      { key: "type", label: "Type", type: "text", labels: MOVEMENT_TYPE },
      { key: "sku", label: "Référence interne", type: "text" },
      { key: "warehouseCode", label: "Magasin", type: "text" },
      { key: "quantity", label: "Quantité", type: "number" },
      { key: "unitCost", label: "Coût unitaire", type: "number" },
      { key: "workOrderNumber", label: "Intervention à réaliser", type: "text" },
      { key: "reference", label: "Référence", type: "text" },
      { key: "reason", label: "Motif", type: "text" },
    ],
  },
};

/** Nombre maximal de lignes par page (JSON) ; les fichiers CSV et Excel sont complets. */
export const MAX_PAGE_SIZE = 5000;

/** Libellé d'un code pour le classeur Excel ; le code lui-même s'il n'a pas de libellé. */
export function labelOf(column: ExportColumn, value: unknown) {
  if (!column.labels || value === null || value === undefined) return value;
  const entry = column.labels[String(value)];
  if (entry === undefined) return value;
  return typeof entry === "string" ? entry : entry.label;
}

/** Valeur d'une cellule CSV (RFC 4180) : dates ISO 8601 (UTC), booléens true / false, guillemets si nécessaire. */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text: string;
  if (value instanceof Date) text = value.toISOString();
  else if (typeof value === "boolean") text = value ? "true" : "false";
  else text = String(value);
  // Protection contre l'injection de formule à l'ouverture dans un tableur.
  if (/^[=+\-@\t\r]/.test(text) && typeof value === "string") text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Fichier CSV : séparateur virgule, fins de ligne CRLF, en-têtes = clés des colonnes (stables pour un ETL), BOM UTF-8. */
export function toCsv(columns: ExportColumn[], rows: Record<string, unknown>[]): string {
  const lines = [columns.map((c) => c.key).join(","), ...rows.map((row) => columns.map((c) => csvCell(row[c.key])).join(","))];
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** Nom de fichier d'export : jeu de données et date (AAAA-MM-JJ). */
export function exportFileName(dataset: string, format: ExportFormat, now: Date) {
  return `gmao-${dataset}-${now.toISOString().slice(0, 10)}.${format}`;
}

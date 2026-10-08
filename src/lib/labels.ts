/**
 * Libellés français des énumérations du domaine (le code utilise des identifiants anglais).
 * Glossaire complet : docs/architecture.md.
 */

export type Tone = "gray" | "green" | "blue" | "amber" | "red" | "violet" | "teal";

export const EQUIPMENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  AVAILABLE: { label: "Disponible", tone: "green" },
  IN_SERVICE: { label: "En service", tone: "blue" },
  IN_MAINTENANCE: { label: "En maintenance", tone: "amber" },
  IMMOBILIZED: { label: "Immobilisé", tone: "red" },
  RETIRED: { label: "Réformé", tone: "gray" },
};

export const CRITICALITY: Record<string, { label: string; tone: Tone }> = {
  A: { label: "Criticité A", tone: "red" },
  B: { label: "Criticité B", tone: "amber" },
  C: { label: "Criticité C", tone: "gray" },
};

export const ACQUISITION_MODE: Record<string, string> = {
  PURCHASE: "Achat",
  LEASE: "Crédit-bail",
  LONG_TERM_RENTAL: "Location longue durée",
  SHORT_TERM_RENTAL: "Location courte durée",
};

/** Types de documents joints (EQP-07). */
export const DOCUMENT_KIND: Record<string, { label: string; tone: Tone }> = {
  MANUAL: { label: "Notice", tone: "blue" },
  CERTIFICATE: { label: "Certificat", tone: "green" },
  INVOICE: { label: "Facture", tone: "violet" },
  PHOTO: { label: "Photo", tone: "teal" },
  REPORT: { label: "Rapport", tone: "amber" },
  OTHER: { label: "Autre", tone: "gray" },
};

export const METER_TYPE: Record<string, string> = {
  HOURS: "Heures moteur",
  KM: "Kilométrage",
  CYCLES: "Cycles",
  OTHER: "Autre",
};

export const READING_STATUS: Record<string, { label: string; tone: Tone }> = {
  VALID: { label: "Valide", tone: "green" },
  TO_CHECK: { label: "À vérifier", tone: "amber" },
  REJECTED: { label: "Rejeté", tone: "red" },
};

export const READING_SOURCE: Record<string, string> = {
  MANUAL: "Saisie",
  WORK_ORDER: "OT",
  TELEMATICS: "Télématique",
  IMPORT: "Import",
};

export const REQUEST_STATUS: Record<string, { label: string; tone: Tone }> = {
  NEW: { label: "Nouvelle", tone: "blue" },
  QUALIFIED: { label: "Qualifiée", tone: "violet" },
  CONVERTED: { label: "Transformée en OT", tone: "green" },
  REJECTED: { label: "Rejetée", tone: "gray" },
  MERGED: { label: "Rattachée", tone: "gray" },
};

export const REQUEST_TYPE: Record<string, string> = {
  BREAKDOWN: "Panne",
  DAMAGE: "Dégât ou accident",
  SAFETY: "Défaut de sécurité",
  IMPROVEMENT: "Amélioration",
  OTHER: "Autre",
};

export const PRIORITY: Record<string, { label: string; tone: Tone; short: string }> = {
  P1: { label: "P1 Urgence", short: "P1", tone: "red" },
  P2: { label: "P2 Haute", short: "P2", tone: "amber" },
  P3: { label: "P3 Normale", short: "P3", tone: "blue" },
  P4: { label: "P4 Planifiable", short: "P4", tone: "gray" },
};

export const WORK_ORDER_TYPE: Record<string, string> = {
  PREVENTIVE: "Préventif",
  CORRECTIVE: "Correctif",
  REGULATORY: "Réglementaire",
  IMPROVEMENT: "Amélioration",
  ACCIDENT: "Accident / sinistre",
};

export const WORK_ORDER_STATUS: Record<string, { label: string; tone: Tone }> = {
  CREATED: { label: "Créé", tone: "gray" },
  PLANNED: { label: "Planifié", tone: "blue" },
  ON_HOLD: { label: "En attente", tone: "amber" },
  IN_PROGRESS: { label: "En cours", tone: "violet" },
  WORK_DONE: { label: "Travaux terminés", tone: "teal" },
  TECH_CLOSED: { label: "Clôturé technique", tone: "green" },
  CLOSED: { label: "Clôturé", tone: "green" },
  CANCELLED: { label: "Annulé", tone: "gray" },
};

/** Libellé du bouton qui mène vers un statut. */
export const TRANSITION_ACTION: Record<string, string> = {
  PLANNED: "Planifier",
  ON_HOLD: "Mettre en attente",
  IN_PROGRESS: "Démarrer / reprendre",
  WORK_DONE: "Terminer les travaux",
  TECH_CLOSED: "Valider la remise en service",
  CLOSED: "Clôturer (administratif)",
  CANCELLED: "Annuler l'OT",
};

export const HOLD_REASON: Record<string, string> = {
  PARTS: "Pièces",
  CONTRACTOR: "Prestataire",
  ACCESS: "Accès à l'équipement",
  QUOTE: "Validation de devis",
  OTHER: "Autre",
};

export const WORK_ORDER_OUTCOME: Record<string, string> = {
  RESOLVED: "Résolu",
  DIAGNOSTIC_ONLY: "Diagnostic seul",
  NO_FOLLOW_UP: "Sans suite",
};

export const DUE_STATUS: Record<string, { label: string; tone: Tone }> = {
  UPCOMING: { label: "À venir", tone: "gray" },
  PRE_ALERT: { label: "Pré-alerte", tone: "blue" },
  DUE: { label: "Échue", tone: "amber" },
  OVERDUE: { label: "En retard", tone: "red" },
  DONE: { label: "Réalisée", tone: "green" },
  SUPERSEDED: { label: "Soldée par palier", tone: "gray" },
  SKIPPED: { label: "Annulée", tone: "gray" },
};

export const OPERATION_MODE: Record<string, string> = {
  FIXED: "Fixe",
  SLIDING: "Glissant",
};

export const CALENDAR_UNIT: Record<string, { one: string; many: string }> = {
  DAY: { one: "jour", many: "jours" },
  WEEK: { one: "semaine", many: "semaines" },
  MONTH: { one: "mois", many: "mois" },
  YEAR: { one: "an", many: "ans" },
};

export const METER_UNIT_SHORT: Record<string, string> = { HOURS: "h", KM: "km", CYCLES: "cycles", OTHER: "u" };

export const MOVEMENT_TYPE: Record<string, { label: string; sign: 1 | -1 | 0 }> = {
  RECEIPT: { label: "Réception", sign: 1 },
  ISSUE: { label: "Sortie sur OT", sign: -1 },
  RETURN: { label: "Retour en stock", sign: 1 },
  TRANSFER_OUT: { label: "Transfert sortant", sign: -1 },
  TRANSFER_IN: { label: "Transfert entrant", sign: 1 },
  ADJUSTMENT: { label: "Ajustement d'inventaire", sign: 0 },
  SCRAP: { label: "Mise au rebut", sign: -1 },
};

export const ROLE: Record<string, string> = {
  ADMIN: "Administrateur",
  MAINTENANCE_MANAGER: "Responsable maintenance",
  FLEET_MANAGER: "Gestionnaire de flotte",
  WORKSHOP_MANAGER: "Chef d'atelier",
  TECHNICIAN: "Technicien",
  OPERATOR: "Conducteur / opérateur",
  STOREKEEPER: "Magasinier",
  PURCHASING_MANAGER: "Responsable achats",
  EXECUTIVE: "Direction",
  CONTRACTOR: "Prestataire externe",
};

export const SCOPE_TYPE: Record<string, string> = {
  TENANT: "Tout le groupe",
  COMPANY: "Société",
  SITE: "Site",
};

export const AUDIT_CHANNEL: Record<string, string> = {
  WEB: "Web",
  API: "API",
  MOBILE: "Mobile",
  IMPORT: "Import",
  SYSTEM: "Système",
};

export const ABSENCE_TYPE: Record<string, string> = {
  LEAVE: "Congé",
  TRAINING: "Formation",
  SICK: "Absence",
  OTHER: "Autre",
};

export const TASK_RESULT: Record<string, { label: string; tone: Tone }> = {
  OK: { label: "Conforme", tone: "green" },
  NOK: { label: "Non conforme", tone: "red" },
  NA: { label: "Sans objet", tone: "gray" },
};

export const DOWNTIME_REASON: Record<string, string> = {
  BREAKDOWN: "Panne",
  SAFETY: "Sécurité",
  REGULATORY: "Contrôle réglementaire échu",
  PLANNED_MAINTENANCE: "Maintenance programmée",
};

export const PART_TRACKING: Record<string, string> = {
  QUANTITY: "Quantité",
  LOT: "Lot",
  SERIAL: "Numéro de série",
};

export const RESERVATION_STATUS: Record<string, { label: string; tone: Tone }> = {
  ACTIVE: { label: "Réservée", tone: "blue" },
  CONSUMED: { label: "Consommée", tone: "green" },
  RELEASED: { label: "Libérée", tone: "gray" },
};

export const TASK_KIND: Record<string, string> = {
  CHECK: "Contrôle",
  MEASURE: "Mesure",
  TEXT: "Observation",
};

/** Mouvements saisissables à la main (les sorties et retours se font depuis l'OT). */
export const MANUAL_MOVEMENT: Record<string, string> = {
  RECEIPT: "Réception",
  TRANSFER: "Transfert entre magasins",
  ADJUSTMENT: "Ajustement d'inventaire (écart signé)",
  SCRAP: "Mise au rebut",
};

/** Types d'objets du journal d'audit. */
export const ENTITY_TYPE: Record<string, string> = {
  equipment: "Équipement",
  equipment_category: "Catégorie",
  equipment_model: "Modèle",
  document: "Document",
  meter: "Compteur",
  meter_reading: "Relevé",
  maintenance_plan: "Plan d'entretien",
  due_item: "Échéance",
  work_request: "DI",
  work_order: "OT",
  time_entry: "Pointage",
  part: "Article",
  stock_level: "Niveau de stock",
  stock_movement: "Mouvement de stock",
  stock_reservation: "Réservation",
  supplier: "Fournisseur",
  user: "Utilisateur",
  technician: "Technicien",
  company: "Société",
  site: "Site",
  workshop: "Atelier",
  warehouse: "Magasin",
  jobsite: "Chantier",
};

export function options(map: Record<string, string | { label: string }>) {
  return Object.entries(map).map(([value, v]) => ({ value, label: typeof v === "string" ? v : v.label }));
}

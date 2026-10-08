/** Libellés français des énumérations de l'API (l'API utilise des identifiants anglais). */

export type Tone = "gray" | "green" | "blue" | "amber" | "red";

export const WORK_ORDER_STATUS: Record<string, { label: string; tone: Tone }> = {
  CREATED: { label: "Créé", tone: "gray" },
  PLANNED: { label: "Planifié", tone: "blue" },
  ON_HOLD: { label: "En attente", tone: "amber" },
  IN_PROGRESS: { label: "En cours", tone: "blue" },
  WORK_DONE: { label: "Travaux terminés", tone: "green" },
  TECH_CLOSED: { label: "Clôturé techniquement", tone: "green" },
  CLOSED: { label: "Clôturé", tone: "gray" },
  CANCELLED: { label: "Annulé", tone: "gray" },
};

export const EQUIPMENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  AVAILABLE: { label: "Disponible", tone: "green" },
  IN_SERVICE: { label: "En service", tone: "blue" },
  IN_MAINTENANCE: { label: "En maintenance", tone: "amber" },
  IMMOBILIZED: { label: "Immobilisé", tone: "red" },
  RETIRED: { label: "Réformé", tone: "gray" },
};

export const DUE_STATUS: Record<string, { label: string; tone: Tone }> = {
  UPCOMING: { label: "À venir", tone: "gray" },
  PRE_ALERT: { label: "Pré-alerte", tone: "amber" },
  DUE: { label: "Échue", tone: "red" },
  OVERDUE: { label: "En retard", tone: "red" },
};

export const PRIORITY_TONE: Record<string, Tone> = { P1: "red", P2: "amber", P3: "blue", P4: "gray" };

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" });
}

export function formatNumber(value: number | null | undefined) {
  return value == null ? "—" : value.toLocaleString("fr-FR");
}

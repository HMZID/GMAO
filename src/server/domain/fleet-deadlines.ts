/**
 * Échéances administratives du parc : assurance, visite technique, vignette (taxe de circulation) et autres
 * obligations datées d'un véhicule ou d'un engin. Alertes au responsable du parc à J−30, J−7 et le jour même,
 * puis rappel chaque semaine tant que l'échéance n'est pas renouvelée. Module pur, testé dans
 * `__tests__/fleet-deadlines.test.ts`.
 */

export const DEADLINE_KINDS = ["INSURANCE", "TECHNICAL_INSPECTION", "VIGNETTE", "OTHER"] as const;
export type DeadlineKind = (typeof DEADLINE_KINDS)[number];

export const DEADLINE_KIND_LABEL: Record<DeadlineKind, string> = {
  INSURANCE: "Assurance",
  TECHNICAL_INSPECTION: "Visite technique",
  VIGNETTE: "Vignette",
  OTHER: "Autre échéance",
};

/** Jour calendaire (fuseau d'exploitation) : nombre de jours depuis l'origine, pour compter des jours entiers. */
function calendarDay(date: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return Math.round(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)) / 86_400_000);
}

/** Jours avant l'échéance (négatif : en retard), en jours calendaires. */
export function daysUntil(dueDate: Date, now: Date, timeZone = "Europe/Paris") {
  return calendarDay(dueDate, timeZone) - calendarDay(now, timeZone);
}

/**
 * Étape d'alerte : J30 (dans les 30 jours), J7 (dans les 7 jours), J0 (le jour même), puis OVERDUE-n
 * (une par semaine de retard, n = 0, 1, 2…). Null au-delà de 30 jours. Chaque étape ne part qu'une fois.
 */
export function deadlineAlertStage(dueDate: Date, now: Date, timeZone = "Europe/Paris"): string | null {
  const days = daysUntil(dueDate, now, timeZone);
  if (days > 30) return null;
  if (days > 7) return "J30";
  if (days > 0) return "J7";
  if (days === 0) return "J0";
  return `OVERDUE-${Math.floor((-days - 1) / 7)}`;
}

/** État affiché : en retard, à renouveler (30 jours), à jour. */
export function deadlineState(dueDate: Date, now: Date, timeZone = "Europe/Paris"): "OVERDUE" | "SOON" | "OK" {
  const days = daysUntil(dueDate, now, timeZone);
  if (days < 0) return "OVERDUE";
  return days <= 30 ? "SOON" : "OK";
}

/** Phrase de l'alerte (notification et courriel). */
export function deadlineAlertText(input: { kind: DeadlineKind; label: string | null; equipmentCode: string; days: number }) {
  const what = input.label?.trim() || DEADLINE_KIND_LABEL[input.kind];
  if (input.days < 0) return `${what} de ${input.equipmentCode} échue depuis ${-input.days} jour(s) : à renouveler sans attendre.`;
  if (input.days === 0) return `${what} de ${input.equipmentCode} arrive à échéance aujourd'hui.`;
  return `${what} de ${input.equipmentCode} à renouveler dans ${input.days} jour(s).`;
}

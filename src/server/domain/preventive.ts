/**
 * Calcul des échéances préventives (CDC §4, PRV-02 à PRV-10).
 * Module pur, testé avec l'exemple de la chargeuse du CDC (§4.4).
 *
 * Conventions :
 * - les dates sont manipulées en UTC, à la granularité du jour pour les statuts ;
 * - les valeurs de compteur sont des valeurs CUMULÉES (DON-04) ;
 * - plusieurs déclencheurs = premier seuil atteint (PRV-03).
 */

import type { MeterType } from "./meters";

export type CalendarUnit = "DAY" | "WEEK" | "MONTH" | "YEAR";
export type OperationMode = "FIXED" | "SLIDING";
export type DueStatus = "UPCOMING" | "PRE_ALERT" | "DUE" | "OVERDUE";

export type Trigger = { kind: "CALENDAR"; every: number; unit: CalendarUnit } | { kind: "METER"; every: number; meterType: MeterType };

export type OperationRule = {
  mode: OperationMode;
  triggers: Trigger[];
  preAlertDays?: number | null;
  preAlertMeter?: number | null;
  /** Tolérance de retard en % de l'intervalle (10 % par défaut) [AC]. */
  tolerancePercent?: number | null;
};

/** Point de départ du calcul : dernière réalisation (glissant) ou échéance théorique précédente (fixe). */
export type Baseline = { date: Date; meter?: number | null };

export type Due = { dueDate: Date | null; dueMeter: number | null };

const DAY_MS = 86_400_000;

/** Ajoute un intervalle calendaire en UTC ; les mois sont calendaires avec bornage en fin de mois (31/01 + 1 mois = 28/02). */
export function addCalendar(date: Date, every: number, unit: CalendarUnit): Date {
  const n = Math.round(every);
  switch (unit) {
    case "DAY":
      return new Date(date.getTime() + n * DAY_MS);
    case "WEEK":
      return new Date(date.getTime() + n * 7 * DAY_MS);
    case "MONTH":
      return addMonthsUtc(date, n);
    case "YEAR":
      return addMonthsUtc(date, n * 12);
  }
}

function addMonthsUtc(date: Date, months: number): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + months;
  const targetYear = y + Math.floor(m / 12);
  const targetMonth = ((m % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const day = Math.min(date.getUTCDate(), lastDay);
  return new Date(Date.UTC(targetYear, targetMonth, day, date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(), date.getUTCMilliseconds()));
}

/** Calcule l'échéance à partir d'une base (date et compteur). */
export function computeDue(rule: OperationRule, base: Baseline): Due {
  const dates: Date[] = [];
  const meterValues: number[] = [];
  for (const trigger of rule.triggers) {
    if (trigger.kind === "CALENDAR") {
      dates.push(addCalendar(base.date, trigger.every, trigger.unit));
    } else if (base.meter !== null && base.meter !== undefined) {
      meterValues.push(round1(base.meter + trigger.every));
    }
  }
  return {
    dueDate: dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))) : null,
    dueMeter: meterValues.length ? Math.min(...meterValues) : null,
  };
}

/** Index du jour UTC (pour comparer à la journée près). */
export function dayIndex(date: Date) {
  return Math.floor(date.getTime() / DAY_MS);
}

/** Tolérances calculées à partir de l'intervalle de chaque déclencheur (CDC §4.4 : 10 % → 25 h ou 9 jours). */
export function tolerances(rule: OperationRule, base: Baseline, due: Due) {
  const pct = (rule.tolerancePercent ?? 10) / 100;
  const days = due.dueDate ? Math.round((dayIndex(due.dueDate) - dayIndex(base.date)) * pct) : null;
  const meterTrigger = rule.triggers.find((t) => t.kind === "METER");
  const meter = meterTrigger ? round1(meterTrigger.every * pct) : null;
  return { days, meter };
}

export type EvaluateInput = {
  rule: OperationRule;
  base: Baseline;
  due: Due;
  now: Date;
  /** Dernière valeur cumulée connue du compteur concerné. */
  currentMeter?: number | null;
};

/**
 * Statut d'une échéance (PRV-06, PRV-09) :
 * EN RETARD au-delà de la tolérance, ÉCHUE dès qu'un seuil est atteint, PRÉ-ALERTE dans la fenêtre d'anticipation.
 */
export function evaluateDue({ rule, base, due, now, currentMeter }: EvaluateInput): DueStatus {
  const tol = tolerances(rule, base, due);
  const today = dayIndex(now);
  const dueDay = due.dueDate ? dayIndex(due.dueDate) : null;
  const meter = currentMeter ?? null;

  const overdueByDate = dueDay !== null && tol.days !== null && today > dueDay + tol.days;
  const overdueByMeter = due.dueMeter !== null && meter !== null && tol.meter !== null && meter > due.dueMeter + tol.meter;
  if (overdueByDate || overdueByMeter) return "OVERDUE";

  const dueByDate = dueDay !== null && today >= dueDay;
  const dueByMeter = due.dueMeter !== null && meter !== null && meter >= due.dueMeter;
  if (dueByDate || dueByMeter) return "DUE";

  const preByDate = dueDay !== null && rule.preAlertDays != null && today >= dueDay - rule.preAlertDays;
  const preByMeter = due.dueMeter !== null && meter !== null && rule.preAlertMeter != null && meter >= due.dueMeter - rule.preAlertMeter;
  if (preByDate || preByMeter) return "PRE_ALERT";

  return "UPCOMING";
}

/**
 * Date projetée d'atteinte du seuil compteur (PRV-07) :
 * date du dernier relevé + (seuil − dernier relevé) ÷ utilisation moyenne journalière.
 */
export function projectMeterDate(input: {
  dueMeter: number | null;
  lastMeter: number | null;
  lastReadAt: Date | null;
  dailyUsage: number | null;
}): Date | null {
  const { dueMeter, lastMeter, lastReadAt, dailyUsage } = input;
  if (dueMeter === null || lastMeter === null || !lastReadAt || !dailyUsage || dailyUsage <= 0) return null;
  const remaining = dueMeter - lastMeter;
  if (remaining <= 0) return lastReadAt;
  return new Date(lastReadAt.getTime() + Math.round(remaining / dailyUsage) * DAY_MS);
}

/** Date la plus proche entre l'échéance calendaire et la projection compteur. */
export function earliestDate(...dates: (Date | null | undefined)[]): Date | null {
  const valid = dates.filter((d): d is Date => !!d);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => (a < b ? a : b));
}

/** Créneau proposé pour un OT généré : le jour projeté à 06:00 UTC, reporté au lundi s'il tombe un week-end. */
export function suggestedStart(date: Date | null): Date | null {
  if (!date) return null;
  const weekday = date.getUTCDay();
  const shift = weekday === 6 ? 2 : weekday === 0 ? 1 : 0;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + shift, 6));
}

/** Horizon de génération des OT préventifs, en jours (CDC §4.5) [AC]. */
export const GENERATION_HORIZON_DAYS = 14;

/** Faut-il générer l'OT ? À la pré-alerte, ou si l'échéance projetée tombe dans l'horizon (PRV-08). */
export function shouldGenerateWorkOrder(status: DueStatus, plannedDate: Date | null, now: Date) {
  if (status !== "UPCOMING") return true;
  return !!plannedDate && dayIndex(plannedDate) - dayIndex(now) <= GENERATION_HORIZON_DAYS;
}

/**
 * Base du prochain calcul après réalisation (PRV-04) :
 * - glissant : date et compteur réels de réalisation ;
 * - fixe : échéance théorique précédente (la grille ne se décale pas, même en cas de report).
 */
export function nextBaseline(rule: OperationRule, due: Due, completion: { date: Date; meter?: number | null }): Baseline {
  if (rule.mode === "SLIDING") return { date: completion.date, meter: completion.meter ?? null };
  return {
    date: due.dueDate ?? completion.date,
    meter: due.dueMeter ?? completion.meter ?? null,
  };
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

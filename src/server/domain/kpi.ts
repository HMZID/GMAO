/**
 * Formules des indicateurs (CDC §9.2). Conventions :
 * - une défaillance est un OT correctif de type panne ayant entraîné une immobilisation ;
 * - moins de MIN_FAILURES défaillances sur la période → « non significatif » (null) [AC] ;
 * - une immobilisation à cheval sur deux périodes est répartie au prorata (clipInterval).
 */

export const MIN_FAILURES = 3;

export type Interval = { start: Date; end: Date | null };

/** Durée en heures d'un intervalle tronqué à la période [from, to]. */
export function clippedHours(interval: Interval, from: Date, to: Date) {
  const start = Math.max(interval.start.getTime(), from.getTime());
  const end = Math.min((interval.end ?? to).getTime(), to.getTime());
  return Math.max(end - start, 0) / 3_600_000;
}

/** Disponibilité technique D = (T requis − T immo) ÷ T requis (KPI-03). */
export function availability(requiredHours: number, downtimeHours: number) {
  if (requiredHours <= 0) return null;
  return clamp01((requiredHours - Math.min(downtimeHours, requiredHours)) / requiredHours);
}

/** MTBF = temps de fonctionnement ÷ nombre de défaillances (KPI-04). */
export function mtbf(operatingHours: number, failures: number, minFailures = MIN_FAILURES) {
  if (failures < minFailures || failures === 0) return null;
  return operatingHours / failures;
}

export type RepairWindow = {
  /** Premier passage « En cours ». */
  startedAt: Date;
  /** Passage « Travaux terminés ». */
  workDoneAt: Date;
  /** Durée cumulée des attentes intermédiaires, en heures. */
  waitingHours?: number;
};

/** MTTR = Σ (fin travaux − début travaux − attentes) ÷ nombre de réparations (KPI-04). */
export function mttr(repairs: RepairWindow[], minRepairs = MIN_FAILURES) {
  if (repairs.length < minRepairs || repairs.length === 0) return null;
  const total = repairs.reduce((sum, r) => {
    const hours = (r.workDoneAt.getTime() - r.startedAt.getTime()) / 3_600_000 - (r.waitingHours ?? 0);
    return sum + Math.max(hours, 0);
  }, 0);
  return total / repairs.length;
}

/** MDT = Σ (remise en service − immobilisation) ÷ nombre de pannes, attentes comprises. */
export function mdt(downtimes: Interval[], now: Date, minFailures = MIN_FAILURES) {
  if (downtimes.length < minFailures || downtimes.length === 0) return null;
  const total = downtimes.reduce((sum, d) => sum + ((d.end ?? now).getTime() - d.start.getTime()) / 3_600_000, 0);
  return total / downtimes.length;
}

/** Coût par heure de fonctionnement (ou par km) : C maint ÷ ΔH (KPI). */
export function costPerUnit(cost: number, usageDelta: number) {
  if (usageDelta <= 0) return null;
  return cost / usageDelta;
}

/** Respect du planning préventif : échéances réalisées dans la tolérance ÷ échéances arrivées à terme. */
export function preventiveCompliance(doneOnTime: number, dueInPeriod: number) {
  if (dueInPeriod <= 0) return null;
  return clamp01(doneOnTime / dueInPeriod);
}

/** Ratio d'aide à la décision réparer ou remplacer (CDC §9.4). */
export function repairOrReplaceRatio(repairCost: number, maintenanceCost12Months: number, marketValue: number) {
  if (marketValue <= 0) return null;
  return (repairCost + maintenanceCost12Months) / marketValue;
}

function clamp01(n: number) {
  return Math.min(Math.max(n, 0), 1);
}

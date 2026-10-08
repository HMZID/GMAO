/**
 * Règles des compteurs (CDC §13.2 : DON-01 à DON-05).
 * La valeur lue (affichée par le compteur physique) diffère de la valeur cumulée
 * dès qu'un compteur a été remplacé : cumulée = lue + offset.
 */

export type MeterType = "HOURS" | "KM" | "CYCLES" | "OTHER";
export type ReadingSource = "MANUAL" | "WORK_ORDER" | "TELEMATICS" | "IMPORT";
export type ReadingStatus = "VALID" | "TO_CHECK" | "REJECTED";

export type ReadingPoint = { value: number; readAt: Date };

export type ReadingCheckInput = {
  meterType: MeterType;
  value: number;
  readAt: Date;
  source: ReadingSource;
  /** Dernier relevé valide du segment courant antérieur à readAt. */
  previous?: ReadingPoint | null;
  /** Premier relevé valide du segment courant postérieur à readAt (insertion rétroactive). */
  next?: ReadingPoint | null;
  now?: Date;
};

export type ReadingCheck = { status: ReadingStatus; reasons: string[] };

/** Vitesse maximale plausible pour un véhicule, en km/h [AC]. */
export const MAX_KM_PER_HOUR = 120;
/** Tolérance d'horloge pour les relevés « dans le futur », en minutes. */
const FUTURE_TOLERANCE_MINUTES = 5;

/**
 * Contrôle d'un relevé :
 * - DON-03 : pas de relevé dans le futur ni négatif → rejet ;
 * - DON-01 : relevé ≥ précédent et ≤ suivant → rejet en saisie manuelle, « à vérifier » depuis une interface ;
 * - DON-02 : plausibilité de l'écart par rapport au temps écoulé → « à vérifier ».
 */
export function checkReading(input: ReadingCheckInput): ReadingCheck {
  const now = input.now ?? new Date();
  const reasons: string[] = [];

  if (!Number.isFinite(input.value) || input.value < 0) {
    return { status: "REJECTED", reasons: ["La valeur doit être un nombre positif."] };
  }
  if (input.readAt.getTime() > now.getTime() + FUTURE_TOLERANCE_MINUTES * 60_000) {
    return { status: "REJECTED", reasons: ["Un relevé ne peut pas être daté dans le futur."] };
  }

  const interactive = input.source === "MANUAL" || input.source === "WORK_ORDER";
  let inconsistent = false;

  if (input.previous && input.value < input.previous.value) {
    inconsistent = true;
    reasons.push(`Valeur inférieure au relevé précédent (${input.previous.value}). En cas de changement de compteur, enregistrer un remplacement.`);
  }
  if (input.next && input.value > input.next.value) {
    inconsistent = true;
    reasons.push(`Valeur supérieure au relevé suivant (${input.next.value}) : insertion rétroactive incohérente.`);
  }
  if (inconsistent) {
    return { status: interactive ? "REJECTED" : "TO_CHECK", reasons };
  }

  if (input.previous) {
    const plausibility = checkPlausibility(input.meterType, input.previous, { value: input.value, readAt: input.readAt });
    if (plausibility) return { status: "TO_CHECK", reasons: [plausibility] };
  }

  return { status: "VALID", reasons: [] };
}

/** Renvoie un motif si l'écart n'est pas plausible au regard du temps écoulé (DON-02). */
export function checkPlausibility(meterType: MeterType, from: ReadingPoint, to: ReadingPoint): string | null {
  const elapsedHours = Math.max((to.readAt.getTime() - from.readAt.getTime()) / 3_600_000, 0);
  const delta = to.value - from.value;
  if (delta <= 0) return null;

  if (meterType === "HOURS" && delta > elapsedHours + 0.5) {
    return `Écart de ${fr(delta)} h en ${fr(elapsedHours)} h écoulées : au plus 24 h par jour calendaire.`;
  }
  if (meterType === "KM" && delta > elapsedHours * MAX_KM_PER_HOUR + 1) {
    return `Écart de ${fr(delta)} km en ${fr(elapsedHours)} h : vitesse moyenne supérieure à ${MAX_KM_PER_HOUR} km/h.`;
  }
  return null;
}

/** Valeur cumulée d'un relevé (DON-04). */
export function toCumulative(value: number, offset: number) {
  return round(value + offset, 1);
}

/**
 * Remplacement de compteur (DON-04) : l'offset accumule l'usage de l'ancien compteur.
 * Exemple CDC : horamètre remplacé à 6 850 h, nouveau à 0 h → offset 6 850 ;
 * une lecture de 150 h correspond alors à 7 000 h cumulées.
 */
export function offsetAfterReplacement(currentOffset: number, oldFinalValue: number, newInitialValue: number) {
  if (oldFinalValue < 0 || newInitialValue < 0) throw new Error("Valeurs de remplacement négatives.");
  return round(currentOffset + oldFinalValue - newInitialValue, 1);
}

/**
 * Utilisation moyenne par jour sur une fenêtre glissante (PRV-07), à partir de relevés cumulés triés.
 * Renvoie null s'il n'y a pas assez de données.
 */
export function averageDailyUsage(points: { cumulativeValue: number; readAt: Date }[], now: Date, windowDays = 30) {
  const windowStart = now.getTime() - windowDays * 86_400_000;
  const inWindow = points.filter((p) => p.readAt.getTime() >= windowStart).sort((a, b) => +a.readAt - +b.readAt);
  if (inWindow.length < 2) return null;
  const first = inWindow[0];
  const last = inWindow[inWindow.length - 1];
  const days = (last.readAt.getTime() - first.readAt.getTime()) / 86_400_000;
  if (days < 1) return null;
  return round((last.cumulativeValue - first.cumulativeValue) / days, 2);
}

/** Nombre arrondi au dixième, au format français (messages affichés à l'utilisateur). */
function fr(n: number) {
  return round(n).toLocaleString("fr-FR");
}

function round(n: number, digits = 1) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

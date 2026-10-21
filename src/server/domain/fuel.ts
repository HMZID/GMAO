/**
 * Carburant et fluides : consommation des engins et véhicules, anomalies des pleins (fonction ajoutée hors CDC,
 * prolongement de KPI-01 vers le coût d'exploitation). Module pur, testé dans `__tests__/fuel.test.ts`.
 *
 * Conventions :
 * - consommation « plein à plein » : entre deux pleins complets relevés au compteur, les litres versés après le
 *   premier plein (jusqu'au second inclus) divisés par l'usage (valeurs CUMULÉES du compteur, DON-04) ;
 * - engin au compteur d'heures : litres par heure (L/h) ; véhicule au kilométrage : litres aux 100 km ;
 * - seuls les carburants (gasoil, essence) entrent dans la consommation ; AdBlue, huiles et liquides sont suivis à part.
 */
import { tpl } from "@/i18n/translate";
import type { MeterType } from "./meters";

export const FLUID_KINDS = ["DIESEL", "GASOLINE", "ADBLUE", "ENGINE_OIL", "HYDRAULIC_OIL", "COOLANT", "OTHER"] as const;
export type FluidKind = (typeof FLUID_KINDS)[number];

/** Fluides qui sont des carburants : eux seuls entrent dans le calcul de la consommation. */
export const FUELS: readonly FluidKind[] = ["DIESEL", "GASOLINE"];

export function isFuel(fluid: FluidKind) {
  return FUELS.includes(fluid);
}

/** Écart toléré entre la consommation d'un plein et la référence avant de signaler une anomalie [AC]. */
export const CONSUMPTION_TOLERANCE = 0.25;
/** Marge sur la capacité du réservoir (jauge, mousse, réservoir mal renseigné) [AC]. */
export const TANK_MARGIN = 0.05;
/** Nombre minimal de pleins à plein déjà connus pour déduire une référence de l'historique. */
export const MIN_SEGMENTS_FOR_REFERENCE = 3;
/** Plein rapproché : moins de ce délai après le plein précédent, sans usage, et plus d'un quart du réservoir [AC]. */
export const CLOSE_FILL_HOURS = 4;

/** Unité de consommation selon le compteur principal. */
export function consumptionUnit(meterType: MeterType | null | undefined): "L/h" | "L/100 km" | null {
  if (meterType === "HOURS") return "L/h";
  if (meterType === "KM") return "L/100 km";
  return null;
}

/** Consommation pour des litres et un usage : L/h (heures) ou L/100 km (kilomètres). Usage nul ou inconnu : null. */
export function consumptionRate(litres: number, usage: number, meterType: MeterType | null | undefined): number | null {
  if (!(usage > 0) || !(litres >= 0)) return null;
  if (meterType === "HOURS") return round(litres / usage, 2);
  if (meterType === "KM") return round((litres / usage) * 100, 2);
  return null;
}

export type FillPoint = {
  id: string;
  filledAt: Date;
  fluid: FluidKind;
  quantity: number;
  /** Valeur cumulée du compteur principal au moment du plein (null : non relevée). */
  meter: number | null;
  fullTank: boolean;
};

export type Segment = { fromId: string; toId: string; litres: number; usage: number; rate: number | null };

/**
 * Tronçons « plein à plein » d'un historique de pleins (tous fluides confondus, triés ou non) : entre deux pleins
 * complets de carburant relevés au compteur, litres versés après le premier jusqu'au second inclus, et usage.
 */
export function fullToFullSegments(fills: FillPoint[], meterType: MeterType | null | undefined): Segment[] {
  const fuel = fills.filter((f) => isFuel(f.fluid)).sort((a, b) => a.filledAt.getTime() - b.filledAt.getTime());
  const segments: Segment[] = [];
  let anchor: FillPoint | null = null;
  let litres = 0;
  for (const fill of fuel) {
    if (anchor) litres += fill.quantity;
    if (fill.fullTank && fill.meter !== null) {
      if (anchor && anchor.meter !== null) {
        const usage = round(fill.meter - anchor.meter, 1);
        segments.push({ fromId: anchor.id, toId: fill.id, litres: round(litres, 3), usage, rate: consumptionRate(litres, usage, meterType) });
      }
      anchor = fill;
      litres = 0;
    }
  }
  return segments;
}

/** Consommation moyenne d'une période : litres et usage additionnés sur les tronçons exploitables. */
export function averageConsumption(segments: Segment[], meterType: MeterType | null | undefined) {
  const usable = segments.filter((s) => s.usage > 0);
  const litres = usable.reduce((s, x) => s + x.litres, 0);
  const usage = usable.reduce((s, x) => s + x.usage, 0);
  return { litres: round(litres, 3), usage: round(usage, 1), rate: consumptionRate(litres, usage, meterType), segments: usable.length };
}

/** Médiane (référence tirée de l'historique, peu sensible à un plein aberrant). */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : round((sorted[mid - 1] + sorted[mid]) / 2, 2);
}

/**
 * Consommation de référence : celle renseignée sur l'équipement (constructeur, contrat), sinon la médiane des
 * tronçons précédents s'il y en a assez. Sinon, pas de contrôle de consommation.
 */
export function referenceConsumption(declared: number | null | undefined, previousRates: (number | null)[]): number | null {
  if (declared != null && declared > 0) return declared;
  const rates = previousRates.filter((r): r is number => r !== null && r > 0);
  return rates.length >= MIN_SEGMENTS_FOR_REFERENCE ? median(rates) : null;
}

export type AnomalyCode =
  | "TANK_OVERFLOW"
  | "METER_BACKWARD"
  | "OVER_CONSUMPTION"
  | "UNDER_CONSUMPTION"
  | "FUEL_MISMATCH"
  | "CARD_OTHER_EQUIPMENT"
  | "CARD_INACTIVE"
  | "CARD_LIMIT"
  | "CLOSE_FILL";

export type Anomaly = { code: AnomalyCode; message: string };

export type AnomalyInput = {
  fill: FillPoint;
  meterType: MeterType | null | undefined;
  /** Pleins précédents valides de l'équipement (sans le nouveau). */
  history: FillPoint[];
  equipment: { fuelType: FluidKind | null; tankCapacity: number | null; referenceConsumption: number | null };
  /** Carte utilisée : équipement auquel elle est affectée, état, plafond mensuel et litres déjà pris ce mois-ci. */
  card?: { equipmentId: string | null; active: boolean; monthlyLimitLitres: number | null; monthLitres: number } | null;
  equipmentId: string;
};

/**
 * Anomalies d'un plein, toutes listées (DON-11) : un plein anormal est enregistré mais signalé au responsable du
 * parc, qui le justifie ou l'annule. Les contrôles portent sur les données saisies, pas sur une intention.
 */
export function detectAnomalies(input: AnomalyInput): Anomaly[] {
  const { fill, history, equipment, card, meterType } = input;
  const anomalies: Anomaly[] = [];
  const fuel = isFuel(fill.fluid);
  const unit = consumptionUnit(meterType);

  if (fuel && equipment.tankCapacity && fill.quantity > equipment.tankCapacity * (1 + TANK_MARGIN)) {
    anomalies.push({
      code: "TANK_OVERFLOW",
      message: tpl`Quantité de ${fr(fill.quantity)} L supérieure à la capacité du réservoir (${fr(equipment.tankCapacity)} L).`,
    });
  }
  if (fuel && equipment.fuelType && isFuel(equipment.fuelType) && equipment.fuelType !== fill.fluid) {
    anomalies.push({ code: "FUEL_MISMATCH", message: "Carburant différent de celui de l'équipement." });
  }

  const previous = [...history]
    .filter((h) => h.meter !== null && h.filledAt <= fill.filledAt)
    .sort((a, b) => b.filledAt.getTime() - a.filledAt.getTime())[0];
  if (fill.meter !== null && previous && previous.meter !== null && fill.meter < previous.meter) {
    anomalies.push({
      code: "METER_BACKWARD",
      message: tpl`Compteur relevé (${fr(fill.meter)}) inférieur à celui du plein précédent (${fr(previous.meter)}).`,
    });
  }

  if (fuel) {
    const lastFuel = [...history]
      .filter((h) => isFuel(h.fluid) && h.filledAt <= fill.filledAt)
      .sort((a, b) => b.filledAt.getTime() - a.filledAt.getTime())[0];
    const hours = lastFuel ? (fill.filledAt.getTime() - lastFuel.filledAt.getTime()) / 3_600_000 : null;
    const noUsage = !lastFuel || lastFuel.meter === null || fill.meter === null || fill.meter - lastFuel.meter <= 0;
    const bigQuantity = equipment.tankCapacity ? fill.quantity > equipment.tankCapacity * 0.25 : false;
    if (lastFuel && hours !== null && hours < CLOSE_FILL_HOURS && lastFuel.fullTank && noUsage && bigQuantity) {
      anomalies.push({ code: "CLOSE_FILL", message: tpl`Nouveau plein ${fr(hours)} h après un plein complet, sans usage relevé entre les deux.` });
    }

    // Consommation du tronçon que ce plein ferme, comparée à la référence.
    if (fill.fullTank && fill.meter !== null && unit) {
      const all = fullToFullSegments([...history, fill], meterType);
      const closing = all.find((s) => s.toId === fill.id);
      const before = all.filter((s) => s.toId !== fill.id).map((s) => s.rate);
      const reference = referenceConsumption(equipment.referenceConsumption, before.slice(-5));
      if (closing?.rate != null && reference) {
        const deviation = (closing.rate - reference) / reference;
        if (deviation > CONSUMPTION_TOLERANCE) {
          anomalies.push({
            code: "OVER_CONSUMPTION",
            message: tpl`Surconsommation : ${fr(closing.rate)} ${unit} pour une référence de ${fr(reference)} ${unit} (+${Math.round(deviation * 100)} %).`,
          });
        } else if (deviation < -CONSUMPTION_TOLERANCE) {
          anomalies.push({
            code: "UNDER_CONSUMPTION",
            message: tpl`Sous-consommation : ${fr(closing.rate)} ${unit} pour une référence de ${fr(reference)} ${unit} (${Math.round(deviation * 100)} %) : plein incomplet ou compteur erroné ?`,
          });
        }
      }
    }
  }

  if (card) {
    if (!card.active) anomalies.push({ code: "CARD_INACTIVE", message: "Carte carburant désactivée." });
    if (card.equipmentId && card.equipmentId !== input.equipmentId) {
      anomalies.push({ code: "CARD_OTHER_EQUIPMENT", message: "Carte affectée à un autre équipement." });
    }
    if (card.monthlyLimitLitres && card.monthLitres + fill.quantity > card.monthlyLimitLitres) {
      anomalies.push({
        code: "CARD_LIMIT",
        message: tpl`Plafond mensuel de la carte dépassé : ${fr(card.monthLitres + fill.quantity)} L pour ${fr(card.monthlyLimitLitres)} L.`,
      });
    }
  }
  return anomalies;
}

/** Montant d'un plein : saisi, sinon quantité × prix unitaire. */
export function fillAmount(quantity: number, unitPrice: number | null | undefined, amount: number | null | undefined): number | null {
  if (amount != null) return round(amount, 2);
  if (unitPrice != null) return round(quantity * unitPrice, 2);
  return null;
}

/** Quatre derniers chiffres d'un numéro de carte : seuls conservés (jamais le numéro complet). */
export function cardLast4(number: string): string | null {
  const digits = number.replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : null;
}

function fr(n: number) {
  return round(n, 1).toLocaleString("fr-FR");
}

function round(n: number, digits: number) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

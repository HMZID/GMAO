import { describe, expect, it } from "vitest";
import { plainText } from "@/i18n/translate";
import {
  averageConsumption,
  cardLast4,
  consumptionRate,
  consumptionUnit,
  detectAnomalies,
  fillAmount,
  fullToFullSegments,
  median,
  referenceConsumption,
  type AnomalyInput,
  type FillPoint,
} from "../fuel";

const day = (d: number, h = 8) => new Date(Date.UTC(2026, 9, d, h));
const fill = (id: string, d: number, quantity: number, meter: number | null, overrides: Partial<FillPoint> = {}): FillPoint => ({
  id,
  filledAt: day(d),
  fluid: "DIESEL",
  quantity,
  meter,
  fullTank: true,
  ...overrides,
});

describe("Consommation plein à plein", () => {
  it("calcule L/h pour un engin et L/100 km pour un véhicule", () => {
    expect(consumptionUnit("HOURS")).toBe("L/h");
    expect(consumptionUnit("KM")).toBe("L/100 km");
    expect(consumptionUnit("CYCLES")).toBeNull();
    expect(consumptionRate(180, 12, "HOURS")).toBe(15);
    expect(consumptionRate(32, 100, "KM")).toBe(32);
    expect(consumptionRate(30, 0, "HOURS")).toBeNull();
  });

  it("compte les litres versés après le plein de départ, appoints compris", () => {
    // Pelle : plein à 1000 h, appoint (non complet) puis plein complet à 1020 h.
    const fills = [fill("a", 1, 200, 1000), fill("b", 2, 120, 1012, { fullTank: false }), fill("c", 3, 180, 1020)];
    expect(fullToFullSegments(fills, "HOURS")).toEqual([{ fromId: "a", toId: "c", litres: 300, usage: 20, rate: 15 }]);
  });

  it("ignore AdBlue et huiles, et les pleins sans compteur ne ferment pas de tronçon", () => {
    const fills = [
      fill("a", 1, 200, 1000),
      fill("adblue", 2, 20, 1005, { fluid: "ADBLUE" }),
      fill("sans-compteur", 2, 50, null),
      fill("c", 3, 100, 1010),
    ];
    const segments = fullToFullSegments(fills, "HOURS");
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({ litres: 150, usage: 10, rate: 15 });
  });

  it("additionne les tronçons d'une période (moyenne pondérée par l'usage)", () => {
    const segments = fullToFullSegments([fill("a", 1, 0, 1000), fill("b", 2, 150, 1010), fill("c", 3, 300, 1030)], "HOURS");
    expect(averageConsumption(segments, "HOURS")).toEqual({ litres: 450, usage: 30, rate: 15, segments: 2 });
  });

  it("référence : celle de l'équipement, sinon la médiane d'au moins 3 tronçons", () => {
    expect(referenceConsumption(14, [20, 21])).toBe(14);
    expect(referenceConsumption(null, [15, 16])).toBeNull();
    expect(referenceConsumption(null, [15, 40, 16])).toBe(16);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
});

describe("Anomalies d'un plein", () => {
  const equipment = { fuelType: "DIESEL" as const, tankCapacity: 400, referenceConsumption: 15 };
  const base = (f: FillPoint, extra: Partial<AnomalyInput> = {}): AnomalyInput => ({
    fill: f,
    meterType: "HOURS",
    history: [fill("a", 1, 200, 1000)],
    equipment,
    equipmentId: "eq-1",
    ...extra,
  });
  const codes = (input: AnomalyInput) => detectAnomalies(input).map((a) => a.code);

  it("plein normal : aucune anomalie", () => {
    expect(detectAnomalies(base(fill("b", 2, 150, 1010)))).toEqual([]);
  });

  it("surconsommation et sous-consommation au-delà de 25 % de la référence", () => {
    expect(codes(base(fill("b", 2, 250, 1010)))).toEqual(["OVER_CONSUMPTION"]);
    expect(codes(base(fill("b", 2, 100, 1010)))).toEqual(["UNDER_CONSUMPTION"]);
    const [over] = detectAnomalies(base(fill("b", 2, 250, 1010)));
    expect(plainText(over.message)).toBe("Surconsommation : 25 L/h pour une référence de 15 L/h (+67 %).");
  });

  it("sans référence déclarée, la médiane de l'historique sert de référence", () => {
    const history = [fill("a", 1, 0, 1000), fill("b", 2, 150, 1010), fill("c", 3, 160, 1020), fill("d", 4, 140, 1030)];
    const noReference = { ...equipment, referenceConsumption: null };
    expect(codes(base(fill("e", 5, 300, 1040), { history, equipment: noReference }))).toEqual(["OVER_CONSUMPTION"]);
    expect(codes(base(fill("e", 5, 150, 1040), { history, equipment: noReference }))).toEqual([]);
  });

  it("dépassement du réservoir, compteur qui recule, mauvais carburant", () => {
    expect(codes(base(fill("b", 2, 430, null)))).toEqual(["TANK_OVERFLOW"]);
    expect(codes(base(fill("b", 2, 150, 990)))).toEqual(["METER_BACKWARD"]);
    expect(codes(base(fill("b", 2, 50, null, { fluid: "GASOLINE" })))).toEqual(["FUEL_MISMATCH"]);
    // L'AdBlue n'est ni un carburant ni soumis au réservoir de carburant.
    expect(codes(base(fill("b", 2, 30, null, { fluid: "ADBLUE" })))).toEqual([]);
  });

  it("plein rapproché sans usage après un plein complet", () => {
    const history = [{ ...fill("a", 1, 300, 1000), filledAt: day(1, 8) }];
    expect(codes(base({ ...fill("b", 1, 200, 1000), filledAt: day(1, 10) }, { history }))).toContain("CLOSE_FILL");
    expect(codes(base({ ...fill("b", 1, 50, 1000), filledAt: day(1, 10) }, { history }))).not.toContain("CLOSE_FILL");
  });

  it("carte : affectée à un autre équipement, désactivée, plafond mensuel dépassé", () => {
    const card = { equipmentId: "eq-2", active: false, monthlyLimitLitres: 500, monthLitres: 400 };
    expect(codes(base(fill("b", 2, 150, 1010), { card }))).toEqual(["CARD_INACTIVE", "CARD_OTHER_EQUIPMENT", "CARD_LIMIT"]);
    expect(codes(base(fill("b", 2, 150, 1010), { card: { equipmentId: "eq-1", active: true, monthlyLimitLitres: 1000, monthLitres: 0 } }))).toEqual(
      [],
    );
  });

  it("toutes les anomalies sont listées en une fois (DON-11)", () => {
    const card = { equipmentId: "eq-2", active: true, monthlyLimitLitres: null, monthLitres: 0 };
    expect(codes(base(fill("b", 2, 450, 990, { fluid: "GASOLINE" }), { card }))).toEqual([
      "TANK_OVERFLOW",
      "FUEL_MISMATCH",
      "METER_BACKWARD",
      "CARD_OTHER_EQUIPMENT",
    ]);
  });
});

describe("Montant et carte", () => {
  it("montant saisi, sinon quantité × prix", () => {
    expect(fillAmount(100, 2.155, null)).toBe(215.5);
    expect(fillAmount(100, 2.155, 210)).toBe(210);
    expect(fillAmount(100, null, null)).toBeNull();
  });

  it("ne garde que les 4 derniers chiffres d'un numéro de carte", () => {
    expect(cardLast4("7089 1234 5678 4521")).toBe("4521");
    expect(cardLast4("4521")).toBe("4521");
    expect(cardLast4("12")).toBeNull();
  });
});

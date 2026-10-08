import { describe, expect, it } from "vitest";
import { averageDailyUsage, checkReading, offsetAfterReplacement, toCumulative } from "../meters";
import { computeDue, evaluateDue, nextBaseline, type OperationRule } from "../preventive";

const at = (isoDateTime: string) => new Date(isoDateTime);
const now = at("2026-03-10T12:00:00Z");

describe("Contrôle des relevés (DON-01 à DON-03)", () => {
  const previous = { value: 4120, readAt: at("2026-03-01T08:00:00Z") };

  it("accepte un relevé cohérent", () => {
    expect(checkReading({ meterType: "HOURS", value: 4180, readAt: at("2026-03-09T08:00:00Z"), source: "MANUAL", previous, now })).toEqual({
      status: "VALID",
      reasons: [],
    });
  });

  it("refuse en saisie un relevé inférieur au précédent (4 100 h après 4 120 h)", () => {
    const result = checkReading({ meterType: "HOURS", value: 4100, readAt: at("2026-03-09T08:00:00Z"), source: "MANUAL", previous, now });
    expect(result.status).toBe("REJECTED");
  });

  it("met « à vérifier » le même relevé venant d'une interface", () => {
    const result = checkReading({ meterType: "HOURS", value: 4100, readAt: at("2026-03-09T08:00:00Z"), source: "TELEMATICS", previous, now });
    expect(result.status).toBe("TO_CHECK");
  });

  it("met « à vérifier » 30 h saisies en une journée (au plus 24 h par jour)", () => {
    const result = checkReading({
      meterType: "HOURS",
      value: 4150,
      readAt: at("2026-03-02T08:00:00Z"),
      source: "MANUAL",
      previous,
      now,
    });
    expect(result.status).toBe("TO_CHECK");
  });

  it("refuse un relevé daté dans le futur", () => {
    const result = checkReading({ meterType: "KM", value: 10, readAt: at("2026-03-11T12:00:00Z"), source: "MANUAL", now });
    expect(result.status).toBe("REJECTED");
  });

  it("refuse une insertion rétroactive supérieure au relevé suivant", () => {
    const result = checkReading({
      meterType: "HOURS",
      value: 4200,
      readAt: at("2026-03-05T08:00:00Z"),
      source: "MANUAL",
      previous,
      next: { value: 4190, readAt: at("2026-03-08T08:00:00Z") },
      now,
    });
    expect(result.status).toBe("REJECTED");
  });

  it("met « à vérifier » un kilométrage invraisemblable", () => {
    const result = checkReading({
      meterType: "KM",
      value: 5000,
      readAt: at("2026-03-01T10:00:00Z"),
      source: "MANUAL",
      previous: { value: 1000, readAt: at("2026-03-01T08:00:00Z") },
      now,
    });
    expect(result.status).toBe("TO_CHECK");
  });
});

describe("Remplacement de compteur (DON-04, scénario de recette R-05)", () => {
  const offset = offsetAfterReplacement(0, 6850, 0);
  const rule: OperationRule = {
    mode: "FIXED",
    triggers: [{ kind: "METER", every: 250, meterType: "HOURS" }],
    preAlertMeter: 25,
    tolerancePercent: 10,
  };
  const base = { date: at("2026-01-01T00:00:00Z"), meter: 6750 };
  const due = computeDue(rule, base);

  it("conserve l'usage cumulé : 6 850 h + lecture du nouvel horamètre", () => {
    expect(offset).toBe(6850);
    expect(toCumulative(150, offset)).toBe(7000);
  });

  it("déclenche la pré-alerte à 126 h lues et l'échéance à 150 h lues", () => {
    expect(due.dueMeter).toBe(7000);
    const evaluate = (read: number) => evaluateDue({ rule, base, due, now: at("2026-03-01T00:00:00Z"), currentMeter: toCumulative(read, offset) });
    expect(evaluate(120)).toBe("UPCOMING");
    expect(evaluate(126)).toBe("PRE_ALERT");
    expect(evaluate(150)).toBe("DUE");
  });

  it("réalisé à 155 h lues en mode fixe : prochaine échéance 7 250 h cumulées, soit 400 h lues", () => {
    const next = computeDue(rule, nextBaseline(rule, due, { date: at("2026-03-05T00:00:00Z"), meter: toCumulative(155, offset) }));
    expect(next.dueMeter).toBe(7250);
    expect(next.dueMeter! - offset).toBe(400);
  });
});

describe("Utilisation moyenne (PRV-07)", () => {
  it("calcule l'utilisation journalière sur 30 jours", () => {
    const points = [
      { cumulativeValue: 4000, readAt: at("2026-02-20T00:00:00Z") },
      { cumulativeValue: 4080, readAt: at("2026-03-02T00:00:00Z") },
      { cumulativeValue: 4144, readAt: at("2026-03-10T00:00:00Z") },
    ];
    expect(averageDailyUsage(points, at("2026-03-10T00:00:00Z"))).toBe(8);
  });
  it("renvoie null avec moins de deux relevés", () => {
    expect(averageDailyUsage([{ cumulativeValue: 1, readAt: now }], now)).toBeNull();
  });
});

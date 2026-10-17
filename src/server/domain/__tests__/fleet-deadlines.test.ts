import { describe, expect, it } from "vitest";
import { daysUntil, deadlineAlertStage, deadlineAlertText, deadlineState } from "../fleet-deadlines";

const now = new Date("2026-10-17T08:00:00Z");
const inDays = (n: number) => new Date(now.getTime() + n * 86_400_000);

describe("Échéances administratives du parc : étapes d'alerte", () => {
  it("prévient à J−30, J−7 et le jour même, rien au-delà de 30 jours", () => {
    expect(deadlineAlertStage(inDays(45), now)).toBeNull();
    expect(deadlineAlertStage(inDays(30), now)).toBe("J30");
    expect(deadlineAlertStage(inDays(8), now)).toBe("J30");
    expect(deadlineAlertStage(inDays(7), now)).toBe("J7");
    expect(deadlineAlertStage(inDays(1), now)).toBe("J7");
    expect(deadlineAlertStage(inDays(0), now)).toBe("J0");
  });

  it("rappelle chaque semaine tant que l'échéance est dépassée", () => {
    expect(deadlineAlertStage(inDays(-1), now)).toBe("OVERDUE-0");
    expect(deadlineAlertStage(inDays(-7), now)).toBe("OVERDUE-0");
    expect(deadlineAlertStage(inDays(-8), now)).toBe("OVERDUE-1");
    expect(deadlineAlertStage(inDays(-15), now)).toBe("OVERDUE-2");
  });

  it("compte en jours calendaires à l'heure de Paris (échéance du lendemain à 0 h 30)", () => {
    // 17/10 à 23 h 30 à Paris ; échéance le 18/10 à 0 h 30 : un jour.
    expect(daysUntil(new Date("2026-10-17T22:30:00Z"), new Date("2026-10-17T21:30:00Z"))).toBe(1);
  });
});

describe("Échéances administratives du parc : état et texte", () => {
  it("classe en retard, à renouveler (30 jours) ou à jour", () => {
    expect(deadlineState(inDays(-2), now)).toBe("OVERDUE");
    expect(deadlineState(inDays(10), now)).toBe("SOON");
    expect(deadlineState(inDays(60), now)).toBe("OK");
  });

  it("formule l'alerte selon le délai", () => {
    expect(deadlineAlertText({ kind: "INSURANCE", label: null, equipmentCode: "CA-101", days: 12 })).toBe(
      "Assurance de CA-101 à renouveler dans 12 jour(s).",
    );
    expect(deadlineAlertText({ kind: "VIGNETTE", label: "Vignette 2026", equipmentCode: "CA-102", days: -3 })).toContain("échue depuis 3 jour(s)");
    expect(deadlineAlertText({ kind: "TECHNICAL_INSPECTION", label: null, equipmentCode: "CA-102", days: 0 })).toContain("aujourd'hui");
  });
});

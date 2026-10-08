import { describe, expect, it } from "vitest";
import { availability, clippedHours, mdt, mtbf, mttr, preventiveCompliance, repairOrReplaceRatio } from "../kpi";
import { checkIssue, checkReservation, needsReorder, suggestedReorderQuantity, weightedAverageCost } from "../stock";

describe("Stock (CDC §7.5)", () => {
  it("refuse une sortie supérieure au réservé pour l'OT + disponible", () => {
    expect(checkIssue({ onHand: 5, reserved: 4, reservedForWorkOrder: 2, quantity: 4 })).toHaveLength(1);
    expect(checkIssue({ onHand: 5, reserved: 4, reservedForWorkOrder: 2, quantity: 3 })).toEqual([]);
  });
  it("ne laisse jamais le stock physique devenir négatif", () => {
    expect(checkIssue({ onHand: 0, reserved: 0, reservedForWorkOrder: 0, quantity: 1 }).length).toBeGreaterThan(0);
  });
  it("ne réserve que le disponible", () => {
    expect(checkReservation(3, 2, 2)).toHaveLength(1);
    expect(checkReservation(3, 2, 1)).toEqual([]);
  });
  it("calcule le coût moyen pondéré", () => {
    expect(weightedAverageCost(10, 20, 10, 30)).toBe(25);
    expect(weightedAverageCost(0, 0, 4, 12.5)).toBe(12.5);
  });
  it("alerte quand disponible + en commande ≤ point de commande (STK-08)", () => {
    expect(needsReorder({ onHand: 3, reserved: 1, onOrder: 0, reorderPoint: 2 })).toBe(true);
    expect(needsReorder({ onHand: 3, reserved: 0, onOrder: 0, reorderPoint: 2 })).toBe(false);
    expect(suggestedReorderQuantity({ onHand: 3, reserved: 1, onOrder: 2, maxQty: 10 })).toBe(6);
  });
});

describe("Indicateurs (CDC §9.2)", () => {
  const h = (iso: string) => new Date(iso);

  it("calcule la disponibilité technique", () => {
    expect(availability(720, 36)).toBeCloseTo(0.95);
    expect(availability(0, 10)).toBeNull();
  });
  it("répartit une immobilisation à cheval sur deux périodes", () => {
    const interval = { start: h("2026-01-31T12:00:00Z"), end: h("2026-02-01T12:00:00Z") };
    expect(clippedHours(interval, h("2026-02-01T00:00:00Z"), h("2026-03-01T00:00:00Z"))).toBe(12);
  });
  it("MTBF non significatif sous 3 défaillances", () => {
    expect(mtbf(900, 2)).toBeNull();
    expect(mtbf(900, 3)).toBe(300);
  });
  it("MTTR déduit les attentes intermédiaires", () => {
    const repairs = [
      { startedAt: h("2026-01-01T08:00:00Z"), workDoneAt: h("2026-01-01T12:00:00Z") },
      { startedAt: h("2026-01-02T08:00:00Z"), workDoneAt: h("2026-01-03T08:00:00Z"), waitingHours: 20 },
      { startedAt: h("2026-01-04T08:00:00Z"), workDoneAt: h("2026-01-04T10:00:00Z") },
    ];
    expect(mttr(repairs)).toBeCloseTo((4 + 4 + 2) / 3);
  });
  it("MDT inclut les attentes", () => {
    const downtimes = [
      { start: h("2026-01-01T00:00:00Z"), end: h("2026-01-02T00:00:00Z") },
      { start: h("2026-01-05T00:00:00Z"), end: h("2026-01-05T12:00:00Z") },
      { start: h("2026-01-07T00:00:00Z"), end: h("2026-01-07T12:00:00Z") },
    ];
    expect(mdt(downtimes, h("2026-02-01T00:00:00Z"))).toBe(16);
  });
  it("respect du préventif et ratio réparer / remplacer", () => {
    expect(preventiveCompliance(9, 10)).toBe(0.9);
    expect(repairOrReplaceRatio(20_000, 15_000, 60_000)).toBeCloseTo(0.583, 3);
  });
});

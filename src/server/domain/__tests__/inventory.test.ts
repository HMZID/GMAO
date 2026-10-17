import { describe, expect, it } from "vitest";
import { expectedQuantityAt, inventoryCountStatus, inventoryValue } from "../stock";

describe("Inventaire avec écart (STK-07, R-08)", () => {
  it("calcule le stock théorique à l'heure du comptage, hors mouvements postérieurs", () => {
    // R-08 : 12 filtres ; comptage de 9 à 10 h ; sortie d'un filtre à 10 h 30 (stock actuel 11).
    expect(expectedQuantityAt(11, [{ type: "ISSUE", quantity: 1 }])).toBe(12);
    expect(
      expectedQuantityAt(15, [
        { type: "RECEIPT", quantity: 5 },
        { type: "ADJUSTMENT", quantity: -2 },
      ]),
    ).toBe(12);
    expect(expectedQuantityAt(12, [])).toBe(12);
  });

  it("met « à valider » un écart au-delà du seuil en valeur, sauf pour un valideur", () => {
    expect(inventoryValue(-3, 45)).toBe(135);
    expect(inventoryCountStatus({ difference: -3, unitCost: 45, canValidate: false })).toBe("PENDING");
    expect(inventoryCountStatus({ difference: -3, unitCost: 45, canValidate: true })).toBe("APPLIED");
  });

  it("applique directement un écart faible ou nul", () => {
    expect(inventoryCountStatus({ difference: -2, unitCost: 45, canValidate: false })).toBe("APPLIED");
    expect(inventoryCountStatus({ difference: 0, unitCost: 1000, canValidate: false })).toBe("APPLIED");
    expect(inventoryCountStatus({ difference: 1, unitCost: 150, canValidate: false, threshold: 200 })).toBe("APPLIED");
  });
});

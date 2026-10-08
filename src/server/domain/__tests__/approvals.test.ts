import { describe, expect, it } from "vitest";
import { afterDecision, applicableSteps, checkDecision, checkStepDefinition, isActiveSubstitution, type StepDefinition } from "../approvals";

const step = (position: number, overrides: Partial<StepDefinition> = {}): StepDefinition => ({
  position,
  name: `Étape ${position}`,
  approverRole: "PURCHASING_MANAGER",
  approverUserId: null,
  minAmount: null,
  priorities: [],
  ...overrides,
});

describe("Circuits : étapes applicables (CDC §2.4)", () => {
  const purchase = [step(1), step(2, { name: "Direction", approverRole: "EXECUTIVE", minAmount: 5000 })];

  it("route une demande d'achat au-dessus du seuil vers la direction (ACH-02)", () => {
    expect(applicableSteps(purchase, { amount: 5000 }).map((s) => s.name)).toEqual(["Étape 1", "Direction"]);
    expect(applicableSteps(purchase, { amount: 4999.99 }).map((s) => s.name)).toEqual(["Étape 1"]);
  });

  it("ne demande aucune validation si aucune étape ne s'applique", () => {
    expect(applicableSteps([step(1, { minAmount: 1500 })], { amount: 200 })).toEqual([]);
  });

  it("filtre les étapes par priorité (DI P1 validée par le chef d'atelier)", () => {
    const di = [step(1, { approverRole: "WORKSHOP_MANAGER", priorities: ["P1"] })];
    expect(applicableSteps(di, { priority: "P1" })).toHaveLength(1);
    expect(applicableSteps(di, { priority: "P2" })).toHaveLength(0);
    expect(applicableSteps(di, { priority: null })).toHaveLength(0);
  });

  it("ordonne les étapes par position", () => {
    expect(applicableSteps([step(3), step(1), step(2)], {}).map((s) => s.position)).toEqual([1, 2, 3]);
  });

  it("exige un rôle ou une personne, pas les deux", () => {
    expect(checkStepDefinition({ approverRole: null, approverUserId: null, minAmount: null })).toHaveLength(1);
    expect(checkStepDefinition({ approverRole: "EXECUTIVE", approverUserId: "u1", minAmount: null })).toHaveLength(1);
    expect(checkStepDefinition({ approverRole: "EXECUTIVE", approverUserId: null, minAmount: -1 })).toHaveLength(1);
    expect(checkStepDefinition({ approverRole: null, approverUserId: "u1", minAmount: 100 })).toEqual([]);
  });
});

describe("Circuits : décisions", () => {
  const base = { status: "PENDING" as const, actorId: "val", requesterId: "dem", eligible: true, previousApproverIds: [] };

  it("autorise le valideur de l'étape", () => {
    expect(checkDecision({ ...base, decision: "APPROVED" })).toEqual([]);
  });

  it("refuse que le demandeur décide de sa propre demande (ACH-02)", () => {
    expect(checkDecision({ ...base, actorId: "dem", decision: "APPROVED" })).toContain("Le demandeur ne peut pas décider de sa propre demande.");
  });

  it("refuse un utilisateur qui n'est pas valideur de l'étape en cours", () => {
    expect(checkDecision({ ...base, eligible: false, decision: "APPROVED" })).toContain("Vous n'êtes pas valideur de l'étape en cours.");
  });

  it("exige un commentaire en cas de refus et liste toutes les anomalies en une fois", () => {
    const errors = checkDecision({ ...base, actorId: "dem", eligible: false, decision: "REJECTED", comment: "  " });
    expect(errors).toHaveLength(3);
    expect(errors).toContain("Le commentaire est obligatoire en cas de refus.");
  });

  it("refuse qu'une même personne approuve deux étapes", () => {
    expect(checkDecision({ ...base, previousApproverIds: ["val"], decision: "APPROVED" })).toHaveLength(1);
  });

  it("refuse toute décision sur une demande déjà tranchée (transition non autorisée)", () => {
    expect(checkDecision({ ...base, status: "APPROVED", decision: "REJECTED", comment: "trop tard" })).toEqual([
      "Cette demande n'est plus en attente de validation.",
    ]);
  });

  it("enchaîne les étapes puis approuve ; un refus est définitif", () => {
    const steps = [
      { position: 1, name: "A", approverRole: null, approverUserId: "u" },
      { position: 2, name: "B", approverRole: null, approverUserId: "v" },
    ];
    expect(afterDecision(steps, 1, "APPROVED")).toEqual({ status: "PENDING", nextPosition: 2 });
    expect(afterDecision(steps, 2, "APPROVED")).toEqual({ status: "APPROVED", nextPosition: null });
    expect(afterDecision(steps, 1, "REJECTED")).toEqual({ status: "REJECTED", nextPosition: null });
  });

  it("suppléance active seulement pendant sa période", () => {
    const s = { validFrom: new Date("2026-10-01T00:00:00Z"), validTo: new Date("2026-10-15T23:59:59Z") };
    expect(isActiveSubstitution(s, new Date("2026-10-08T12:00:00Z"))).toBe(true);
    expect(isActiveSubstitution(s, new Date("2026-10-16T00:00:00Z"))).toBe(false);
  });
});

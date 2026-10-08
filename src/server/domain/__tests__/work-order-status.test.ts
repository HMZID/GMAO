import { describe, expect, it } from "vitest";
import { checkTransition, type TransitionInput, type WorkOrderSnapshot } from "../work-order-status";

const base: WorkOrderSnapshot = {
  status: "CREATED",
  isExternal: false,
  isSafetyRelated: false,
  equipmentCriticality: "B",
  equipmentHasMeter: true,
  plannedStart: null,
  assigneeTechnicianIds: [],
  hasSupplier: false,
  techClosedAt: null,
  hasWorkDescription: false,
  requiredTasksIncomplete: 0,
  totalMinutes: 0,
  hasOpenTimeEntry: false,
  hasMeterReadingSinceStart: false,
  activeReservations: 0,
  consumedPartLines: 0,
  timeEntryCount: 0,
  externalCostKnown: false,
};

const manager: TransitionInput["actor"] = { userId: "u-chef", canManage: true, canReleaseCriticalEquipment: true };
const technician: TransitionInput["actor"] = {
  userId: "u-tech",
  technicianId: "t-1",
  canManage: false,
  canReleaseCriticalEquipment: false,
};

const errorsOf = (wo: WorkOrderSnapshot, input: TransitionInput, now?: Date) => {
  const result = checkTransition(wo, input, now);
  return result.ok ? [] : result.errors;
};

describe("Transitions autorisées (COR-06)", () => {
  it("refuse de passer directement de Créé à Clôturé", () => {
    expect(errorsOf(base, { to: "CLOSED", actor: manager })[0]).toMatch(/Transition interdite/);
  });

  it("ne permet aucune transition depuis un état final", () => {
    expect(errorsOf({ ...base, status: "CLOSED" }, { to: "IN_PROGRESS", reason: "x", actor: manager })).toHaveLength(1);
    expect(errorsOf({ ...base, status: "CANCELLED" }, { to: "PLANNED", actor: manager })).toHaveLength(1);
  });
});

describe("Planification", () => {
  it("exige une date et un intervenant, et liste toutes les données manquantes (DON-11)", () => {
    expect(errorsOf(base, { to: "PLANNED", actor: manager })).toHaveLength(2);
  });
  it("accepte un OT externe avec prestataire sans technicien", () => {
    const wo = { ...base, isExternal: true, hasSupplier: true, plannedStart: new Date() };
    expect(errorsOf(wo, { to: "PLANNED", actor: manager })).toEqual([]);
  });
});

describe("Exécution et fin de travaux", () => {
  const planned: WorkOrderSnapshot = { ...base, status: "PLANNED", plannedStart: new Date(), assigneeTechnicianIds: ["t-1"] };

  it("permet au technicien affecté de démarrer", () => {
    expect(errorsOf(planned, { to: "IN_PROGRESS", actor: technician })).toEqual([]);
  });
  it("refuse le démarrage par un technicien non affecté", () => {
    expect(errorsOf(planned, { to: "IN_PROGRESS", actor: { ...technician, technicianId: "t-2" } })).toHaveLength(1);
  });
  it("exige motif pour la mise en attente", () => {
    expect(errorsOf({ ...planned, status: "IN_PROGRESS" }, { to: "ON_HOLD", actor: technician })).toHaveLength(1);
    expect(errorsOf({ ...planned, status: "IN_PROGRESS" }, { to: "ON_HOLD", holdReason: "PARTS", actor: technician })).toEqual([]);
  });
  it("exige travaux, checklist, compteur et temps pour terminer", () => {
    const inProgress = { ...planned, status: "IN_PROGRESS" as const, requiredTasksIncomplete: 2 };
    expect(errorsOf(inProgress, { to: "WORK_DONE", actor: technician })).toHaveLength(4);
    const ready = {
      ...inProgress,
      requiredTasksIncomplete: 0,
      hasWorkDescription: true,
      hasMeterReadingSinceStart: true,
      totalMinutes: 90,
    };
    expect(errorsOf(ready, { to: "WORK_DONE", actor: technician })).toEqual([]);
  });
});

describe("Remise en service (COR-12, DON-07, HAB-05)", () => {
  const workDone: WorkOrderSnapshot = {
    ...base,
    status: "WORK_DONE",
    equipmentCriticality: "A",
    assigneeTechnicianIds: ["t-1"],
    hasWorkDescription: true,
    totalMinutes: 60,
  };

  it("refuse la validation par l'exécutant d'un équipement critique", () => {
    const actor = { ...technician, canReleaseCriticalEquipment: true };
    expect(errorsOf(workDone, { to: "TECH_CLOSED", testsPassed: true, actor })).toEqual([
      "Le valideur doit être différent de l'exécutant (séparation des tâches).",
    ]);
  });
  it("accepte la validation par un responsable habilité", () => {
    expect(errorsOf(workDone, { to: "TECH_CLOSED", testsPassed: true, actor: manager })).toEqual([]);
  });
  it("exige des essais conformes et aucune réservation active", () => {
    expect(errorsOf({ ...workDone, activeReservations: 1 }, { to: "TECH_CLOSED", actor: manager })).toHaveLength(2);
  });
});

describe("Annulation et réouverture (DON-08, DON-10)", () => {
  it("refuse l'annulation si du temps est imputé", () => {
    const wo = { ...base, status: "PLANNED" as const, timeEntryCount: 1 };
    expect(errorsOf(wo, { to: "CANCELLED", reason: "doublon", actor: manager })[0]).toMatch(/Annulation impossible/);
  });
  it("exige un motif d'annulation", () => {
    expect(errorsOf(base, { to: "CANCELLED", actor: manager })).toHaveLength(1);
  });
  it("autorise la réouverture sous 7 jours avec motif, la refuse au-delà", () => {
    const closed = { ...base, status: "TECH_CLOSED" as const, techClosedAt: new Date("2026-03-01T10:00:00Z") };
    expect(errorsOf(closed, { to: "IN_PROGRESS", reason: "fuite", actor: manager }, new Date("2026-03-05T10:00:00Z"))).toEqual([]);
    expect(errorsOf(closed, { to: "IN_PROGRESS", reason: "fuite", actor: manager }, new Date("2026-03-10T10:00:00Z"))[0]).toMatch(/récidive/);
  });
});

describe("Clôture administrative", () => {
  it("exige le coût du prestataire pour un OT externe", () => {
    const wo = { ...base, status: "TECH_CLOSED" as const, isExternal: true };
    expect(errorsOf(wo, { to: "CLOSED", actor: manager })).toHaveLength(1);
    expect(errorsOf({ ...wo, externalCostKnown: true }, { to: "CLOSED", actor: manager })).toEqual([]);
  });
});

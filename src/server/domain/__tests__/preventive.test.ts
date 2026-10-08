import { describe, expect, it } from "vitest";
import {
  addCalendar,
  computeDue,
  evaluateDue,
  nextBaseline,
  projectMeterDate,
  shouldGenerateWorkOrder,
  suggestedStart,
  tolerances,
  type OperationRule,
} from "../preventive";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const iso = (date: Date | null) => date?.toISOString().slice(0, 10) ?? null;

/** CDC §4.4 : chargeuse, 250 h moteur ou 3 mois, premier seuil atteint, mode glissant. */
const loaderRule: OperationRule = {
  mode: "SLIDING",
  triggers: [
    { kind: "METER", every: 250, meterType: "HOURS" },
    { kind: "CALENDAR", every: 3, unit: "MONTH" },
  ],
  preAlertDays: 15,
  preAlertMeter: 25,
  tolerancePercent: 10,
};
const loaderBase = { date: d("2026-01-10"), meter: 4120 };

describe("addCalendar (mois calendaires, UTC)", () => {
  it("ajoute 3 mois au 10 janvier", () => {
    expect(iso(addCalendar(d("2026-01-10"), 3, "MONTH"))).toBe("2026-04-10");
  });
  it("borne le 31 janvier + 1 mois au dernier jour de février", () => {
    expect(iso(addCalendar(d("2026-01-31"), 1, "MONTH"))).toBe("2026-02-28");
    expect(iso(addCalendar(d("2028-01-31"), 1, "MONTH"))).toBe("2028-02-29");
  });
  it("gère jours, semaines et années", () => {
    expect(iso(addCalendar(d("2026-01-10"), 10, "DAY"))).toBe("2026-01-20");
    expect(iso(addCalendar(d("2026-01-10"), 2, "WEEK"))).toBe("2026-01-24");
    expect(iso(addCalendar(d("2026-01-10"), 1, "YEAR"))).toBe("2027-01-10");
  });
});

describe("Exemple chargeuse du CDC (§4.4)", () => {
  const due = computeDue(loaderRule, loaderBase);

  it("calcule l'échéance : 4 370 h ou 10/04/2026", () => {
    expect(due.dueMeter).toBe(4370);
    expect(iso(due.dueDate)).toBe("2026-04-10");
  });

  it("calcule une tolérance de 25 h ou 9 jours", () => {
    expect(tolerances(loaderRule, loaderBase, due)).toEqual({ days: 9, meter: 25 });
  });

  describe("cas A : usage intensif, le compteur déclenche", () => {
    const now = d("2026-02-18");
    it("reste à venir à 4 340 h", () => {
      expect(evaluateDue({ rule: loaderRule, base: loaderBase, due, now, currentMeter: 4340 })).toBe("UPCOMING");
    });
    it("passe en pré-alerte à 4 345 h", () => {
      expect(evaluateDue({ rule: loaderRule, base: loaderBase, due, now, currentMeter: 4346 })).toBe("PRE_ALERT");
    });
    it("est échue au-delà de 4 370 h et en retard au-delà de 4 395 h", () => {
      expect(evaluateDue({ rule: loaderRule, base: loaderBase, due, now, currentMeter: 4378 })).toBe("DUE");
      expect(evaluateDue({ rule: loaderRule, base: loaderBase, due, now, currentMeter: 4395 })).toBe("DUE");
      expect(evaluateDue({ rule: loaderRule, base: loaderBase, due, now, currentMeter: 4396 })).toBe("OVERDUE");
    });
    it("réalisée le 24/02/2026 à 4 378 h : prochaine échéance 4 628 h ou 24/05/2026", () => {
      const base = nextBaseline(loaderRule, due, { date: d("2026-02-24"), meter: 4378 });
      const next = computeDue(loaderRule, base);
      expect(next.dueMeter).toBe(4628);
      expect(iso(next.dueDate)).toBe("2026-05-24");
    });
  });

  describe("cas B : usage faible, la date déclenche", () => {
    it("passe en pré-alerte le 26/03/2026 (J−15)", () => {
      expect(evaluateDue({ rule: loaderRule, base: loaderBase, due, now: d("2026-03-25"), currentMeter: 4210 })).toBe("UPCOMING");
      expect(evaluateDue({ rule: loaderRule, base: loaderBase, due, now: d("2026-03-26"), currentMeter: 4210 })).toBe("PRE_ALERT");
    });
    it("est échue le 10/04/2026 et en retard après le 19/04/2026", () => {
      expect(evaluateDue({ rule: loaderRule, base: loaderBase, due, now: d("2026-04-10"), currentMeter: 4240 })).toBe("DUE");
      expect(evaluateDue({ rule: loaderRule, base: loaderBase, due, now: d("2026-04-19"), currentMeter: 4244 })).toBe("DUE");
      expect(evaluateDue({ rule: loaderRule, base: loaderBase, due, now: d("2026-04-20"), currentMeter: 4245 })).toBe("OVERDUE");
    });
    it("réalisée le 14/04/2026 à 4 245 h : prochaine échéance 4 495 h ou 14/07/2026", () => {
      const base = nextBaseline(loaderRule, due, { date: d("2026-04-14"), meter: 4245 });
      const next = computeDue(loaderRule, base);
      expect(next.dueMeter).toBe(4495);
      expect(iso(next.dueDate)).toBe("2026-07-14");
    });
  });
});

describe("Échéances fixes et glissantes (§4.3, PRV-04)", () => {
  const fixed: OperationRule = { mode: "FIXED", triggers: [{ kind: "METER", every: 250, meterType: "HOURS" }] };
  const sliding: OperationRule = { ...fixed, mode: "SLIDING" };
  const due = { dueDate: null, dueMeter: 1000 };

  it("prévu 1 000 h, réalisé 1 040 h : 1 250 h en mode fixe", () => {
    expect(computeDue(fixed, nextBaseline(fixed, due, { date: d("2026-05-01"), meter: 1040 })).dueMeter).toBe(1250);
  });
  it("prévu 1 000 h, réalisé 1 040 h : 1 290 h en mode glissant", () => {
    expect(computeDue(sliding, nextBaseline(sliding, due, { date: d("2026-05-01"), meter: 1040 })).dueMeter).toBe(1290);
  });
});

describe("Projection et génération (PRV-07, PRV-08)", () => {
  it("projette la date d'atteinte du seuil compteur", () => {
    const projected = projectMeterDate({ dueMeter: 4370, lastMeter: 4290, lastReadAt: d("2026-02-10"), dailyUsage: 8 });
    expect(iso(projected)).toBe("2026-02-20");
  });
  it("ne projette rien sans utilisation moyenne", () => {
    expect(projectMeterDate({ dueMeter: 4370, lastMeter: 4290, lastReadAt: d("2026-02-10"), dailyUsage: null })).toBeNull();
  });
  it("génère l'OT à la pré-alerte ou dans l'horizon de 14 jours", () => {
    expect(shouldGenerateWorkOrder("PRE_ALERT", null, d("2026-02-01"))).toBe(true);
    expect(shouldGenerateWorkOrder("UPCOMING", d("2026-02-14"), d("2026-02-01"))).toBe(true);
    expect(shouldGenerateWorkOrder("UPCOMING", d("2026-02-16"), d("2026-02-01"))).toBe(false);
  });
});

describe("Créneau proposé pour un OT généré", () => {
  it("cale le jour projeté à 06:00 UTC", () => {
    expect(suggestedStart(new Date("2026-10-07T20:56:00Z"))?.toISOString()).toBe("2026-10-07T06:00:00.000Z");
  });
  it("reporte un samedi ou un dimanche au lundi", () => {
    expect(suggestedStart(new Date("2026-10-10T20:56:00Z"))?.toISOString()).toBe("2026-10-12T06:00:00.000Z");
    expect(suggestedStart(new Date("2026-10-11T08:00:00Z"))?.toISOString()).toBe("2026-10-12T06:00:00.000Z");
  });
  it("renvoie null sans date", () => {
    expect(suggestedStart(null)).toBeNull();
  });
});

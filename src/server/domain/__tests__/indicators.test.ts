import { describe, expect, it } from "vitest";
import {
  describeIndicator,
  groupLabel,
  INDICATOR_DEFINITIONS,
  INDICATOR_SOURCES,
  monthLabel,
  validateIndicator,
  type IndicatorDefinition,
} from "../indicators";

const base: IndicatorDefinition = { name: "OT par statut", source: "work-orders", aggregate: "count", groupBy: "status", chart: "bar" };

describe("Indicateurs personnalisés : validation", () => {
  it("accepte un comptage regroupé et une somme filtrée sur une période", () => {
    expect(validateIndicator(base)).toEqual([]);
    expect(
      validateIndicator({
        name: "Coût prestataire des correctifs",
        source: "work-orders",
        aggregate: "sum",
        field: "externalCost",
        filterKey: "type",
        filterValue: "CORRECTIVE",
        periodDays: 90,
        chart: "number",
      }),
    ).toEqual([]);
  });

  it("refuse les combinaisons incohérentes, toutes signalées en une fois", () => {
    const errors = validateIndicator({
      name: "x",
      source: "equipment",
      aggregate: "sum",
      field: "externalCost",
      groupBy: "technician",
      filterKey: "site",
      filterValue: "LYON",
      periodDays: 12,
      chart: "number",
    });
    expect(errors).toEqual([
      "Champ « externalCost » indisponible pour équipements.",
      "Regroupement « technician » indisponible.",
      "Filtre « site » indisponible.",
      "Période inconnue.",
      "Une valeur unique ne se regroupe pas : choisir un graphique ou un tableau.",
    ]);
  });

  it("un graphique demande un regroupement, un comptage aucun champ", () => {
    expect(validateIndicator({ ...base, groupBy: null })).toEqual(["Un graphique ou un tableau demande un regroupement."]);
    expect(validateIndicator({ ...base, field: "externalCost" })).toEqual(["Un comptage ne porte pas sur un champ."]);
    expect(validateIndicator({ ...base, aggregate: "avg" })).toEqual(["Choisir le champ à moyenner."]);
  });

  it("chaque filtre proposé est une dimension à valeurs fixes de sa source", () => {
    for (const source of INDICATOR_SOURCES) {
      for (const dimension of INDICATOR_DEFINITIONS[source].dimensions.filter((d) => d.choices)) {
        const value = Object.keys(dimension.choices!)[0];
        expect(validateIndicator({ ...base, source, groupBy: null, chart: "number", filterKey: dimension.key, filterValue: value })).toEqual([]);
      }
    }
  });
});

describe("Indicateurs personnalisés : libellés", () => {
  it("traduit codes et mois, signale les valeurs vides", () => {
    expect(groupLabel("work-orders", "status", "CLOSED")).not.toBe("CLOSED");
    expect(groupLabel("work-orders", "month", "2026-03")).toBe("mars 2026");
    expect(groupLabel("work-orders", "site", "Dépôt Lyon")).toBe("Dépôt Lyon");
    expect(groupLabel("work-orders", "supplier", null)).toBe("Non renseigné");
    expect(monthLabel("pas un mois")).toBe("pas un mois");
  });

  it("décrit l'indicateur en une phrase", () => {
    expect(describeIndicator(base)).toBe("Nombre d'interventions à réaliser par statut");
    expect(
      describeIndicator({ name: "h", source: "labor", aggregate: "sum", field: "hours", groupBy: "technician", periodDays: 30, chart: "bar" }),
    ).toBe("Total : heures par technicien, 30 derniers jours (date du pointage)");
  });
});

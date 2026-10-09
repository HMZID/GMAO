import { describe, expect, it } from "vitest";
import {
  IMPORT_DEFINITIONS,
  canExecute,
  duplicateLines,
  mapHeaders,
  parseCell,
  parseRow,
  rowKey,
  secondaryDuplicateLines,
  simplifyCell,
  summarize,
  type ImportColumn,
} from "../imports";

const EQUIPMENT = IMPORT_DEFINITIONS.EQUIPMENT.columns;
const column = (key: string) => EQUIPMENT.find((c) => c.key === key) as ImportColumn;

describe("Imports : en-têtes (EQP-13)", () => {
  it("reconnaît les colonnes quel que soit l'ordre, la casse, les accents et l'astérisque", () => {
    const map = mapHeaders(["designation", "CODE PARC *", "Date de mise en service*", "Inconnue"], EQUIPMENT);
    expect(map.indexByKey).toMatchObject({ name: 0, code: 1, commissioningDate: 2 });
    expect(map.unknown).toEqual(["Inconnue"]);
    expect(map.missing).toEqual(expect.arrayContaining(["Société", "Site", "Catégorie", "Marque", "Numéro de série"]));
    expect(map.missing).not.toContain("Code parc");
  });
});

describe("Imports : cellules", () => {
  it("simplifie le texte enrichi, les formules et les liens", () => {
    expect(simplifyCell({ richText: [{ text: "PE-" }, { text: "021" }] })).toBe("PE-021");
    expect(simplifyCell({ formula: "A1*2", result: 42 })).toBe(42);
    expect(simplifyCell({ text: "site", hyperlink: "https://x" })).toBe("site");
    expect(simplifyCell(undefined)).toBeNull();
  });

  it("exige les colonnes obligatoires et laisse vides les facultatives", () => {
    expect(parseCell(null, column("code"))).toEqual({ ok: false, error: "Code parc : valeur obligatoire." });
    expect(parseCell("  ", column("registration"))).toEqual({ ok: true, value: undefined });
  });

  it("lit les dates Excel, françaises et ISO, et refuse une date impossible", () => {
    expect(parseCell(new Date(Date.UTC(2022, 3, 1)), column("commissioningDate"))).toEqual({ ok: true, value: new Date(Date.UTC(2022, 3, 1)) });
    expect(parseCell("01/04/2022", column("commissioningDate"))).toEqual({ ok: true, value: new Date(Date.UTC(2022, 3, 1)) });
    expect(parseCell("2022-04-01", column("commissioningDate"))).toEqual({ ok: true, value: new Date(Date.UTC(2022, 3, 1)) });
    expect(parseCell("31/02/2022", column("commissioningDate")).ok).toBe(false);
    expect(parseCell("avril 2022", column("commissioningDate")).ok).toBe(false);
  });

  it("lit les nombres à la française et contrôle les bornes", () => {
    expect(parseCell("185 000,50 €", column("acquisitionValue"))).toEqual({ ok: true, value: 185000.5 });
    expect(parseCell("-3", column("acquisitionValue")).ok).toBe(false);
    expect(parseCell("2022.5", column("year")).ok).toBe(false);
    expect(parseCell(1890, column("year")).ok).toBe(false);
    expect(parseCell("douze", column("primaryMeterValue")).ok).toBe(false);
  });

  it("traduit les libellés des listes et accepte le code anglais", () => {
    expect(parseCell("crédit-bail", column("acquisitionMode"))).toEqual({ ok: true, value: "LEASE" });
    expect(parseCell("HOURS", column("primaryMeterType"))).toEqual({ ok: true, value: "HOURS" });
    expect(parseCell("Leasing", column("acquisitionMode")).ok).toBe(false);
    const repairable = IMPORT_DEFINITIONS.PARTS.columns.find((c) => c.key === "isRepairable") as ImportColumn;
    expect(parseCell("Oui", repairable)).toEqual({ ok: true, value: true });
    expect(parseCell("peut-être", repairable).ok).toBe(false);
  });

  it("refuse un texte trop long", () => {
    expect(parseCell("X".repeat(41), column("code")).ok).toBe(false);
  });
});

describe("Imports : lignes", () => {
  const headers = mapHeaders(
    EQUIPMENT.map((c) => c.label),
    EQUIPMENT,
  ).indexByKey;

  it("liste toutes les anomalies d'une ligne en une fois (DON-11)", () => {
    const cells: (string | null)[] = EQUIPMENT.map(() => null);
    cells[headers.code] = "PE-021";
    cells[headers.year] = "deux mille";
    const row = parseRow(cells, EQUIPMENT, headers);
    expect(row.empty).toBe(false);
    expect(row.errors).toEqual(expect.arrayContaining(["Désignation : valeur obligatoire.", expect.stringContaining("Année : nombre attendu")]));
    expect(row.errors.length).toBeGreaterThanOrEqual(7);
  });

  it("ignore une ligne entièrement vide", () => {
    expect(parseRow(["", null, "  "], EQUIPMENT, headers).empty).toBe(true);
  });

  it("repère les doublons du fichier et garde la première occurrence", () => {
    const rows = [
      { line: 2, key: rowKey("EQUIPMENT", { code: "pe-021" }) },
      { line: 3, key: rowKey("EQUIPMENT", { code: "PE-022" }) },
      { line: 4, key: rowKey("EQUIPMENT", { code: " PE-021 " }) },
    ];
    const dups = duplicateLines(rows, "Code parc");
    expect([...dups.keys()]).toEqual([4]);
    expect(dups.get(4)).toContain("ligne 2");
  });

  it("repère les doublons marque + numéro de série (DON-12)", () => {
    const rows = [
      { line: 2, values: { manufacturer: "CAT", serialNumber: "123" } },
      { line: 3, values: { manufacturer: "cat", serialNumber: "123" } },
      { line: 4, values: { manufacturer: "CAT" } },
    ];
    expect([...secondaryDuplicateLines(rows, ["manufacturer", "serialNumber"], "Marque et numéro de série").keys()]).toEqual([3]);
  });

  it("clé du stock initial : article + magasin", () => {
    expect(rowKey("INITIAL_STOCK", { sku: "flt-1", warehouseCode: "mag" })).toBe("FLT-1|MAG");
  });
});

describe("Imports : exécution (§11.2)", () => {
  it("refuse « tout ou rien » s'il reste une erreur, accepte « lignes valides »", () => {
    const summary = summarize([{ status: "READY" }, { status: "ERROR" }, { status: "EXISTS" }]);
    expect(summary).toEqual({ total: 3, ready: 1, exists: 1, errors: 1, imported: 0 });
    expect(canExecute("ALL_OR_NOTHING", summary).ok).toBe(false);
    expect(canExecute("VALID_ONLY", summary).ok).toBe(true);
  });

  it("refuse un import sans ligne à créer (fichier déjà importé)", () => {
    expect(canExecute("VALID_ONLY", summarize([{ status: "EXISTS" }])).ok).toBe(false);
  });
});

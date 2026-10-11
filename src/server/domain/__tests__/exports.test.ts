import { describe, expect, it } from "vitest";
import { csvCell, EXPORT_DATASETS, EXPORT_DEFINITIONS, exportFileName, labelOf, toCsv } from "../exports";

describe("Exports : définitions", () => {
  it("chaque jeu de données a un identifiant, une date de modification et un onglet Excel valide", () => {
    for (const dataset of EXPORT_DATASETS) {
      const definition = EXPORT_DEFINITIONS[dataset];
      expect(definition.columns[0].key, dataset).toBe("id");
      expect(
        definition.columns.some((c) => c.key === definition.changedAt),
        dataset,
      ).toBe(true);
      expect(definition.sheet.length, dataset).toBeLessThanOrEqual(31);
      expect(new Set(definition.columns.map((c) => c.key)).size, dataset).toBe(definition.columns.length);
    }
  });

  it("libellés des codes pour Excel, code inchangé s'il est inconnu", () => {
    const status = EXPORT_DEFINITIONS["work-orders"].columns.find((c) => c.key === "status")!;
    expect(labelOf(status, "CLOSED")).not.toBe("CLOSED");
    expect(labelOf(status, "INCONNU")).toBe("INCONNU");
    expect(labelOf(status, null)).toBeNull();
  });
});

describe("Exports : CSV", () => {
  it("met en forme dates, booléens, vides et guillemets", () => {
    expect(csvCell(new Date(Date.UTC(2026, 9, 11, 8, 30)))).toBe("2026-10-11T08:30:00.000Z");
    expect(csvCell(true)).toBe("true");
    expect(csvCell(null)).toBe("");
    expect(csvCell(41.5)).toBe("41.5");
    expect(csvCell('Pelle "25 t", chenilles')).toBe('"Pelle ""25 t"", chenilles"');
    expect(csvCell("ligne 1\nligne 2")).toBe('"ligne 1\nligne 2"');
  });

  it("neutralise les formules à l'ouverture dans un tableur", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell(-12)).toBe("-12");
  });

  it("en-têtes = clés des colonnes, BOM UTF-8 et fins de ligne CRLF", () => {
    const csv = toCsv(
      [
        { key: "code", label: "Code", type: "text" },
        { key: "active", label: "Actif", type: "boolean" },
      ],
      [
        { code: "PE-007", active: true },
        { code: "CH-012", active: false },
      ],
    );
    expect(csv).toBe("﻿code,active\r\nPE-007,true\r\nCH-012,false\r\n");
  });

  it("nom de fichier daté", () => {
    expect(exportFileName("equipment", "csv", new Date(Date.UTC(2026, 9, 11)))).toBe("gmao-equipment-2026-10-11.csv");
  });
});

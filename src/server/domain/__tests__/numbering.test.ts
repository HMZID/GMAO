import { describe, expect, it } from "vitest";
import { numberingYear } from "../numbering";

describe("Numérotation : année dans le fuseau d'exploitation (COR-05)", () => {
  it("le 1er janvier entre 0 h et 1 h à Paris compte pour l'année nouvelle", () => {
    // 31/12/2026 23:30 UTC = 01/01/2027 00:30 à Paris (heure d'hiver, UTC+1).
    expect(numberingYear(new Date("2026-12-31T23:30:00Z"))).toBe(2027);
  });

  it("le 31 décembre au soir à Paris reste dans l'année en cours", () => {
    expect(numberingYear(new Date("2026-12-31T22:59:59Z"))).toBe(2026);
    expect(numberingYear(new Date("2026-07-14T10:00:00Z"))).toBe(2026);
  });
});

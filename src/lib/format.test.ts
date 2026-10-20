import { describe, expect, it } from "vitest";
import { formatCurrency, formatDate, formatHours, formatNumber, formatPercent } from "./format";
import { withLocale } from "@/i18n/request-locale";

/** Espaces insécables des formats français ramenés à une espace simple. */
const spaced = (text: string) => text.replace(/\s/g, " ");

const day = new Date("2026-10-20T12:00:00Z");

describe("formats selon la langue", () => {
  it("français par défaut", () => {
    expect(formatDate(day)).toBe("20/10/2026");
    expect(spaced(formatNumber(1234.5))).toBe("1 234,5");
    expect(formatPercent(null)).toBe("n. s.");
    expect(formatHours(2)).toBe("2 h");
  });

  it("anglais : séparateurs et libellés de la langue", () => {
    withLocale("en", () => {
      expect(formatDate(day)).toBe("20/10/2026");
      expect(formatNumber(1234.5)).toBe("1,234.5");
      expect(formatPercent(null)).toBe("n/a");
      expect(formatCurrency(1500)).toContain("1,500");
    });
  });

  it("arabe : chiffres latins (usage tunisien) et unités arabes, puis retour au français", () => {
    withLocale("ar", () => {
      expect(formatNumber(1234.5)).toMatch(/^1.?234[.,]5$/);
      expect(formatHours(2)).toBe("2 س");
    });
    expect(spaced(formatNumber(1234.5))).toBe("1 234,5");
  });
});

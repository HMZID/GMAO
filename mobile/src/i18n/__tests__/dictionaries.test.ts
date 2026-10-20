import { describe, expect, it } from "vitest";
import { collectMobileKeys, collectMobileRawText } from "../../../../scripts/i18n-mobile.mjs";
import { INTL_LOCALE, LOCALES, localeFromDevice } from "../config";
import { DICTIONARIES } from "../dictionaries";
import { interpolate, translate } from "../translate";

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const { en, ar } = DICTIONARIES;

describe("langues de l'application mobile", () => {
  it("français, anglais, arabe ; langue de l'appareil sinon français", () => {
    expect([...LOCALES]).toEqual(["fr", "en", "ar"]);
    expect(localeFromDevice("ar-TN")).toBe("ar");
    expect(localeFromDevice("en-US")).toBe("en");
    expect(localeFromDevice("de-DE")).toBe("fr");
    expect(localeFromDevice(undefined)).toBe("fr");
    expect(INTL_LOCALE.ar).toContain("latn");
  });

  it("traduit par texte source, un texte inconnu reste en français", () => {
    expect(translate({ Annuler: "Cancel" }, "Annuler")).toBe("Cancel");
    expect(translate({}, "Annuler")).toBe("Annuler");
    expect(translate({ "{n} min": "{n} min" }, "{n} min", { n: 15 })).toBe("15 min");
    expect(interpolate("{a} et {b}", { a: 1 })).toBe("1 et {b}");
  });
});

describe("dictionnaires de l'application mobile", () => {
  it("ont les mêmes clés et aucune valeur vide", () => {
    expect(Object.keys(ar).sort()).toEqual(Object.keys(en).sort());
    for (const [key, value] of [...Object.entries(en), ...Object.entries(ar)]) expect(value.trim(), key).not.toBe("");
  });

  it("gardent les mêmes valeurs à insérer que le texte français", () => {
    for (const key of Object.keys(en)) {
      expect(placeholders(en[key]), `EN : ${key}`).toEqual(placeholders(key));
      expect(placeholders(ar[key]), `AR : ${key}`).toEqual(placeholders(key));
    }
  });

  it("chaque texte de l'application est traduit en anglais et en arabe", () => {
    const missing = collectMobileKeys().filter((key) => !(key in en) || !(key in ar));
    expect(missing, `Textes à traduire (mobile/src/i18n/dictionaries.ts) :\n${missing.join("\n")}`).toEqual([]);
  });

  it("aucun texte JSX en dur : tout passe par t() ou un composant qui traduit", () => {
    expect(collectMobileRawText()).toEqual([]);
  });
});

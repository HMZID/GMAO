import { describe, expect, it } from "vitest";
import { collectKeys } from "../../../scripts/i18n-keys.mjs";
import { ar } from "../dictionaries/ar";
import { en } from "../dictionaries/en";

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("dictionnaires anglais et arabe", () => {
  it("ont les mêmes clés", () => {
    expect(Object.keys(ar).sort()).toEqual(Object.keys(en).sort());
  });

  it("n'ont aucune valeur vide", () => {
    for (const [key, value] of [...Object.entries(en), ...Object.entries(ar)]) expect(value.trim(), key).not.toBe("");
  });

  it("gardent les mêmes valeurs à insérer ({nom}, {1}) que le texte français", () => {
    for (const key of Object.keys(en)) {
      expect(placeholders(en[key]), `EN : ${key}`).toEqual(placeholders(key));
      expect(placeholders(ar[key]), `AR : ${key}`).toEqual(placeholders(key));
    }
  });

  it("l'arabe contient des lettres arabes (hors mots techniques inchangés)", () => {
    const arabic = /[\u0600-\u06FF]/;
    const untranslated = Object.entries(ar).filter(([key, value]) => key !== value && !arabic.test(value));
    // Rares textes techniques identiques dans toutes les langues (codes, adresses).
    expect(untranslated.map(([key]) => key).filter((key) => /[a-zà-ÿ]{4,}/i.test(key) && !/^[A-Za-z0-9 ./_{}:·-]+$/.test(key))).toEqual([]);
  });
});

describe("couverture des textes du code", () => {
  it("chaque texte français de l'interface a sa traduction en anglais et en arabe", () => {
    const keys: string[] = collectKeys();
    const missing = keys.filter((key) => !(key in en) || !(key in ar));
    expect(missing, `Textes à traduire (src/i18n/dictionaries) :\n${missing.join("\n")}`).toEqual([]);
  });
});

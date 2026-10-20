import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, LOCALES, directionOf, isLocale } from "../config";
import { interpolate, templateKey, tpl, translate } from "../translate";

describe("langues", () => {
  it("français par défaut, anglais et arabe en plus", () => {
    expect(DEFAULT_LOCALE).toBe("fr");
    expect([...LOCALES]).toEqual(["fr", "en", "ar"]);
    expect(isLocale("ar")).toBe(true);
    expect(isLocale("de")).toBe(false);
  });

  it("l'arabe s'écrit de droite à gauche", () => {
    expect(directionOf("ar")).toBe("rtl");
    expect(directionOf("en")).toBe("ltr");
    expect(directionOf("fr")).toBe("ltr");
  });
});

describe("translate", () => {
  const dict = { Enregistrer: "Save", "Bonjour {name}": "Hello {name}", "Réformé le {1}": "Retired on {1}" };

  it("traduit par texte source et laisse le français si le texte est absent", () => {
    expect(translate(dict, "Enregistrer")).toBe("Save");
    expect(translate(dict, "Texte inconnu")).toBe("Texte inconnu");
  });

  it("remplace les paramètres, un paramètre absent garde son accolade", () => {
    expect(translate(dict, "Bonjour {name}", { name: "Sami" })).toBe("Hello Sami");
    expect(interpolate("{a} et {b}", { a: 1 })).toBe("1 et {b}");
    expect(interpolate("{a}", { a: null })).toBe("");
  });

  it("les gabarits tpl retrouvent leur phrase et replacent les valeurs", () => {
    const text = tpl`Réformé le ${"01/02/2026"}`;
    expect(templateKey(text)).toEqual({ key: "Réformé le {1}", args: ["01/02/2026"] });
    expect(translate(dict, text)).toBe("Retired on 01/02/2026");
  });

  it("un gabarit sans traduction s'affiche en français, sans séparateurs invisibles", () => {
    const text = tpl`Société ${"SBTP"}`;
    expect(translate(dict, text)).toBe("Société SBTP");
    expect(translate({}, tpl`Aucun`)).toBe("Aucun");
  });

  it("l'ordre des valeurs peut changer d'une langue à l'autre", () => {
    const text = tpl`${"A"} sur ${"B"}`;
    expect(translate({ "{1} sur {2}": "{2} / {1}" }, text)).toBe("B / A");
  });
});

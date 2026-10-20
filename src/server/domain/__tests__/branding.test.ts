import { plainText } from "@/i18n/translate";
import { describe, expect, it } from "vitest";
import { brandLabel, checkLogo, MAX_LOGO_BYTES } from "../branding";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0]);
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

describe("checkLogo", () => {
  it("accepte un PNG dont le contenu correspond", () => {
    expect(checkLogo({ name: "logo.png", size: 2048, head: PNG })).toEqual({ ok: true, contentType: "image/png" });
  });

  it("refuse un PDF, un SVG et un fichier renommé", () => {
    expect(checkLogo({ name: "logo.pdf", size: 2048, head: PDF }).ok).toBe(false);
    expect(checkLogo({ name: "logo.svg", size: 2048, head: PNG }).ok).toBe(false);
    const renamed = checkLogo({ name: "logo.jpg", size: 2048, head: PNG });
    expect({ ...renamed, errors: renamed.ok ? [] : renamed.errors.map(plainText) }).toEqual({
      ok: false,
      errors: ["Le contenu du fichier ne correspond pas à son extension .jpg."],
    });
  });

  it("liste toutes les anomalies en une fois", () => {
    const result = checkLogo({ name: "logo.gif", size: MAX_LOGO_BYTES + 1, head: PNG });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toHaveLength(2);
  });
});

describe("brandLabel", () => {
  it("préfère le nom affiché, sinon le nom du groupe", () => {
    expect(brandLabel({ name: "Groupe SBTP", displayName: "SBTP Maintenance" })).toBe("SBTP Maintenance");
    expect(brandLabel({ name: "Groupe SBTP", displayName: "  " })).toBe("Groupe SBTP");
    expect(brandLabel({ name: "Groupe SBTP", displayName: null })).toBe("Groupe SBTP");
  });
});

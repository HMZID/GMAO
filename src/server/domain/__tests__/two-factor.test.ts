import { describe, expect, it } from "vitest";
import { adminTwoFactorEnforced, needsTwoFactorSetup, normalizeBackupCode, normalizeTotpCode } from "../two-factor";

describe("Double authentification de l'administrateur de la plateforme (TEC-04)", () => {
  it("est obligatoire sur Vercel, facultative en local, réglable par variable", () => {
    expect(adminTwoFactorEnforced({ vercelEnv: "production" })).toBe(true);
    expect(adminTwoFactorEnforced({ vercelEnv: "preview" })).toBe(true);
    expect(adminTwoFactorEnforced({})).toBe(false);
    expect(adminTwoFactorEnforced({ flag: "false", vercelEnv: "production" })).toBe(false);
    expect(adminTwoFactorEnforced({ flag: "true" })).toBe(true);
  });

  it("n'est à configurer que par un administrateur de la plateforme qui ne l'a pas encore activée", () => {
    expect(needsTwoFactorSetup({ platformAdmin: true, enabled: false, enforced: true })).toBe(true);
    expect(needsTwoFactorSetup({ platformAdmin: true, enabled: true, enforced: true })).toBe(false);
    expect(needsTwoFactorSetup({ platformAdmin: false, enabled: false, enforced: true })).toBe(false);
    expect(needsTwoFactorSetup({ platformAdmin: true, enabled: false, enforced: false })).toBe(false);
  });
});

describe("Codes saisis", () => {
  it("accepte un code à 6 chiffres, espaces compris", () => {
    expect(normalizeTotpCode("123 456")).toBe("123456");
    expect(normalizeTotpCode("12345")).toBeNull();
    expect(normalizeTotpCode("abcdef")).toBeNull();
  });

  it("accepte un code de secours, refuse le reste", () => {
    expect(normalizeBackupCode(" Ab3dE-fG7hJ ")).toBe("Ab3dE-fG7hJ");
    expect(normalizeBackupCode("a; drop table")).toBeNull();
  });
});

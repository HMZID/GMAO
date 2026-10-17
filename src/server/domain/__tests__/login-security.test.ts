import { describe, expect, it } from "vitest";
import { breachCountInRange, captchaRefusals, clientIp, isLoginBlocked, LOGIN_LIMITS, safeRedirectPath } from "../login-security";

describe("Destination après connexion", () => {
  it("garde un chemin de l'application, avec sa recherche", () => {
    expect(safeRedirectPath("/ordres-de-travail?status=OPEN")).toBe("/ordres-de-travail?status=OPEN");
    expect(safeRedirectPath("/")).toBe("/");
  });

  it("refuse toute adresse externe, y compris les formes déguisées", () => {
    for (const next of [
      "https://pirate.example",
      "//pirate.example",
      "/\\pirate.example",
      "/\\/pirate.example",
      "\\\\pirate.example",
      "/%09/pirate.example".replace("%09", "\t"),
      "javascript:alert(1)",
      "",
      null,
      undefined,
    ]) {
      expect(safeRedirectPath(next), String(next)).toBe("/");
    }
  });
});

describe("Limitation des tentatives de connexion", () => {
  it("bloque au 5e échec du même compte depuis la même adresse", () => {
    expect(isLoginBlocked({ accountAndIp: 4, account: 4, ip: 4 })).toBe(false);
    expect(isLoginBlocked({ accountAndIp: LOGIN_LIMITS.perAccountAndIp, account: 5, ip: 5 })).toBe(true);
  });

  it("bloque une attaque distribuée sur un compte ou un balayage de comptes depuis une adresse", () => {
    expect(isLoginBlocked({ accountAndIp: 0, account: LOGIN_LIMITS.perAccount, ip: 0 })).toBe(true);
    expect(isLoginBlocked({ accountAndIp: 0, account: 0, ip: LOGIN_LIMITS.perIp })).toBe(true);
  });
});

describe("Réponse du CAPTCHA (Turnstile)", () => {
  const expected = { action: "login", hostnames: ["gmao.example.fr"] };

  it("accepte une réponse réussie pour la bonne action et le bon nom de domaine", () => {
    expect(captchaRefusals({ success: true, action: "login", hostname: "gmao.example.fr" }, expected)).toEqual([]);
  });

  it("refuse un échec, une autre action ou un autre site", () => {
    expect(captchaRefusals({ success: false, "error-codes": ["timeout-or-duplicate"] }, expected)[0]).toContain("timeout-or-duplicate");
    expect(captchaRefusals({ success: true, action: "essai", hostname: "gmao.example.fr" }, expected)).toHaveLength(1);
    expect(captchaRefusals({ success: true, action: "login", hostname: "autre.example" }, expected)).toHaveLength(1);
  });
});

describe("Adresse IP du client", () => {
  it("prend la première adresse transmise par le proxy", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" });
    expect(clientIp(headers)).toBe("203.0.113.7");
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientIp(new Headers())).toBeNull();
  });
});

describe("Mots de passe divulgués (Have I Been Pwned)", () => {
  // Réponse de /range/{5 premiers caractères} : suffixe de l'empreinte et nombre de fuites ; « :0 » = remplissage.
  const body = "0018A45C4D1DEF81644B54AB7F969B88D65:10\r\n00D4F6E8FA6EECAD2A3AA415EEC418D38EC:2\r\n011053FD0102E94D6AE2F8B83D76FAF94F6:0";

  it("trouve le suffixe sans tenir compte de la casse, et renvoie le nombre de fuites", () => {
    expect(breachCountInRange(body, "00d4f6e8fa6eecad2a3aa415eec418d38ec")).toBe(2);
  });

  it("ignore les lignes de remplissage et un suffixe absent", () => {
    expect(breachCountInRange(body, "011053FD0102E94D6AE2F8B83D76FAF94F6")).toBe(0);
    expect(breachCountInRange(body, "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF")).toBe(0);
  });
});

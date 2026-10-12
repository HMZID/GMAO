import { describe, expect, it } from "vitest";
import { signImpersonation, verifyImpersonation } from "../impersonation";

const secret = "secret-de-test-0123456789abcdef0123";
const now = new Date("2026-10-12T10:00:00Z");
const valid = { adminId: "admin-1", targetId: "user-2", expiresAt: now.getTime() + 60_000 };

describe("Connexion « en tant que »", () => {
  it("vérifie un jeton signé par le serveur et non expiré", () => {
    expect(verifyImpersonation(signImpersonation(valid, secret), secret, now)).toEqual({ adminId: "admin-1", targetId: "user-2" });
  });

  it("refuse un jeton expiré, falsifié ou signé avec un autre secret", () => {
    expect(verifyImpersonation(signImpersonation({ ...valid, expiresAt: now.getTime() - 1 }, secret), secret, now)).toBeNull();
    const token = signImpersonation(valid, secret);
    expect(verifyImpersonation(token.replace("user-2", "user-3"), secret, now)).toBeNull();
    expect(verifyImpersonation(token, "autre-secret-0123456789abcdef0123", now)).toBeNull();
    expect(verifyImpersonation("n'importe quoi", secret, now)).toBeNull();
    expect(verifyImpersonation(undefined, secret, now)).toBeNull();
  });

  it("refuse de se prendre soi-même pour cible", () => {
    expect(verifyImpersonation(signImpersonation({ ...valid, targetId: "admin-1" }, secret), secret, now)).toBeNull();
  });
});

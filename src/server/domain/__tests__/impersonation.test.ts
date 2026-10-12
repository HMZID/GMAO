import { describe, expect, it } from "vitest";
import { impersonationRefusals, signImpersonation, verifyImpersonation } from "../impersonation";

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

describe("Connexion « en tant que » : qui peut être visé", () => {
  const target = { id: "user-2", isActive: true, isPlatformAdmin: false };

  it("autorise un utilisateur actif d'une organisation", () => {
    expect(impersonationRefusals({ adminId: "admin-1", alreadyImpersonating: false, target })).toEqual([]);
  });

  it("refuse un autre administrateur de la plateforme et un compte désactivé, avec toutes les raisons", () => {
    expect(
      impersonationRefusals({ adminId: "admin-1", alreadyImpersonating: false, target: { ...target, isPlatformAdmin: true, isActive: false } }),
    ).toEqual(["Impossible de prendre la place d'un autre administrateur de la plateforme.", "Ce compte est désactivé : le réactiver d'abord."]);
  });

  it("refuse soi-même et une connexion en cascade", () => {
    expect(impersonationRefusals({ adminId: "admin-1", alreadyImpersonating: false, target: { ...target, id: "admin-1" } })).toHaveLength(1);
    expect(impersonationRefusals({ adminId: "admin-1", alreadyImpersonating: true, target })).toEqual(["Revenir d'abord à votre compte."]);
  });
});

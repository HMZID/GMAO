import { describe, expect, it } from "vitest";
import { buildAuthContext, restrictAuthContext } from "@/server/authz/context";
import { API_KEY_PERMISSIONS, API_KEY_ROLES, apiKeyFromHeaders, apiKeyState, generateApiKey, hashApiKey, isApiKey } from "../api-keys";

describe("Clés d'API : génération et reconnaissance", () => {
  it("génère une clé préfixée, unique, dont seule l'empreinte est conservée", () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.key).toMatch(/^gmk_[A-Za-z0-9_-]{40}$/);
    expect(a.key).not.toBe(b.key);
    expect(a.prefix).toBe(a.key.slice(0, 12));
    expect(a.hash).toBe(hashApiKey(a.key));
    expect(a.hash).toHaveLength(64);
  });

  it("distingue une clé d'un jeton de session", () => {
    expect(isApiKey(generateApiKey().key)).toBe(true);
    expect(isApiKey("Jx8sYhT3kq0aBc.session-token")).toBe(false);
    expect(isApiKey("gmk_court")).toBe(false);
  });

  it("lit la clé dans Authorization: Bearer ou X-Api-Key", () => {
    const { key } = generateApiKey();
    expect(apiKeyFromHeaders(new Headers({ authorization: `Bearer ${key}` }))).toBe(key);
    expect(apiKeyFromHeaders(new Headers({ "x-api-key": key }))).toBe(key);
    expect(apiKeyFromHeaders(new Headers({ authorization: "Bearer jeton-de-session" }))).toBeNull();
  });

  it("état : révoquée, expirée ou active", () => {
    const now = new Date("2026-10-11T10:00:00Z");
    expect(apiKeyState({ revokedAt: null, expiresAt: null }, now)).toBe("ACTIVE");
    expect(apiKeyState({ revokedAt: null, expiresAt: new Date("2026-10-11T09:00:00Z") }, now)).toBe("EXPIRED");
    expect(apiKeyState({ revokedAt: new Date("2026-10-01"), expiresAt: null }, now)).toBe("REVOKED");
  });
});

describe("Clés d'API : droits", () => {
  const ctx = buildAuthContext(
    { id: "u1", tenantId: "t1", name: "Connecteur", email: "admin@example.com" },
    API_KEY_ROLES.map((role) => ({ role, scopeType: "TENANT" as const, scopeId: null })),
  );

  it("lecture : export et lecture, aucune écriture ni administration", () => {
    const read = restrictAuthContext(ctx, API_KEY_PERMISSIONS.READ);
    expect(read.can("data.export")).toBe(true);
    expect(read.can("workorder.read")).toBe(true);
    expect(read.can("equipment.write")).toBe(false);
    expect(read.can("users.manage")).toBe(false);
    expect(read.can("settings.manage")).toBe(false);
  });

  it("assistant IA : lecture et signalement de pannes, sans autre écriture", () => {
    const assistant = restrictAuthContext(ctx, API_KEY_PERMISSIONS.ASSISTANT);
    expect(assistant.can("request.create")).toBe(true);
    expect(assistant.can("workorder.read")).toBe(true);
    expect(assistant.can("request.qualify")).toBe(false);
    expect(assistant.can("equipment.write")).toBe(false);
  });

  it("import : droits de création des imports, jamais le paramétrage ni l'exécution des OT", () => {
    const write = restrictAuthContext(ctx, API_KEY_PERMISSIONS.IMPORT);
    for (const permission of ["equipment.write", "part.write", "stock.move", "supplier.write", "users.manage"] as const) {
      expect(write.can(permission), permission).toBe(true);
    }
    expect(write.can("settings.manage")).toBe(false);
    expect(write.can("workorder.manage")).toBe(false);
    expect(write.can("audit.read")).toBe(false);
  });
});

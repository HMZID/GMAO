import { describe, expect, it } from "vitest";
import { buildAuthContext, isInScope, restrictAuthContext } from "../context";
import { PERMISSIONS, roleHas } from "../permissions";

const user = { id: "u1", tenantId: "t1", name: "Test", email: "t@example.com" };

describe("Contexte d'autorisation (HAB-02, HAB-03)", () => {
  it("cumule plusieurs couples rôle × périmètre", () => {
    const ctx = buildAuthContext(user, [
      { role: "WORKSHOP_MANAGER", scopeType: "SITE", scopeId: "site-a" },
      { role: "TECHNICIAN", scopeType: "SITE", scopeId: "site-b" },
    ]);
    // Chef d'atelier sur A : peut qualifier une DI sur A, pas sur B
    expect(ctx.canOn("request.qualify", { companyId: "c1", siteId: "site-a" })).toBe(true);
    expect(ctx.canOn("request.qualify", { companyId: "c1", siteId: "site-b" })).toBe(false);
    // Technicien sur B : peut exécuter sur B
    expect(ctx.canOn("workorder.execute", { companyId: "c1", siteId: "site-b" })).toBe(true);
    expect(ctx.scope("workorder.read")).toEqual({ all: false, companyIds: [], siteIds: ["site-a", "site-b"] });
  });

  it("un périmètre TENANT couvre tout le groupe", () => {
    const ctx = buildAuthContext(user, [{ role: "PURCHASING_MANAGER", scopeType: "TENANT", scopeId: null }]);
    expect(ctx.scope("kpi.read")).toEqual({ all: true });
    expect(ctx.can("equipment.write")).toBe(false);
  });

  it("un périmètre SOCIÉTÉ couvre tous ses sites", () => {
    const ctx = buildAuthContext(user, [{ role: "FLEET_MANAGER", scopeType: "COMPANY", scopeId: "c1" }]);
    expect(ctx.canOn("equipment.write", { companyId: "c1", siteId: "any" })).toBe(true);
    expect(ctx.canOn("equipment.write", { companyId: "c2", siteId: "any" })).toBe(false);
  });

  it("une délégation expire automatiquement à sa date de fin (HAB-03)", () => {
    const assignments = [
      {
        role: "MAINTENANCE_MANAGER" as const,
        scopeType: "TENANT" as const,
        scopeId: null,
        validFrom: new Date("2026-03-01"),
        validTo: new Date("2026-03-15"),
      },
    ];
    expect(buildAuthContext(user, assignments, { now: new Date("2026-03-10") }).can("plan.write")).toBe(true);
    expect(buildAuthContext(user, assignments, { now: new Date("2026-03-16") }).can("plan.write")).toBe(false);
  });

  it("sans affectation, aucun droit n'est accordé (refus par défaut)", () => {
    const ctx = buildAuthContext(user, []);
    expect(ctx.can("equipment.read")).toBe(false);
    expect(isInScope(ctx.scope("equipment.read"), { companyId: "c1", siteId: "s1" })).toBe(false);
  });
});

describe("Contexte restreint (clés d'API, couche MCP)", () => {
  it("retire les droits hors liste, garde le périmètre des autres", () => {
    const ctx = buildAuthContext(user, [{ role: "EXECUTIVE", scopeType: "TENANT", scopeId: null }]);
    const restricted = restrictAuthContext(ctx, ["equipment.read", "equipment.write"]);
    expect(restricted.can("equipment.write")).toBe(true);
    expect(restricted.scope("equipment.read")).toEqual({ all: true });
    expect(restricted.can("users.manage")).toBe(false);
    expect(restricted.scope("users.manage")).toEqual({ all: false, companyIds: [], siteIds: [] });
    expect(restricted.canOn("settings.manage", { companyId: "c1" })).toBe(false);
  });

  it("n'ajoute jamais un droit que les rôles ne donnent pas", () => {
    const ctx = buildAuthContext(user, [{ role: "OPERATOR", scopeType: "SITE", scopeId: "s1" }]);
    expect(restrictAuthContext(ctx, ["data.export"]).can("data.export")).toBe(false);
  });
});

describe("Rôles : plateforme et organisation", () => {
  it("l'administrateur gère la plateforme, sans aucun droit sur la maintenance des organisations", () => {
    expect(roleHas("ADMIN", "platform.manage")).toBe(true);
    for (const permission of PERMISSIONS.filter((p) => p !== "platform.manage")) expect(roleHas("ADMIN", permission), permission).toBe(false);
  });

  it("la direction et le responsable maintenance ont tous les droits de l'organisation, pas ceux de la plateforme", () => {
    // Le seuil de validation des interventions est réservé à la direction (HAB-04).
    const executiveOnly = ["approval.threshold"];
    for (const role of ["EXECUTIVE", "MAINTENANCE_MANAGER"] as const) {
      for (const permission of PERMISSIONS.filter((p) => p !== "platform.manage" && !executiveOnly.includes(p)))
        expect(roleHas(role, permission), `${role} ${permission}`).toBe(true);
      expect(roleHas(role, "platform.manage")).toBe(false);
    }
  });

  it("seule la direction fixe le seuil de validation des interventions", () => {
    expect(roleHas("EXECUTIVE", "approval.threshold")).toBe(true);
    for (const role of ["MAINTENANCE_MANAGER", "WORKSHOP_MANAGER", "TECHNICIAN", "FLEET_MANAGER", "ADMIN"] as const) {
      expect(roleHas(role, "approval.threshold"), role).toBe(false);
    }
  });

  it("les autres membres ne voient que leur partie", () => {
    expect(roleHas("OPERATOR", "request.create")).toBe(true);
    expect(roleHas("OPERATOR", "stock.read")).toBe(false);
    expect(roleHas("TECHNICIAN", "users.manage")).toBe(false);
    expect(roleHas("STOREKEEPER", "stock.move")).toBe(true);
    expect(roleHas("STOREKEEPER", "workorder.manage")).toBe(false);
  });
});

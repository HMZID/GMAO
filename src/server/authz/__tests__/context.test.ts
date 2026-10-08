import { describe, expect, it } from "vitest";
import { buildAuthContext, isInScope } from "../context";

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
    const ctx = buildAuthContext(user, [{ role: "EXECUTIVE", scopeType: "TENANT", scopeId: null }]);
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

import { describe, expect, it } from "vitest";
import { companyCodeFrom, demoEndsAt, platformAdmins, tenantAccess } from "../tenants";

const now = new Date("2026-10-11T10:00:00Z");

describe("Organisations : accès", () => {
  it("active : accès sans échéance", () => {
    expect(tenantAccess({ status: "ACTIVE", demoEndsAt: null }, now)).toEqual({ allowed: true, demo: null });
  });

  it("démonstration en cours : jours restants, arrondis au jour supérieur", () => {
    const access = tenantAccess({ status: "DEMO", demoEndsAt: new Date("2026-10-13T09:00:00Z") }, now);
    expect(access).toEqual({ allowed: true, demo: { endsAt: new Date("2026-10-13T09:00:00Z"), daysLeft: 2 } });
  });

  it("démonstration échue ou sans date : accès refusé ; suspendue : refusé", () => {
    expect(tenantAccess({ status: "DEMO", demoEndsAt: new Date("2026-10-11T10:00:00Z") }, now)).toEqual({ allowed: false, reason: "DEMO_EXPIRED" });
    expect(tenantAccess({ status: "DEMO", demoEndsAt: null }, now)).toEqual({ allowed: false, reason: "DEMO_EXPIRED" });
    expect(tenantAccess({ status: "SUSPENDED", demoEndsAt: null }, now)).toEqual({ allowed: false, reason: "SUSPENDED" });
  });
});

describe("Organisations : durée de démonstration", () => {
  it("part de maintenant, ou prolonge une fin encore à venir", () => {
    expect(demoEndsAt(now, 14)).toEqual(new Date("2026-10-25T10:00:00Z"));
    expect(demoEndsAt(now, 7, new Date("2026-10-20T10:00:00Z"))).toEqual(new Date("2026-10-27T10:00:00Z"));
    // Démonstration déjà échue : la prolongation repart de maintenant.
    expect(demoEndsAt(now, 7, new Date("2026-10-01T10:00:00Z"))).toEqual(new Date("2026-10-18T10:00:00Z"));
  });
});

describe("Organisations : paramètres", () => {
  it("lit la liste des administrateurs de la plateforme", () => {
    expect([...platformAdmins(" Admin@Demo.gmao, ops@exemple.fr ;x@y.z ")]).toEqual(["admin@demo.gmao", "ops@exemple.fr", "x@y.z"]);
    expect(platformAdmins(undefined).size).toBe(0);
  });

  it("tire un code de société du nom", () => {
    expect(companyCodeFrom("Travaux Publics Rhône-Alpes")).toBe("TRAVAUXPUB");
    expect(companyCodeFrom("Sté Énergie 2000")).toBe("STEENERGIE");
    expect(companyCodeFrom("***")).toBe("ORG");
  });
});

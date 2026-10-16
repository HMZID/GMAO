import { describe, expect, it } from "vitest";
import { checkDatabaseForEnvironment, deploymentEnvironment } from "../deployment";

describe("Environnements de déploiement", () => {
  it("associe la construction Vercel à son environnement", () => {
    expect(deploymentEnvironment("production")).toBe("production");
    expect(deploymentEnvironment("preview")).toBe("development");
    expect(deploymentEnvironment(undefined)).toBeNull();
  });

  it("refuse de brancher le développement sur la base de production, et l'inverse", () => {
    expect(checkDatabaseForEnvironment({ target: "development", marker: "production", hasData: true }).ok).toBe(false);
    expect(checkDatabaseForEnvironment({ target: "production", marker: "development", hasData: true }).ok).toBe(false);
  });

  it("refuse au développement une base existante non marquée (peut-être la production)", () => {
    const check = checkDatabaseForEnvironment({ target: "development", marker: null, hasData: true });
    expect(check.ok).toBe(false);
  });

  it("accepte une base vide ou déjà marquée, et marque la production existante", () => {
    expect(checkDatabaseForEnvironment({ target: "development", marker: null, hasData: false })).toEqual({ ok: true, mark: true });
    expect(checkDatabaseForEnvironment({ target: "development", marker: "development", hasData: true })).toEqual({ ok: true, mark: false });
    expect(checkDatabaseForEnvironment({ target: "production", marker: null, hasData: true })).toEqual({ ok: true, mark: true });
  });
});

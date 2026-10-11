import { describe, expect, it } from "vitest";
import { withExplicitSslMode } from "./connection-string";

describe("withExplicitSslMode", () => {
  it("écrit verify-full à la place de require (chaîne Neon)", () => {
    const url = withExplicitSslMode("postgresql://u:p@ep-x.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require");
    expect(new URL(url!).searchParams.get("sslmode")).toBe("verify-full");
    expect(new URL(url!).searchParams.get("channel_binding")).toBe("require");
  });

  it("traite aussi prefer et verify-ca", () => {
    for (const mode of ["prefer", "verify-ca"]) {
      expect(withExplicitSslMode(`postgresql://u:p@h/db?sslmode=${mode}`)).toBe("postgresql://u:p@h/db?sslmode=verify-full");
    }
  });

  it("laisse intactes les chaînes sans sslmode, déjà explicites ou en compatibilité libpq", () => {
    for (const url of [
      "postgresql://gmao:gmao@localhost:5432/gmao",
      "postgresql://u:p@h/db?sslmode=verify-full",
      "postgresql://u:p@h/db?sslmode=disable",
      "postgresql://u:p@h/db?uselibpqcompat=true&sslmode=require",
    ]) {
      expect(withExplicitSslMode(url)).toBe(url);
    }
  });

  it("laisse passer une valeur absente ou illisible", () => {
    expect(withExplicitSslMode(undefined)).toBeUndefined();
    expect(withExplicitSslMode("pas une adresse")).toBe("pas une adresse");
  });
});

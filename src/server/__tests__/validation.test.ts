import { describe, expect, it } from "vitest";
import { z } from "zod";
import { toDateTimeInput } from "@/lib/format";
import { formToObject, optionalDate, parseLocalDateTime } from "../validation";

describe("Saisie des dates-heures dans le fuseau d'exploitation (DON-16)", () => {
  it("interprète une heure d'été à Paris (UTC+2)", () => {
    expect(parseLocalDateTime("2026-10-08T08:00")?.toISOString()).toBe("2026-10-08T06:00:00.000Z");
  });
  it("interprète une heure d'hiver à Paris (UTC+1)", () => {
    expect(parseLocalDateTime("2026-12-15T08:30")?.toISOString()).toBe("2026-12-15T07:30:00.000Z");
  });
  it("gère le jour du passage à l'heure d'hiver", () => {
    expect(parseLocalDateTime("2026-10-25T12:00")?.toISOString()).toBe("2026-10-25T11:00:00.000Z");
  });
  it("laisse passer les dates ISO complètes et les dates seules", () => {
    expect(parseLocalDateTime("2026-10-08T08:00:00Z")).toBeNull();
    expect(optionalDate.parse("2026-10-08T08:00:00Z")?.toISOString()).toBe("2026-10-08T08:00:00.000Z");
    expect(optionalDate.parse("2026-10-08")?.toISOString()).toBe("2026-10-08T00:00:00.000Z");
    expect(optionalDate.parse(undefined)).toBeUndefined();
  });
  it("relit exactement ce que le formulaire affiche", () => {
    const instant = new Date("2026-07-01T05:45:00Z");
    const shown = toDateTimeInput(instant);
    expect(shown).toBe("2026-07-01T07:45");
    expect(optionalDate.parse(shown)?.toISOString()).toBe(instant.toISOString());
  });
  it("refuse une date invalide", () => {
    expect(z.object({ d: optionalDate }).safeParse({ d: "pas une date" }).success).toBe(false);
  });
});

describe("formToObject", () => {
  it("ignore les champs vides et regroupe les clés répétées", () => {
    const fd = new FormData();
    fd.append("title", "  Fuite  ");
    fd.append("description", "");
    fd.append("assigneeIds[]", "a");
    fd.append("assigneeIds[]", "b");
    expect(formToObject(fd)).toEqual({ title: "Fuite", assigneeIds: ["a", "b"] });
  });
});

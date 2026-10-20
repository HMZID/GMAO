import { describe, expect, it } from "vitest";
import { z } from "zod";
import { plainText } from "@/i18n/translate";
import { formToObject, number, text } from "../validation";
import "../validation-messages";

/** Messages par champ, sans séparateurs de gabarit (tels que lus par l'API). */
function errorsOf(schema: z.ZodType, data: unknown) {
  const result = schema.safeParse(data);
  if (result.success) return {};
  const fields = z.flattenError(result.error).fieldErrors as Record<string, string[]>;
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.map(plainText)]));
}

describe("messages de validation en français", () => {
  it("un champ obligatoire vide (absent du formulaire) est signalé comme obligatoire", () => {
    const schema = z.object({ title: text(), siteId: z.uuid(), kind: z.enum(["A", "B"]), qty: number(), due: z.coerce.date() });
    const fd = new FormData();
    fd.set("title", "  ");
    fd.set("siteId", "");
    const errors = errorsOf(schema, formToObject(fd));
    expect(errors.title).toEqual(["Champ obligatoire"]);
    expect(errors.siteId).toEqual(["Champ obligatoire"]);
    expect(errors.kind).toEqual(["Champ obligatoire"]);
    expect(errors.qty).toEqual(["Nombre attendu"]);
  });

  it("une valeur mal renseignée donne la règle à respecter", () => {
    const schema = z.object({
      name: z.string().max(5),
      code: z.string().min(3),
      qty: z.coerce.number().positive(),
      rate: z.coerce.number().min(0).max(100),
      email: z.email(),
      site: z.url(),
      kind: z.enum(["A", "B"]),
      tags: z.array(z.string()).min(1),
    });
    const errors = errorsOf(schema, {
      name: "abcdefgh",
      code: "ab",
      qty: "0",
      rate: "150",
      email: "x@",
      site: "pas une adresse",
      kind: "Z",
      tags: [],
    });
    expect(errors).toEqual({
      name: ["5 caractères au maximum"],
      code: ["3 caractères au minimum"],
      qty: ["Doit être supérieur à 0"],
      rate: ["Doit être inférieur ou égal à 100"],
      email: ["Adresse courriel invalide"],
      site: ["Adresse web invalide (https://…)"],
      kind: ["Choix invalide : choisir une valeur de la liste"],
      tags: ["Choisir au moins un élément"],
    });
  });

  it("un message écrit dans le schéma reste prioritaire", () => {
    expect(errorsOf(z.object({ a: z.string().min(10, "10 caractères minimum") }), { a: "x" })).toEqual({ a: ["10 caractères minimum"] });
    expect(errorsOf(z.object({ a: z.string().refine(() => false, "Règle propre") }), { a: "x" })).toEqual({ a: ["Règle propre"] });
  });
});

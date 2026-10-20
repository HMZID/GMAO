import { z } from "zod";
import { tpl } from "@/i18n/translate";

/**
 * Messages de validation en français, pour tous les schémas (DON-11) : un champ vide est « obligatoire », une
 * longueur ou une borne dépassée donne la limite. Un message écrit dans le schéma reste prioritaire.
 * Les messages variables sont des gabarits `tpl` (traduits à l'affichage, séparateurs retirés dans l'API).
 * Module pur, testé dans `__tests__/validation-messages.test.ts`.
 */
type Issue = z.core.$ZodRawIssue;

const isEmpty = (value: unknown) => value === undefined || value === null || (typeof value === "string" && value.trim() === "");

const FORMATS: Record<string, string> = {
  email: "Adresse courriel invalide",
  url: "Adresse web invalide (https://…)",
  uuid: "Valeur à choisir dans la liste",
  guid: "Valeur à choisir dans la liste",
  date: "Date invalide",
  datetime: "Date et heure invalides",
  time: "Heure invalide",
  regex: "Format invalide",
};

function sizeLimit(issue: { origin?: string; inclusive?: boolean }, limit: number | bigint, side: "min" | "max") {
  const n = Number(limit);
  switch (issue.origin) {
    case "string":
      if (side === "min" && n <= 1) return "Champ obligatoire";
      return side === "min" ? tpl`${n} caractères au minimum` : tpl`${n} caractères au maximum`;
    case "array":
    case "set":
      if (side === "min") return n <= 1 ? "Choisir au moins un élément" : tpl`Choisir au moins ${n} éléments`;
      return tpl`${n} éléments au maximum`;
    case "file":
      return side === "min" ? "Fichier vide" : "Fichier trop volumineux";
    case "date":
      return side === "min" ? "Date trop ancienne" : "Date trop lointaine";
    default: {
      // Nombres : borne incluse ou non.
      if (side === "min") {
        if (n === 0 && issue.inclusive === false) return "Doit être supérieur à 0";
        return issue.inclusive === false ? tpl`Doit être supérieur à ${n}` : tpl`Doit être supérieur ou égal à ${n}`;
      }
      return issue.inclusive === false ? tpl`Doit être inférieur à ${n}` : tpl`Doit être inférieur ou égal à ${n}`;
    }
  }
}

/** Message d'une erreur de validation, ou undefined pour garder le message par défaut. */
export function validationMessage(issue: Issue): string | undefined {
  switch (issue.code) {
    case "invalid_type":
      if (isEmpty(issue.input)) return "Champ obligatoire";
      if (issue.expected === "number" || issue.expected === "int" || issue.expected === "bigint") return "Nombre attendu";
      if (issue.expected === "date") return "Date attendue";
      if (issue.expected === "boolean") return "Oui ou non attendu";
      if (issue.expected === "array") return "Liste attendue";
      return "Valeur invalide";
    case "too_small":
      return sizeLimit(issue, issue.minimum, "min");
    case "too_big":
      return sizeLimit(issue, issue.maximum, "max");
    case "invalid_format":
      if (isEmpty(issue.input)) return "Champ obligatoire";
      return FORMATS[issue.format] ?? "Format invalide";
    case "invalid_value":
      if (isEmpty(issue.input)) return "Champ obligatoire";
      return "Choix invalide : choisir une valeur de la liste";
    case "not_multiple_of":
      return tpl`Doit être un multiple de ${Number(issue.divisor)}`;
    case "invalid_union":
      return isEmpty(issue.input) ? "Champ obligatoire" : "Valeur invalide";
    case "unrecognized_keys":
      return tpl`Champs inconnus : ${issue.keys.join(", ")}`;
    case "invalid_key":
    case "invalid_element":
    case "custom":
      return "Valeur invalide";
    default:
      return undefined;
  }
}

z.config({ customError: validationMessage });

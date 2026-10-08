import { z } from "zod";

/**
 * Briques Zod partagées par les services (API JSON et formulaires).
 * Les formulaires passent par `formToObject` : chaînes vides → undefined, cases cochées → true.
 */

export const id = (message = "Valeur obligatoire") => z.uuid(message);

export const optionalId = z.uuid().optional();

export const text = (max = 250, message = "Champ obligatoire") => z.string().trim().min(1, message).max(max);

export const optionalText = (max = 2000) => z.string().trim().max(max).optional();

/** Booléen tolérant : true, "true", "on", "1". */
export const bool = z.preprocess((v) => v === true || v === "true" || v === "on" || v === "1", z.boolean());

export const number = (message = "Nombre attendu") => z.coerce.number({ error: message }).refine(Number.isFinite, message);

export const optionalNumber = z.coerce.number().refine(Number.isFinite, "Nombre attendu").optional();

/** Fuseau des saisies sans décalage horaire (champs datetime-local des formulaires) — DON-16. */
export const INPUT_TIME_ZONE = process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE ?? "Europe/Paris";

const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

/** Décalage du fuseau par rapport à UTC, en millisecondes, à un instant donné. */
function zoneOffset(at: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(at));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const wall = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return wall - Math.floor(at / 1000) * 1000;
}

/**
 * Interprète une date-heure saisie sans fuseau (« 2026-10-08T08:00 ») dans le fuseau d'exploitation.
 * Renvoie null si la chaîne n'a pas ce format (les dates ISO avec « Z » ou un décalage passent telles quelles).
 */
export function parseLocalDateTime(value: string, timeZone = INPUT_TIME_ZONE): Date | null {
  const m = LOCAL_DATE_TIME.exec(value);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const wall = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s ?? 0));
  const first = wall - zoneOffset(wall, timeZone);
  // Second passage : corrige les jours de changement d'heure.
  return new Date(wall - zoneOffset(first, timeZone));
}

const toDate = (value: unknown) => (typeof value === "string" ? (parseLocalDateTime(value.trim()) ?? value) : value);

export const date = (message = "Date attendue") => z.preprocess(toDate, z.coerce.date({ error: message }));

export const optionalDate = z.preprocess(toDate, z.coerce.date({ error: "Date attendue" })).optional();

/**
 * Champ facultatif effaçable des formulaires de modification : chaîne vide → null (valeur effacée),
 * absent → undefined (valeur inchangée). À utiliser avec `formToObject(formData, { keepEmpty: true })`.
 */
export const clearable = <T extends z.ZodType>(schema: T) => z.preprocess((value) => (value === "" ? null : value), schema.nullable().optional());

/**
 * Convertit un FormData en objet simple pour Zod. Les clés répétées (suffixe « [] ») deviennent des tableaux.
 * Par défaut les champs vides sont ignorés ; `keepEmpty` les conserve (formulaires de modification).
 */
export function formToObject(formData: FormData, options: { keepEmpty?: boolean } = {}): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, raw] of formData.entries()) {
    if (key.startsWith("$ACTION")) continue;
    const value = typeof raw === "string" ? raw.trim() : raw;
    if (value === "" && !(options.keepEmpty && !key.endsWith("[]"))) continue;
    if (key.endsWith("[]")) {
      const k = key.slice(0, -2);
      const list = (result[k] as unknown[]) ?? [];
      list.push(value);
      result[k] = list;
    } else {
      result[key] = value;
    }
  }
  return result;
}

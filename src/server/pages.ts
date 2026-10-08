import "server-only";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ForbiddenError, NotFoundError } from "@/server/errors";

const uuid = z.uuid();

export function isUuid(value: unknown): value is string {
  return uuid.safeParse(value).success;
}

/**
 * Charge une fiche pour une page : identifiant invalide, élément introuvable ou hors périmètre
 * → page 404, sans révéler l'existence de l'élément (HAB-02).
 */
export async function loadOr404<T>(id: string, load: (id: string) => Promise<T>): Promise<T> {
  if (!isUuid(id)) notFound();
  try {
    return await load(id);
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ForbiddenError) notFound();
    throw error;
  }
}

/** Paramètres de recherche d'une page, réduits aux chaînes simples (pour les filtres des services). */
export function queryParams(searchParams: Record<string, string | string[] | undefined>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(searchParams)) {
    const v = Array.isArray(value) ? value[0] : value;
    if (v !== undefined && v !== "") result[key] = v;
  }
  return result;
}

/** Retire des paramètres de recherche les filtres invalides (URL modifiée à la main) au lieu d'échouer. */
export function cleanFilters(schema: z.ZodType, params: Record<string, string>): Record<string, string> {
  const result = schema.safeParse(params);
  if (result.success) return params;
  const invalid = new Set(result.error.issues.map((issue) => String(issue.path[0])));
  return Object.fromEntries(Object.entries(params).filter(([key]) => !invalid.has(key)));
}

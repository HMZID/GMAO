/**
 * Clés d'API du connecteur de l'organisation (INT-01, INT-05) : un outil ETL ou d'intégration
 * s'authentifie par une clé, sans compte personnel. La clé n'est montrée qu'à sa création : seule son
 * empreinte SHA-256 est enregistrée. Module pur, testé dans `__tests__/api-keys.test.ts`.
 */
import { createHash, randomBytes } from "node:crypto";
import type { Permission, Role } from "@/server/authz/permissions";

/** Préfixe des clés : reconnaissable dans un en-tête, distinct des jetons de session. */
export const API_KEY_PREFIX = "gmk_";

/** Niveaux d'accès d'une clé. */
export const API_KEY_ACCESS = ["READ", "IMPORT"] as const;
export type ApiKeyAccess = (typeof API_KEY_ACCESS)[number];

export const API_KEY_ACCESS_LABEL: Record<ApiKeyAccess, string> = {
  READ: "Lecture et export",
  IMPORT: "Lecture, export et import",
};

/** Durées de validité proposées, en jours (null : sans échéance). */
export const API_KEY_DURATIONS = [30, 90, 365] as const;

const READ: Permission[] = [
  "equipment.read",
  "meter.read",
  "plan.read",
  "request.read",
  "workorder.read",
  "planning.read",
  "part.read",
  "stock.read",
  "supplier.read",
  "purchase.read",
  "kpi.read",
  "data.export",
];

/**
 * Droits d'une clé : lecture et export ; l'accès « import » ajoute les droits de création utilisés par
 * les imports (équipements, articles, stocks initiaux, fournisseurs, ouvriers). Jamais d'administration.
 */
export const API_KEY_PERMISSIONS: Record<ApiKeyAccess, readonly Permission[]> = {
  READ,
  IMPORT: [...READ, "equipment.write", "part.write", "stock.move", "supplier.write", "users.manage"],
};

/** Rôles du contexte d'une clé, sur tout le groupe, avant restriction à ses droits. */
export const API_KEY_ROLES: readonly Role[] = ["ADMIN", "EXECUTIVE", "STOREKEEPER", "MAINTENANCE_MANAGER"];

/** Nouvelle clé : la valeur à remettre une seule fois, son préfixe affichable et son empreinte. */
export function generateApiKey() {
  const key = `${API_KEY_PREFIX}${randomBytes(30).toString("base64url")}`;
  return { key, prefix: key.slice(0, API_KEY_PREFIX.length + 8), hash: hashApiKey(key) };
}

export function hashApiKey(key: string) {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

/** Le jeton présenté est-il une clé d'API (et non un jeton de session) ? */
export function isApiKey(token: string | null | undefined): token is string {
  return !!token && token.startsWith(API_KEY_PREFIX) && /^[A-Za-z0-9_-]{40,80}$/.test(token);
}

/** Clé présentée par `Authorization: Bearer <clé>` ou `X-Api-Key: <clé>`. */
export function apiKeyFromHeaders(headers: Headers): string | null {
  const bearer = /^Bearer\s+(\S+)$/i.exec(headers.get("authorization") ?? "")?.[1];
  const token = bearer ?? headers.get("x-api-key")?.trim() ?? null;
  return isApiKey(token) ? token : null;
}

export type ApiKeyState = "ACTIVE" | "REVOKED" | "EXPIRED";

export function apiKeyState(key: { revokedAt: Date | null; expiresAt: Date | null }, now: Date): ApiKeyState {
  if (key.revokedAt) return "REVOKED";
  if (key.expiresAt && key.expiresAt <= now) return "EXPIRED";
  return "ACTIVE";
}

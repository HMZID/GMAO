/**
 * Connexion « en tant que » de l'administrateur de la plateforme : un cookie signé (HMAC-SHA256) indique
 * l'utilisateur dont il prend la place. Le jeton est lié à l'administrateur qui l'a ouvert et expire
 * après quelques heures ; il ne remplace jamais la session de l'administrateur, qui reste requise.
 * Module pur, testé dans `__tests__/impersonation.test.ts`.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const IMPERSONATION_COOKIE = "gmao_impersonation";

/** Durée de validité d'une connexion « en tant que ». */
export const IMPERSONATION_TTL_MS = 4 * 60 * 60 * 1000;

const sign = (payload: string, secret: string) => createHmac("sha256", secret).update(payload).digest("base64url");

export function signImpersonation(input: { adminId: string; targetId: string; expiresAt: number }, secret: string) {
  if (!secret) throw new Error("Secret de signature absent.");
  const payload = `${input.adminId}.${input.targetId}.${input.expiresAt}`;
  return `${payload}.${sign(payload, secret)}`;
}

/** Jeton valide, non expiré et signé par ce serveur ; sinon null. */
export function verifyImpersonation(token: string | null | undefined, secret: string, now: Date): { adminId: string; targetId: string } | null {
  if (!token || !secret) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [adminId, targetId, expires, signature] = parts;
  const expected = sign(`${adminId}.${targetId}.${expires}`, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (!/^\d+$/.test(expires) || Number(expires) <= now.getTime()) return null;
  if (!adminId || !targetId || adminId === targetId) return null;
  return { adminId, targetId };
}

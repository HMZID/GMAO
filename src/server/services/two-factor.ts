import "server-only";
import { APIError } from "better-auth/api";
import QRCode from "qrcode";
import { z } from "zod";
import { auth } from "@/server/auth/auth";
import type { AuthContext } from "@/server/authz/context";
import { db } from "@/server/db";
import { adminTwoFactorEnforced, normalizeTotpCode } from "@/server/domain/two-factor";
import { BusinessRuleError } from "@/server/errors";
import { audit, parseInput } from "./_shared";

/* ------------------------------------------------------------------ */
/* Double authentification du compte connecté (TEC-04)                  */
/* ------------------------------------------------------------------ */

const passwordInput = z.object({ password: z.string().min(1, "Mot de passe obligatoire").max(128) });
const codeInput = z.object({ code: z.string().trim().max(20) });

function asRuleError(error: unknown, message: string): never {
  if (error instanceof APIError) throw new BusinessRuleError([message]);
  throw error;
}

/** Secret en clair de l'URI otpauth (saisie manuelle dans l'application, si le QR code ne peut être lu). */
function secretOf(totpURI: string) {
  return new URL(totpURI).searchParams.get("secret") ?? "";
}

/**
 * Première étape : vérification du mot de passe, secret TOTP et codes de secours créés (chiffrés par Better Auth).
 * La double authentification ne devient active qu'après la confirmation d'un premier code.
 */
export async function beginTwoFactorEnrollment(ctx: AuthContext, headers: Headers, raw: unknown) {
  const input = parseInput(passwordInput, raw);
  if (ctx.twoFactorEnabled) throw new BusinessRuleError(["La double authentification est déjà active."]);
  const result = await auth.api
    .enableTwoFactor({ body: { password: input.password, issuer: "GMAO", method: "totp" }, headers })
    .catch((error) => asRuleError(error, "Mot de passe incorrect."));
  if (!("totpURI" in result)) throw new BusinessRuleError(["Méthode de double authentification inattendue."]);
  await audit(db, ctx, { entityType: "user", entityId: ctx.userId, action: "two_factor_enrollment_started" });
  return {
    qrSvg: await QRCode.toString(result.totpURI, { type: "svg", margin: 1, width: 200 }),
    secret: secretOf(result.totpURI),
    backupCodes: result.backupCodes,
  };
}

/** Deuxième étape : un code de l'application prouve que l'enrôlement fonctionne ; la double authentification s'active. */
export async function confirmTwoFactorEnrollment(ctx: AuthContext, headers: Headers, raw: unknown) {
  const code = normalizeTotpCode(parseInput(codeInput, raw).code);
  if (!code) throw new BusinessRuleError(["Saisir les 6 chiffres affichés par l'application."]);
  await auth.api
    .verifyTOTP({ body: { code }, headers })
    .catch((error) => asRuleError(error, "Code incorrect : vérifier l'heure du téléphone et réessayer."));
  await audit(db, ctx, { entityType: "user", entityId: ctx.userId, action: "two_factor_enabled" });
}

/** Nouveaux codes de secours (les précédents ne fonctionnent plus). */
export async function regenerateBackupCodes(ctx: AuthContext, headers: Headers, raw: unknown) {
  const input = parseInput(passwordInput, raw);
  if (!ctx.twoFactorEnabled) throw new BusinessRuleError(["La double authentification n'est pas active."]);
  const result = await auth.api
    .generateBackupCodes({ body: { password: input.password }, headers })
    .catch((error) => asRuleError(error, "Mot de passe incorrect."));
  await audit(db, ctx, { entityType: "user", entityId: ctx.userId, action: "two_factor_backup_codes_regenerated" });
  return result.backupCodes;
}

/** Désactivation, refusée à l'administrateur de la plateforme quand elle est obligatoire. */
export async function disableTwoFactor(ctx: AuthContext, headers: Headers, raw: unknown) {
  const input = parseInput(passwordInput, raw);
  if (ctx.can("platform.manage") && adminTwoFactorEnforced({ flag: process.env.ADMIN_TWO_FACTOR_REQUIRED, vercelEnv: process.env.VERCEL_ENV })) {
    throw new BusinessRuleError(["La double authentification est obligatoire pour l'administrateur de la plateforme."]);
  }
  await auth.api.disableTwoFactor({ body: { password: input.password }, headers }).catch((error) => asRuleError(error, "Mot de passe incorrect."));
  await audit(db, ctx, { entityType: "user", entityId: ctx.userId, action: "two_factor_disabled" });
}

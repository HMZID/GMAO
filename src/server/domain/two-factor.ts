/**
 * Double authentification (TEC-04) : TOTP (application d'authentification) et codes de secours, par le plugin
 * twoFactor de Better Auth. Obligatoire pour l'administrateur de la plateforme (il voit toutes les organisations
 * et se connecte « en tant que »), facultative pour les autres comptes. Module pur, testé dans
 * `__tests__/two-factor.test.ts`.
 */

/**
 * Obligation pour l'administrateur de la plateforme : ADMIN_TWO_FACTOR_REQUIRED=true ou false si renseignée,
 * sinon active sur Vercel (recette et production) et inactive en local et en CI.
 */
export function adminTwoFactorEnforced(env: { flag?: string | undefined; vercelEnv?: string | undefined }) {
  if (env.flag) return env.flag === "true";
  return !!env.vercelEnv;
}

/** L'administrateur doit configurer sa double authentification avant d'exercer ses droits de plateforme. */
export function needsTwoFactorSetup(input: { platformAdmin: boolean; enabled: boolean; enforced: boolean }) {
  return input.platformAdmin && input.enforced && !input.enabled;
}

/** Code à 6 chiffres de l'application d'authentification (espaces tolérés). */
export function normalizeTotpCode(raw: string): string | null {
  const code = raw.replace(/\s+/g, "");
  return /^\d{6}$/.test(code) ? code : null;
}

/** Code de secours (format de Better Auth : lettres et chiffres, tiret facultatif). */
export function normalizeBackupCode(raw: string): string | null {
  const code = raw.trim();
  return /^[A-Za-z0-9]{4,12}(-[A-Za-z0-9]{4,12})?$/.test(code) ? code : null;
}

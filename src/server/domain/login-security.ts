/**
 * Sécurité de la connexion (TEC-04, TEC-12) : destination après connexion, limitation des tentatives,
 * contrôle de la réponse du CAPTCHA (Cloudflare Turnstile). Module pur, testé dans
 * `__tests__/login-security.test.ts`.
 */

/**
 * Destination après connexion : un chemin de l'application uniquement. Refuse les adresses externes,
 * y compris les formes que les navigateurs lisent comme telles (`//site`, `/\site`, caractères de contrôle).
 */
export function safeRedirectPath(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f\u007f\\]/.test(next)) return fallback;
  try {
    const base = "http://gmao.invalid";
    const url = new URL(next, base);
    if (url.origin !== base) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

/** Fenêtre et seuils des échecs de connexion (comptés sur la fenêtre glissante). */
export const LOGIN_LIMITS = {
  windowMs: 15 * 60 * 1000,
  /** Même compte depuis la même adresse IP : le cas d'un mot de passe deviné. */
  perAccountAndIp: 5,
  /** Même compte, toutes adresses : attaque distribuée sur un compte (seuil plus haut, contre le blocage d'autrui). */
  perAccount: 20,
  /** Même adresse IP, tous comptes : essai de nombreux comptes (« credential stuffing »). */
  perIp: 50,
} as const;

export function isLoginBlocked(failures: { accountAndIp: number; account: number; ip: number }, limits = LOGIN_LIMITS) {
  return failures.accountAndIp >= limits.perAccountAndIp || failures.account >= limits.perAccount || failures.ip >= limits.perIp;
}

/** Réponse de l'API siteverify de Turnstile (champs utilisés). */
export type CaptchaVerification = {
  success: boolean;
  action?: string | null;
  hostname?: string | null;
  "error-codes"?: string[];
};

/**
 * Raisons de refuser une réponse de CAPTCHA (liste vide = acceptée) : échec, action différente (jeton obtenu
 * pour un autre formulaire), nom de domaine hors liste (jeton obtenu sur un autre site avec la même clé).
 */
export function captchaRefusals(result: CaptchaVerification, expected: { action: string; hostnames: string[] }): string[] {
  const errors: string[] = [];
  if (!result.success) errors.push(`échec (${(result["error-codes"] ?? []).join(", ") || "sans code"})`);
  if (result.success && result.action !== expected.action) errors.push(`action inattendue (${result.action ?? "aucune"})`);
  if (result.success && expected.hostnames.length > 0 && !expected.hostnames.includes((result.hostname ?? "").toLowerCase())) {
    errors.push(`nom de domaine inattendu (${result.hostname ?? "aucun"})`);
  }
  return errors;
}

/** Adresse IP du client, derrière le proxy de l'hébergeur (première adresse de X-Forwarded-For). */
export function clientIp(headers: { get(name: string): string | null } | null | undefined): string | null {
  if (!headers) return null;
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip")?.trim() || null;
}

/**
 * Mot de passe divulgué (Have I Been Pwned, méthode k-anonymity) : l'empreinte SHA-1 est coupée en un préfixe
 * de 5 caractères, seul envoyé au service, et un suffixe cherché dans la réponse (`SUFFIXE:NOMBRE` par ligne).
 */
export function breachCountInRange(rangeBody: string, suffix: string): number {
  const wanted = suffix.toUpperCase();
  for (const line of rangeBody.split(/\r?\n/)) {
    const [candidate, count] = line.trim().split(":");
    if (candidate?.toUpperCase() === wanted) return Number(count) || 0;
  }
  return 0;
}

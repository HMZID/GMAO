import "server-only";
import { captchaRefusals, type CaptchaVerification } from "@/server/domain/login-security";
import { trustedOrigins } from "@/server/public-url";

/**
 * CAPTCHA de la page de connexion : Cloudflare Turnstile (https://developers.cloudflare.com/turnstile/).
 * Actif quand TURNSTILE_SITE_KEY et TURNSTILE_SECRET_KEY sont déclarées ; sinon (poste local, CI), la page
 * fonctionne sans, la limitation des tentatives restant active. Vérification côté serveur à chaque
 * connexion : action « login », nom de domaine de l'application, jeton à usage unique.
 */
export const CAPTCHA_ACTION = "login";
const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function captchaSiteKey(): string | null {
  return process.env.TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY ? process.env.TURNSTILE_SITE_KEY : null;
}

/** Noms de domaine sur lesquels le jeton doit avoir été obtenu (adresse publique et déploiement en cours). */
function allowedHostnames() {
  return trustedOrigins().map((origin) => new URL(origin).hostname.toLowerCase());
}

/** Vrai si le CAPTCHA est inactif, ou si la réponse fournie est valide. En cas de panne du service : refus. */
export async function verifyCaptcha(token: string | null | undefined, ip: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!captchaSiteKey() || !secret) return true;
  if (!token || token.length > 2048) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set("remoteip", ip);
  try {
    const response = await fetch(SITEVERIFY_URL, { method: "POST", body, signal: AbortSignal.timeout(5000) });
    if (!response.ok) return false;
    const result = (await response.json()) as CaptchaVerification;
    const refusals = captchaRefusals(result, { action: CAPTCHA_ACTION, hostnames: allowedHostnames() });
    if (refusals.length > 0) console.warn(`[captcha] connexion refusée : ${refusals.join(" ; ")}`);
    return refusals.length === 0;
  } catch (error) {
    console.error("[captcha] vérification impossible", (error as Error).message);
    return false;
  }
}

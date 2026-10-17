"use server";

import { APIError } from "better-auth/api";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/server/actions";
import { auth } from "@/server/auth/auth";
import { verifyCaptcha } from "@/server/auth/captcha";
import { getOwnAuthContext } from "@/server/auth/session";
import { needsPasswordChange, setInitialPassword } from "@/server/services/account";
import { formToObject } from "@/server/validation";
import { IMPERSONATION_COOKIE } from "@/server/domain/impersonation";
import { clientIp, safeRedirectPath } from "@/server/domain/login-security";
import { normalizeBackupCode, normalizeTotpCode } from "@/server/domain/two-factor";

/**
 * Connexion email + mot de passe (le cookie de session est posé par le plugin nextCookies). CAPTCHA vérifié
 * avant tout essai du mot de passe (`verifyCaptcha`, inactif sans clés) ; tentatives limitées par les hooks
 * de Better Auth (`login-throttle.ts`) ; retour vers un chemin de l'application uniquement.
 */
export async function signInAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeRedirectPath(String(formData.get("next") ?? "/"));
  if (!email || !password) return { status: "error", message: "Saisir le courriel et le mot de passe.", at: Date.now() };
  const requestHeaders = await headers();
  if (!(await verifyCaptcha(String(formData.get("cf-turnstile-response") ?? ""), clientIp(requestHeaders)))) {
    return { status: "error", message: "Vérification anti-robot non validée : réessayer.", at: Date.now() };
  }
  let userId: string;
  try {
    const result = await auth.api.signInEmail({ body: { email, password }, headers: requestHeaders });
    // Double authentification active : pas encore de session, deuxième étape par le code (TEC-04).
    if ("twoFactorRedirect" in result && result.twoFactorRedirect) {
      redirect(`/connexion/verification${next === "/" ? "" : `?next=${encodeURIComponent(next)}`}`);
    }
    if (!("user" in result)) throw new Error("Réponse de connexion inattendue.");
    userId = result.user.id;
  } catch (error) {
    if (error instanceof APIError) {
      return {
        status: "error",
        message:
          error.status === "TOO_MANY_REQUESTS"
            ? "Trop de tentatives de connexion : réessayer dans 15 minutes."
            : "Identifiants invalides, compte désactivé ou accès de l'organisation terminé (fin de démonstration).",
        at: Date.now(),
      };
    }
    throw error;
  }
  // Compte ouvert depuis le site : choix du mot de passe personnel avant tout.
  if (await needsPasswordChange(userId)) redirect("/premiere-connexion");
  redirect(next);
}

/** Première connexion : remplacement du mot de passe provisoire, puis accès à l'application. */
export async function setInitialPasswordAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await getOwnAuthContext();
    const current = await auth.api.getSession({ headers: await headers() });
    await setInitialPassword(ctx, formToObject(formData, { keepEmpty: true }), current?.session.token);
    redirect("/");
  });
}

export async function signOutAction() {
  // Une connexion « en tant que » se termine avec la session de l'administrateur.
  (await cookies()).delete(IMPERSONATION_COOKIE);
  await auth.api.signOut({ headers: await headers() });
  redirect("/login");
}

/** Fin de la connexion « en tant que » : retour au compte de l'administrateur de la plateforme. */
export async function stopImpersonationAction() {
  (await cookies()).delete(IMPERSONATION_COOKIE);
  redirect("/administration/plateforme");
}

/**
 * Deuxième étape de la connexion : code de l'application d'authentification, ou code de secours (TEC-04).
 * Le cookie temporaire posé par Better Auth à la première étape porte l'identité ; la session est créée ici.
 */
export async function verifyTwoFactorAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const next = safeRedirectPath(String(formData.get("next") ?? "/"));
  const backup = formData.get("method") === "backup";
  const raw = String(formData.get("code") ?? "");
  const code = backup ? normalizeBackupCode(raw) : normalizeTotpCode(raw);
  if (!code) {
    return { status: "error", message: backup ? "Saisir un code de secours." : "Saisir les 6 chiffres affichés par l'application.", at: Date.now() };
  }
  let userId: string;
  try {
    const requestHeaders = await headers();
    const result = backup
      ? await auth.api.verifyBackupCode({ body: { code }, headers: requestHeaders })
      : await auth.api.verifyTOTP({ body: { code }, headers: requestHeaders });
    userId = result.user.id;
  } catch (error) {
    if (error instanceof APIError) {
      return {
        status: "error",
        message: "Code incorrect ou expiré. Après plusieurs codes faux, la vérification est bloquée : reprendre la connexion depuis le début.",
        at: Date.now(),
      };
    }
    throw error;
  }
  if (await needsPasswordChange(userId)) redirect("/premiere-connexion");
  redirect(next);
}

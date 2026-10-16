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

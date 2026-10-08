"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { auth } from "@/server/auth/auth";

/** Connexion email + mot de passe (le cookie de session est posé par le plugin nextCookies). */
export async function signInAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");
  if (!email || !password) return { status: "error", message: "Saisir le courriel et le mot de passe.", at: Date.now() };
  try {
    await auth.api.signInEmail({ body: { email, password }, headers: await headers() });
  } catch (error) {
    if (error instanceof APIError) {
      return { status: "error", message: "Identifiants invalides ou compte désactivé.", at: Date.now() };
    }
    throw error;
  }
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function signOutAction() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/login");
}

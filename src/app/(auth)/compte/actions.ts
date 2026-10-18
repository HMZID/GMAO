"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { runAction, toActionState } from "@/server/actions";
import type { ActionState } from "@/lib/action-state";
import { getOwnAuthContext } from "@/server/auth/session";
import { beginTwoFactorEnrollment, confirmTwoFactorEnrollment, disableTwoFactor, regenerateBackupCodes } from "@/server/services/two-factor";
import { formToObject } from "@/server/validation";

/** État de l'activation : QR code et codes de secours à montrer une seule fois, puis confirmation. */
export type EnrollmentState = ActionState & { qrSvg?: string; secret?: string; backupCodes?: string[] };

export async function startEnrollmentAction(_state: EnrollmentState, formData: FormData): Promise<EnrollmentState> {
  try {
    const ctx = await getOwnAuthContext();
    const result = await beginTwoFactorEnrollment(ctx, await headers(), formToObject(formData));
    return { status: "success", message: "Scannez le QR code, puis saisissez le code affiché.", ...result, at: Date.now() };
  } catch (error) {
    unstable_rethrow(error);
    return toActionState(error);
  }
}

/**
 * Confirmation par un premier code. Better Auth remplace alors la session (nouveau cookie) : la page est
 * rechargée par une redirection, car un nouveau rendu dans cette requête lirait encore l'ancien cookie.
 */
export async function confirmEnrollmentAction(_state: EnrollmentState, formData: FormData): Promise<EnrollmentState> {
  try {
    const ctx = await getOwnAuthContext();
    await confirmTwoFactorEnrollment(ctx, await headers(), formToObject(formData));
  } catch (error) {
    unstable_rethrow(error);
    return toActionState(error);
  }
  redirect("/compte/securite?active=1");
}

export async function regenerateBackupCodesAction(_state: EnrollmentState, formData: FormData): Promise<EnrollmentState> {
  try {
    const ctx = await getOwnAuthContext();
    const backupCodes = await regenerateBackupCodes(ctx, await headers(), formToObject(formData));
    return { status: "success", message: "Nouveaux codes de secours : les précédents ne fonctionnent plus.", backupCodes, at: Date.now() };
  } catch (error) {
    unstable_rethrow(error);
    return toActionState(error);
  }
}

export async function disableTwoFactorAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await getOwnAuthContext();
    await disableTwoFactor(ctx, await headers(), formToObject(formData));
    refresh();
  }, "Double authentification désactivée.");
}

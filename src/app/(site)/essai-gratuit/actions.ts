"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/server/actions";
import { submitDemoRequest } from "@/server/services/demo-requests";
import { processEmailQueue } from "@/server/services/email";
import { formToObject } from "@/server/validation";

/** Adresse du visiteur (premier relais), pour limiter les envois répétés. */
async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
}

/** Demande de compte de démonstration (visiteur anonyme) : enregistrée, administrateurs prévenus, page de confirmation. */
export async function submitDemoRequestAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const result = await submitDemoRequest(formToObject(formData), { ip: await clientIp() });
    // Alerte des administrateurs envoyée tout de suite, sans attendre le passage du processus d'envoi.
    if (result.status === "created") after(() => processEmailQueue({ limit: 20 }).catch((e) => console.error("[courriel]", e)));
    redirect("/essai-gratuit/merci");
  });
}

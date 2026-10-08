"use server";

import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { act, runAction } from "@/server/actions";
import { getAuthContext } from "@/server/auth/session";
import { executeImport, simulateImport } from "@/server/services/imports";

/** Simulation : le fichier est contrôlé ligne par ligne, puis l'aperçu s'affiche (§11.2). */
export async function simulateImportAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await getAuthContext();
    const file = formData.get("file");
    const result = await simulateImport(
      ctx,
      formData.get("kind"),
      file instanceof File && file.size > 0 ? { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) } : null,
    );
    redirect(`/imports/${result.id}`);
  });
}

export async function executeImportAction(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return act(async (ctx) => {
    const { summary } = await executeImport(ctx, id, { mode: formData.get("mode") });
    return {
      status: "success" as const,
      message: `Import exécuté : ${summary.imported} ligne(s) créée(s)${summary.errors ? `, ${summary.errors} en erreur` : ""}${summary.exists ? `, ${summary.exists} déjà présente(s)` : ""}.`,
    };
  });
}

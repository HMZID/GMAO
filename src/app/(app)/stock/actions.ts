"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { act, runAction } from "@/server/actions";
import { getAuthContext } from "@/server/auth/session";
import { createInventoryCount, decideInventoryCount } from "@/server/services/inventory";
import { createMovement, createPart, updateStockLevelSettings } from "@/server/services/stock";
import { formToObject } from "@/server/validation";

const MOVEMENT_MESSAGES: Record<string, string> = {
  RECEIPT: "Réception enregistrée : stock et coût moyen pondéré mis à jour.",
  ADJUSTMENT: "Ajustement d'inventaire enregistré.",
  SCRAP: "Mise au rebut enregistrée.",
  TRANSFER: "Transfert enregistré.",
};

export async function createPartAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await getAuthContext();
    const part = await createPart(ctx, formToObject(formData));
    redirect(`/stock/articles/${part.id}`);
  });
}

export async function stockLevelSettingsAction(levelId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return act((ctx) => updateStockLevelSettings(ctx, levelId, formToObject(formData, { keepEmpty: true })), "Seuils enregistrés.");
}

export async function movementAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const type = String(formData.get("type") ?? "");
  return act((ctx) => createMovement(ctx, formToObject(formData)), MOVEMENT_MESSAGES[type] ?? "Mouvement enregistré.");
}

export async function inventoryCountAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await getAuthContext();
    const count = await createInventoryCount(ctx, formToObject(formData));
    refresh();
    const gap = count.difference === 0 ? "aucun écart" : `écart de ${count.difference > 0 ? "+" : ""}${count.difference}`;
    return {
      status: "success",
      message:
        count.status === "PENDING"
          ? `Comptage enregistré, ${gap} : au-delà du seuil, l'écart attend la validation du responsable ; le stock n'a pas changé.`
          : `Comptage enregistré, ${gap}${count.difference === 0 ? "." : " : stock ajusté."}`,
      at: Date.now(),
    };
  });
}

export async function inventoryDecisionAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const { countId, ...fields } = formToObject(formData);
  return act(
    (ctx) => decideInventoryCount(ctx, String(countId ?? ""), fields),
    fields.decision === "REJECT" ? "Écart refusé : le stock n'a pas changé." : "Écart validé : stock ajusté.",
  );
}

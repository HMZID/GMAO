"use server";

import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { act, runAction } from "@/server/actions";
import { getAuthContext } from "@/server/auth/session";
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

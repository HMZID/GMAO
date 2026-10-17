"use server";

import type { ActionState } from "@/lib/action-state";
import { act } from "@/server/actions";
import { cancelDeadline, createDeadline, renewDeadline } from "@/server/services/fleet-deadlines";
import { formToObject } from "@/server/validation";

/** Échéances administratives du parc : mêmes services que l'API /api/v1/equipment-deadlines. */
export async function createDeadlineAction(equipmentId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return act((ctx) => createDeadline(ctx, { ...formToObject(formData), equipmentId }), "Échéance enregistrée : le responsable du parc sera alerté.");
}

/** Renouvellement ou annulation depuis une liste : l'identifiant et l'opération sont dans le formulaire. */
export async function updateDeadlineAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const { deadlineId, intent, ...fields } = formToObject(formData);
  const id = String(deadlineId ?? "");
  if (intent === "cancel") return act((ctx) => cancelDeadline(ctx, id, fields), "Échéance annulée.");
  return act((ctx) => renewDeadline(ctx, id, fields), "Échéance renouvelée : la suivante est suivie.");
}

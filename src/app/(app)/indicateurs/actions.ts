"use server";

import type { ActionState } from "@/lib/action-state";
import { act } from "@/server/actions";
import { createIndicator, deleteIndicator } from "@/server/services/indicators";
import { formToObject } from "@/server/validation";

/* Indicateurs personnalisés (KPI-11) */

export async function createIndicatorAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return act((ctx) => createIndicator(ctx, formToObject(formData, { keepEmpty: true })), "Indicateur ajouté.");
}

export async function deleteIndicatorAction(id: string, _: ActionState): Promise<ActionState> {
  return act((ctx) => deleteIndicator(ctx, id), "Indicateur supprimé.");
}

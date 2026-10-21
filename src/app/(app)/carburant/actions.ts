"use server";

import type { ActionState } from "@/lib/action-state";
import { act } from "@/server/actions";
import { createFuelCard, recordFuelEntry, reviewFuelEntry, setEquipmentFuelSettings, updateFuelCard } from "@/server/services/fuel";
import { formToObject } from "@/server/validation";

/** Saisie d'un plein (page Carburant ou fiche équipement) : mêmes services que l'API /api/v1/fuel-entries. */
export async function recordFuelAction(equipmentId: string | null, _: ActionState, formData: FormData): Promise<ActionState> {
  return act(async (ctx) => {
    const data = formToObject(formData);
    const { anomalies } = await recordFuelEntry(ctx, equipmentId ? { ...data, equipmentId } : data);
    if (anomalies.length > 0) {
      return {
        status: "success",
        message: "Plein enregistré, à examiner par le responsable du parc :",
        warnings: anomalies.map((a) => a.message),
      } satisfies ActionState;
    }
  }, "Plein enregistré.");
}

/** Examen d'un plein depuis une liste : identifiant et décision dans le formulaire. */
export async function reviewFuelAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const { entryId, ...fields } = formToObject(formData);
  return act((ctx) => reviewFuelEntry(ctx, String(entryId ?? ""), fields), fields.decision === "CANCELLED" ? "Plein annulé." : "Anomalie justifiée.");
}

export async function fuelSettingsAction(equipmentId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return act((ctx) => setEquipmentFuelSettings(ctx, equipmentId, formToObject(formData, { keepEmpty: true })), "Réglages carburant enregistrés.");
}

export async function createFuelCardAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return act((ctx) => createFuelCard(ctx, formToObject(formData)), "Carte enregistrée (4 derniers chiffres seulement).");
}

/** Mise à jour d'une carte depuis la liste : identifiant dans le formulaire, champs vides = effacés. */
export async function updateFuelCardAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const { cardId, ...fields } = formToObject(formData, { keepEmpty: true });
  return act((ctx) => updateFuelCard(ctx, String(cardId ?? ""), fields), "Carte mise à jour.");
}

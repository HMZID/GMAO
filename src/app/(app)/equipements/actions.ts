"use server";

import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { act, runAction } from "@/server/actions";
import { getAuthContext } from "@/server/auth/session";
import { assignEquipment, createEquipment, endAssignment, retireEquipment, updateEquipment } from "@/server/services/equipment";
import { recordReading, replaceMeter, reviewReading } from "@/server/services/meters";
import { applyPlan } from "@/server/services/preventive";
import { formToObject } from "@/server/validation";

export async function createEquipmentAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await getAuthContext();
    const row = await createEquipment(ctx, formToObject(formData));
    redirect(`/equipements/${row.id}`);
  });
}

export async function updateEquipmentAction(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await getAuthContext();
    await updateEquipment(ctx, id, formToObject(formData, { keepEmpty: true }));
    redirect(`/equipements/${id}`);
  });
}

export async function recordReadingAction(meterId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return act(async (ctx) => {
    const { reading } = await recordReading(ctx, meterId, formToObject(formData));
    if (reading.status === "TO_CHECK") {
      return {
        status: "success",
        message: "Relevé enregistré mais mis « à vérifier » : il ne fait pas avancer le compteur tant qu'il n'est pas validé.",
        warnings: reading.statusReasons ?? [],
      } satisfies ActionState;
    }
  }, "Relevé enregistré.");
}

export async function replaceMeterAction(meterId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return act((ctx) => replaceMeter(ctx, meterId, formToObject(formData)), "Remplacement enregistré : l'usage cumulé est conservé.");
}

export async function reviewReadingAction(readingId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return act((ctx) => reviewReading(ctx, readingId, formToObject(formData)), "Relevé traité.");
}

export async function assignEquipmentAction(equipmentId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return act((ctx) => assignEquipment(ctx, equipmentId, formToObject(formData)), "Affectation enregistrée.");
}

export async function endAssignmentAction(equipmentId: string, _: ActionState): Promise<ActionState> {
  return act((ctx) => endAssignment(ctx, equipmentId), "Affectation terminée.");
}

export async function applyPlanAction(equipmentId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return act((ctx) => applyPlan(ctx, equipmentId, formToObject(formData)), "Plan appliqué : échéances créées.");
}

export async function retireEquipmentAction(equipmentId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return act((ctx) => retireEquipment(ctx, equipmentId, formToObject(formData)), "Équipement réformé.");
}

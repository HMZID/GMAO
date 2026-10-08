"use server";

import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { act, runAction } from "@/server/actions";
import { getAuthContext } from "@/server/auth/session";
import { recordReading } from "@/server/services/meters";
import {
  addOtherCost,
  addTask,
  createRecurrence,
  createWorkOrder,
  recordPart,
  recordTime,
  releaseWorkOrderReservations,
  setExternalCost,
  transitionWorkOrder,
  updatePlanning,
  updateReport,
  updateTask,
} from "@/server/services/work-orders";
import { formToObject } from "@/server/validation";
import { TRANSITION_ACTION } from "@/lib/labels";

export async function createWorkOrderAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await getAuthContext();
    const wo = await createWorkOrder(ctx, formToObject(formData));
    redirect(`/ordres-de-travail/${wo.id}`);
  });
}

export async function transitionAction(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const to = String(formData.get("to") ?? "");
  return act((ctx) => transitionWorkOrder(ctx, id, formToObject(formData)), `${TRANSITION_ACTION[to] ?? "Transition"} : effectué.`);
}

/**
 * Planification. Les cases à cocher décochées n'étant pas envoyées, des champs témoins indiquent
 * que la liste des intervenants et l'option « externe » font partie du formulaire.
 */
export async function planningAction(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return act(async (ctx) => {
    const data = formToObject(formData);
    if (formData.has("assigneesField")) data.assigneeIds = data.assigneeIds ?? [];
    if (formData.has("externalField")) data.isExternal = data.isExternal ?? false;
    delete data.assigneesField;
    delete data.externalField;
    const { warnings } = await updatePlanning(ctx, id, data);
    return { status: "success", message: "Planification enregistrée.", warnings } satisfies ActionState;
  });
}

export async function timeAction(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const action = String(formData.get("action") ?? "");
  const message = action === "start" ? "Pointage démarré." : action === "stop" ? "Pointage arrêté." : "Temps enregistré.";
  return act((ctx) => recordTime(ctx, id, formToObject(formData)), message);
}

export async function taskAction(id: string, taskId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return act(async (ctx) => {
    const { outOfBounds } = await updateTask(ctx, id, taskId, formToObject(formData));
    if (outOfBounds) {
      return {
        status: "success",
        message: "Mesure hors tolérance : point non conforme.",
        warnings: ["Créer un OT correctif si nécessaire (PRV-11)."],
      } satisfies ActionState;
    }
  }, "Point enregistré.");
}

export async function addTaskAction(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return act((ctx) => addTask(ctx, id, formToObject(formData)), "Point ajouté.");
}

export async function reportAction(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return act((ctx) => updateReport(ctx, id, formToObject(formData, { keepEmpty: true })), "Compte rendu enregistré.");
}

export async function workOrderReadingAction(id: string, meterId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return act(async (ctx) => {
    const { reading } = await recordReading(ctx, meterId, { ...formToObject(formData), workOrderId: id, source: "WORK_ORDER" });
    if (reading.status === "TO_CHECK") {
      return { status: "success", message: "Relevé enregistré, à vérifier :", warnings: reading.statusReasons ?? [] } satisfies ActionState;
    }
  }, "Relevé enregistré.");
}

export async function partAction(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const action = String(formData.get("action") ?? "");
  const message = action === "reserve" ? "Pièce réservée." : action === "issue" ? "Sortie enregistrée." : "Retour enregistré.";
  return act((ctx) => recordPart(ctx, id, formToObject(formData)), message);
}

export async function releaseReservationsAction(id: string, _: ActionState): Promise<ActionState> {
  return act((ctx) => releaseWorkOrderReservations(ctx, id), "Réservations libérées.");
}

export async function externalCostAction(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return act((ctx) => setExternalCost(ctx, id, formToObject(formData)), "Coût prestataire enregistré.");
}

export async function otherCostAction(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return act((ctx) => addOtherCost(ctx, id, formToObject(formData)), "Coût ajouté.");
}

export async function recurrenceAction(id: string, _: ActionState): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await getAuthContext();
    const wo = await createRecurrence(ctx, id);
    redirect(`/ordres-de-travail/${wo.id}`);
  });
}

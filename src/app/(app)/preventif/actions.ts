"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { act, runAction } from "@/server/actions";
import { getAuthContext } from "@/server/auth/session";
import { addOperation, createPlan, generatePreventiveWorkOrders, operationInput, postponeDueItem } from "@/server/services/preventive";
import { parseInput } from "@/server/services/_shared";
import { formToObject, text } from "@/server/validation";

/**
 * Opération saisie dans un formulaire à plat : déclencheurs calendaire et compteur facultatifs
 * (au moins un), checklist à raison d'un point par ligne.
 */
function operationFromForm(data: Record<string, unknown>) {
  const triggers: Record<string, unknown>[] = [];
  if (data.calendarEvery) triggers.push({ kind: "CALENDAR", every: data.calendarEvery, unit: data.calendarUnit ?? "MONTH" });
  if (data.meterEvery) triggers.push({ kind: "METER", every: data.meterEvery, meterType: data.meterType ?? "HOURS" });
  const checklist = String(data.checklist ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return parseInput(operationInput, {
    code: data.code,
    name: data.name,
    mode: data.mode,
    isRegulatory: data.isRegulatory,
    blockWhenOverdue: data.blockWhenOverdue,
    preAlertDays: data.preAlertDays,
    preAlertMeter: data.preAlertMeter,
    tolerancePercent: data.tolerancePercent,
    estimatedMinutes: data.estimatedMinutes,
    triggers,
    checklist,
  });
}

export async function createPlanAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await getAuthContext();
    const data = formToObject(formData);
    parseInput(z.object({ planName: text(160, "Nom du plan obligatoire") }), { planName: data.planName });
    const operation = operationFromForm(data);
    const plan = await createPlan(ctx, {
      name: data.planName,
      description: data.description,
      categoryId: data.categoryId,
      modelId: data.modelId,
      operations: [operation],
    });
    redirect(`/preventif/plans/${plan.id}`);
  });
}

export async function addOperationAction(planId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return act(
    (ctx) => addOperation(ctx, planId, operationFromForm(formToObject(formData))),
    "Opération ajoutée : nouvelle version du plan, échéances créées.",
  );
}

export async function generateAction(_: ActionState): Promise<ActionState> {
  return act(async (ctx) => {
    const { created } = await generatePreventiveWorkOrders(ctx);
    return {
      status: "success",
      message: created === 0 ? "Aucun OT à générer : toutes les échéances proches ont déjà leur OT." : `${created} OT préventif(s) généré(s).`,
    } satisfies ActionState;
  });
}

export async function postponeAction(dueItemId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return act((ctx) => postponeDueItem(ctx, dueItemId, formToObject(formData)), "Échéance reportée.");
}

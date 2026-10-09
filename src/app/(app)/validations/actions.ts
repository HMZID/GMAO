"use server";

import type { ActionState } from "@/lib/action-state";
import { act } from "@/server/actions";
import { addStep, addSubstitute, createWorkflow, decideApproval, removeStep, removeSubstitute, setWorkflowActive } from "@/server/services/approvals";
import { formToObject } from "@/server/validation";

/** Décision sur l'étape en cours : le bouton cliqué porte la décision (name="decision"). */
export async function decideApprovalAction(requestId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const decision = formData.get("decision");
  return act(
    (ctx) => decideApproval(ctx, requestId, formToObject(formData)),
    decision === "REJECTED" ? "Refus enregistré." : "Validation enregistrée.",
  );
}

/** Décision depuis la liste « À valider » : l'identifiant est dans le formulaire (un panneau pour toute la liste). */
export async function decideFromListAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const { requestId, ...fields } = formToObject(formData);
  return act(
    (ctx) => decideApproval(ctx, String(requestId ?? ""), fields),
    fields.decision === "REJECTED" ? "Refus enregistré." : "Validation enregistrée.",
  );
}

export async function addSubstituteAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return act((ctx) => addSubstitute(ctx, formToObject(formData)), "Suppléant désigné.");
}

export async function removeSubstituteAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return act((ctx) => removeSubstitute(ctx, String(formData.get("id") ?? "")), "Suppléance retirée.");
}

/* Paramétrage des circuits (administration) */

export async function createWorkflowAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return act((ctx) => createWorkflow(ctx, formToObject(formData)), "Circuit créé.");
}

export async function addStepAction(workflowId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return act((ctx) => addStep(ctx, workflowId, formToObject(formData)), "Étape ajoutée.");
}

export async function removeStepAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return act((ctx) => removeStep(ctx, String(formData.get("stepId") ?? "")), "Étape retirée.");
}

export async function setWorkflowActiveAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const active = formData.get("active") === "true";
  return act((ctx) => setWorkflowActive(ctx, String(formData.get("workflowId") ?? ""), active), active ? "Circuit activé." : "Circuit désactivé.");
}

"use server";

import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { act, runAction } from "@/server/actions";
import { getAuthContext } from "@/server/auth/session";
import { convertToWorkOrder, createWorkRequest, mergeIntoWorkOrder, qualifyWorkRequest, rejectWorkRequest } from "@/server/services/work-requests";
import { formToObject } from "@/server/validation";

export async function createWorkRequestAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await getAuthContext();
    const { request } = await createWorkRequest(ctx, formToObject(formData));
    redirect(`/demandes/${request.id}?cree=1`);
  });
}

export async function qualifyWorkRequestAction(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return act((ctx) => qualifyWorkRequest(ctx, id, formToObject(formData)), "DI qualifiée.");
}

export async function rejectWorkRequestAction(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return act((ctx) => rejectWorkRequest(ctx, id, formToObject(formData)), "DI rejetée : le déclarant est notifié.");
}

export async function convertWorkRequestAction(id: string, _: ActionState): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await getAuthContext();
    const wo = await convertToWorkOrder(ctx, id);
    redirect(`/ordres-de-travail/${wo.id}`);
  });
}

export async function mergeWorkRequestAction(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return act((ctx) => mergeIntoWorkOrder(ctx, id, String(formData.get("workOrderId") ?? "")), "DI rattachée à l'OT.");
}

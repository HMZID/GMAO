"use server";

import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { act, runAction } from "@/server/actions";
import { getAuthContext } from "@/server/auth/session";
import { cancelPurchaseRequest, createPurchaseRequest } from "@/server/services/purchase-requests";
import { formToObject } from "@/server/validation";

export async function createPurchaseRequestAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await getAuthContext();
    const row = await createPurchaseRequest(ctx, formToObject(formData));
    redirect(`/demandes-achat/${row.id}`);
  });
}

export async function cancelPurchaseRequestAction(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return act((ctx) => cancelPurchaseRequest(ctx, id, formToObject(formData)), "Demande annulée.");
}

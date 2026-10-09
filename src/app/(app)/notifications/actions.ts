"use server";

import type { ActionState } from "@/lib/action-state";
import { act } from "@/server/actions";
import { updateMyEmailPreferences } from "@/server/services/email";
import { markAllRead } from "@/server/services/notifications";
import { formToObject } from "@/server/validation";

export async function markAllReadAction(_: ActionState): Promise<ActionState> {
  return act((ctx) => markAllRead(ctx), "Toutes les notifications sont marquées comme lues.");
}

export async function updateEmailPreferencesAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return act((ctx) => updateMyEmailPreferences(ctx, formToObject(formData)), "Préférences enregistrées.");
}

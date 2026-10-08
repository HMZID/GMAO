"use server";

import type { ActionState } from "@/lib/action-state";
import { act } from "@/server/actions";
import { markAllRead } from "@/server/services/notifications";

export async function markAllReadAction(_: ActionState): Promise<ActionState> {
  return act((ctx) => markAllRead(ctx), "Toutes les notifications sont marquées comme lues.");
}

"use server";

import type { ActionState } from "@/lib/action-state";
import { act } from "@/server/actions";
import { cancelEmail, retryEmail, runEmailJobsNow } from "@/server/services/email";

export async function emailActionAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  const op = formData.get("op");
  return act(
    (ctx) => (op === "cancel" ? cancelEmail(ctx, id) : retryEmail(ctx, id)),
    op === "cancel" ? "Courriel annulé." : "Courriel remis en file.",
  );
}

export async function runEmailJobsAction(): Promise<ActionState> {
  return act(async (ctx) => {
    const r = await runEmailJobsNow(ctx);
    return {
      status: "success" as const,
      message: `Traitement effectué : ${r.queued} alerte(s) mise(s) en file, ${r.sent} envoyé(s), ${r.retried} à retenter, ${r.failed} en échec.`,
    };
  });
}

"use server";

import type { ActionState } from "@/lib/action-state";
import { act } from "@/server/actions";
import { createSupplier } from "@/server/services/stock";
import { formToObject } from "@/server/validation";

export async function createSupplierAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return act((ctx) => createSupplier(ctx, formToObject(formData)), "Fournisseur créé.");
}

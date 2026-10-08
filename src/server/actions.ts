import "server-only";
import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { getAuthContext } from "@/server/auth/session";
import type { AuthContext } from "@/server/authz/context";
import { AppError, BusinessRuleError, ConflictError, ValidationError } from "@/server/errors";

/**
 * Exécute une Server Action et traduit les erreurs applicatives en état de formulaire.
 * Les redirections et autres signaux de Next.js sont relancés (unstable_rethrow).
 */
export async function runAction(fn: () => Promise<ActionState | void>, successMessage = "Enregistré."): Promise<ActionState> {
  try {
    const result = await fn();
    return result ?? { status: "success", message: successMessage, at: Date.now() };
  } catch (error) {
    unstable_rethrow(error);
    return toActionState(error);
  }
}

/**
 * Server Action de formulaire standard : contexte de l'utilisateur connecté, appel du service
 * (mêmes règles et mêmes droits que l'API), puis rafraîchissement de la page affichée.
 * Le service peut renvoyer un ActionState (avertissements, message particulier).
 */
export async function act(fn: (ctx: AuthContext) => Promise<unknown>, successMessage = "Enregistré."): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await getAuthContext();
    const result = await fn(ctx);
    refresh();
    return isActionState(result) ? { ...result, at: Date.now() } : undefined;
  }, successMessage);
}

function isActionState(value: unknown): value is ActionState {
  return !!value && typeof value === "object" && "status" in value && ["idle", "success", "error"].includes((value as ActionState).status);
}

export function toActionState(error: unknown): ActionState {
  const at = Date.now();
  if (error instanceof ValidationError) {
    return { status: "error", message: error.message, fieldErrors: error.fieldErrors, at };
  }
  if (error instanceof BusinessRuleError) {
    return { status: "error", message: "Action refusée :", errors: error.errors, at };
  }
  if (error instanceof ConflictError || error instanceof AppError) {
    return { status: "error", message: error.message, at };
  }
  console.error("[action] erreur inattendue", error);
  return { status: "error", message: "Erreur inattendue. Réessayer ou contacter l'administrateur.", at };
}

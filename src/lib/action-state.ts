/** État renvoyé par les Server Actions aux formulaires (partagé client / serveur). */
export type ActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  /** Conditions métier non remplies, affichées toutes en une fois (DON-11). */
  errors?: string[];
  /** Erreurs par champ (validation Zod). */
  fieldErrors?: Record<string, string[] | undefined>;
  /** Avertissements non bloquants (doublons, conflits de planning). */
  warnings?: string[];
  at?: number;
};

export const initialActionState: ActionState = { status: "idle" };

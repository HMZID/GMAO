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
  /** Valeur à remettre une seule fois (clé d'API) : affichée avec un bouton « Copier », jamais conservée. */
  secret?: string;
  at?: number;
};

export const initialActionState: ActionState = { status: "idle" };

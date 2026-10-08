/**
 * Circuits de validation (CDC §2.4, HAB-04, ACH-02) : étapes applicables selon le montant et la priorité,
 * droit de décider, enchaînement des étapes. Module pur, testé dans `__tests__/approvals.test.ts`.
 */
import type { Role } from "@/server/authz/permissions";

export const APPROVAL_OBJECTS = ["WORK_REQUEST", "PURCHASE_REQUEST", "MAINTENANCE_EXPENSE"] as const;
export type ApprovalObject = (typeof APPROVAL_OBJECTS)[number];

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
export type Decision = "APPROVED" | "REJECTED";

/** Étape d'un circuit : un rôle (dans le périmètre de l'objet) ou une personne nommée, et ses conditions. */
export type StepDefinition = {
  position: number;
  name: string;
  approverRole: Role | null;
  approverUserId: string | null;
  /** L'étape s'applique à partir de ce montant (inclus) ; null : quel que soit le montant. */
  minAmount: number | null;
  /** L'étape ne s'applique qu'à ces priorités (DI) ; vide : toutes. */
  priorities: string[];
};

/** Étape retenue pour une demande : figée à la soumission, une modification du circuit ne la change pas. */
export type RequestStep = Pick<StepDefinition, "position" | "name" | "approverRole" | "approverUserId">;

/** Étapes qui s'appliquent à l'objet soumis, dans l'ordre. Aucune étape : pas de validation requise. */
export function applicableSteps(steps: StepDefinition[], object: { amount?: number | null; priority?: string | null }): RequestStep[] {
  return steps
    .filter((s) => s.minAmount === null || (object.amount ?? 0) >= s.minAmount)
    .filter((s) => s.priorities.length === 0 || (!!object.priority && s.priorities.includes(object.priority)))
    .sort((a, b) => a.position - b.position)
    .map(({ position, name, approverRole, approverUserId }) => ({ position, name, approverRole, approverUserId }));
}

/** Contrôle de cohérence d'une étape saisie par l'administrateur. */
export function checkStepDefinition(step: Pick<StepDefinition, "approverRole" | "approverUserId" | "minAmount">): string[] {
  const errors: string[] = [];
  if (!step.approverRole && !step.approverUserId) errors.push("Choisir un rôle valideur ou une personne nommée.");
  if (step.approverRole && step.approverUserId) errors.push("Choisir un rôle ou une personne, pas les deux.");
  if (step.minAmount !== null && step.minAmount < 0) errors.push("Le seuil doit être positif.");
  return errors;
}

export type DecisionCheckInput = {
  status: ApprovalStatus;
  decision: Decision;
  comment?: string | null;
  actorId: string;
  requesterId: string;
  /** L'acteur est valideur de l'étape en cours (directement ou comme suppléant). */
  eligible: boolean;
  /** Personnes ayant déjà approuvé une étape précédente de la même demande. */
  previousApproverIds: string[];
};

/**
 * Une décision est-elle permise ? Toutes les conditions manquantes sont listées en une fois (DON-11).
 * Le demandeur ne décide pas de sa propre demande (ACH-02) ; un même valideur n'approuve pas deux étapes.
 */
export function checkDecision(input: DecisionCheckInput): string[] {
  if (input.status !== "PENDING") return ["Cette demande n'est plus en attente de validation."];
  const errors: string[] = [];
  if (input.actorId === input.requesterId) errors.push("Le demandeur ne peut pas décider de sa propre demande.");
  if (!input.eligible) errors.push("Vous n'êtes pas valideur de l'étape en cours.");
  if (input.decision === "APPROVED" && input.previousApproverIds.includes(input.actorId)) {
    errors.push("Vous avez déjà validé une étape précédente : une autre personne doit valider celle-ci.");
  }
  if (input.decision === "REJECTED" && !input.comment?.trim()) errors.push("Le commentaire est obligatoire en cas de refus.");
  return errors;
}

/** État de la demande après une décision : étape suivante, ou décision finale. */
export function afterDecision(
  steps: RequestStep[],
  currentPosition: number,
  decision: Decision,
): { status: Exclude<ApprovalStatus, "CANCELLED">; nextPosition: number | null } {
  if (decision === "REJECTED") return { status: "REJECTED", nextPosition: null };
  const next = steps.filter((s) => s.position > currentPosition).sort((a, b) => a.position - b.position)[0];
  return next ? { status: "PENDING", nextPosition: next.position } : { status: "APPROVED", nextPosition: null };
}

/** Suppléance active à un instant donné (CDC §2.4 : suppléant pour une période). */
export function isActiveSubstitution(s: { validFrom: Date; validTo: Date }, now: Date) {
  return s.validFrom <= now && now <= s.validTo;
}

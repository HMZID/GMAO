/**
 * Machine à états des ordres de travail (CDC §5.4, COR-06, DON-08, DON-10, DON-11).
 * Module pur : aucune dépendance à la base, testé dans `__tests__/work-order-status.test.ts`.
 */

export const WORK_ORDER_STATUSES = ["CREATED", "PLANNED", "ON_HOLD", "IN_PROGRESS", "WORK_DONE", "TECH_CLOSED", "CLOSED", "CANCELLED"] as const;

export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number];

export type HoldReason = "PARTS" | "CONTRACTOR" | "ACCESS" | "QUOTE" | "OTHER";

/** Transitions autorisées : toute transition absente est refusée, y compris par l'API. */
export const ALLOWED_TRANSITIONS: Record<WorkOrderStatus, readonly WorkOrderStatus[]> = {
  CREATED: ["PLANNED", "ON_HOLD", "CANCELLED"],
  PLANNED: ["IN_PROGRESS", "ON_HOLD", "CANCELLED"],
  ON_HOLD: ["PLANNED", "IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["ON_HOLD", "WORK_DONE"],
  WORK_DONE: ["IN_PROGRESS", "TECH_CLOSED"],
  TECH_CLOSED: ["CLOSED", "IN_PROGRESS"],
  CLOSED: [],
  CANCELLED: [],
};

export const FINAL_STATUSES: readonly WorkOrderStatus[] = ["CLOSED", "CANCELLED"];

/** Statuts pendant lesquels l'OT est « ouvert » (non clôturé techniquement ni annulé). */
export const OPEN_STATUSES: readonly WorkOrderStatus[] = ["CREATED", "PLANNED", "ON_HOLD", "IN_PROGRESS", "WORK_DONE"];

/** Délai de réouverture après clôture technique, en jours (CDC §5.4) [AC]. */
export const REOPEN_DELAY_DAYS = 7;

/** Photographie de l'OT nécessaire aux contrôles de transition. */
export type WorkOrderSnapshot = {
  status: WorkOrderStatus;
  isExternal: boolean;
  isSafetyRelated: boolean;
  equipmentCriticality: "A" | "B" | "C";
  equipmentHasMeter: boolean;
  plannedStart: Date | null;
  assigneeTechnicianIds: string[];
  hasSupplier: boolean;
  techClosedAt: Date | null;
  /** Lignes de travaux renseignées (tâches faites ou compte rendu). */
  hasWorkDescription: boolean;
  requiredTasksIncomplete: number;
  totalMinutes: number;
  hasOpenTimeEntry: boolean;
  hasMeterReadingSinceStart: boolean;
  activeReservations: number;
  consumedPartLines: number;
  timeEntryCount: number;
  externalCostKnown: boolean;
};

export type TransitionInput = {
  to: WorkOrderStatus;
  reason?: string | null;
  holdReason?: HoldReason | null;
  /** Essais de remise en service conformes (étape 8 du processus). */
  testsPassed?: boolean;
  /** Personne qui demande la transition. */
  actor: {
    userId: string;
    technicianId?: string | null;
    /** Peut valider une remise en service (rôle + habilitation). */
    canReleaseCriticalEquipment: boolean;
    /** Peut gérer les OT (chef d'atelier, responsable maintenance). */
    canManage: boolean;
  };
};

export type TransitionCheck = { ok: true } | { ok: false; errors: string[] };

/** La remise en service doit-elle être validée par une personne habilitée ? (COR-12, DON-07) */
export function requiresReleaseValidation(wo: Pick<WorkOrderSnapshot, "equipmentCriticality" | "isSafetyRelated">) {
  return wo.equipmentCriticality === "A" || wo.isSafetyRelated;
}

/**
 * Vérifie qu'une transition est permise et renvoie, en une fois, toutes les conditions manquantes (DON-11).
 */
export function checkTransition(wo: WorkOrderSnapshot, input: TransitionInput, now: Date = new Date()): TransitionCheck {
  const { to, actor } = input;
  const errors: string[] = [];

  if (!ALLOWED_TRANSITIONS[wo.status].includes(to)) {
    return { ok: false, errors: [`Transition interdite : ${wo.status} → ${to}.`] };
  }

  const reason = input.reason?.trim();

  switch (to) {
    case "PLANNED": {
      if (!actor.canManage) errors.push("Seul un gestionnaire d'OT peut planifier.");
      if (!wo.plannedStart) errors.push("La date prévue est obligatoire.");
      if (wo.assigneeTechnicianIds.length === 0 && !(wo.isExternal && wo.hasSupplier)) {
        errors.push("Au moins un intervenant (technicien ou prestataire) est obligatoire.");
      }
      break;
    }
    case "ON_HOLD": {
      if (!input.holdReason) errors.push("Le motif de mise en attente est obligatoire.");
      break;
    }
    case "IN_PROGRESS": {
      const isAssignee = !!actor.technicianId && wo.assigneeTechnicianIds.includes(actor.technicianId);
      if (!isAssignee && !actor.canManage) errors.push("Seul un intervenant affecté peut démarrer l'OT.");
      if (wo.status === "WORK_DONE" && !reason) errors.push("Le motif (essai non concluant) est obligatoire.");
      if (wo.status === "TECH_CLOSED") {
        if (!reason) errors.push("Le motif de réouverture est obligatoire.");
        if (!actor.canManage) errors.push("Seul un gestionnaire d'OT peut rouvrir.");
        if (wo.techClosedAt && daysBetween(wo.techClosedAt, now) > REOPEN_DELAY_DAYS) {
          errors.push(`Réouverture impossible au-delà de ${REOPEN_DELAY_DAYS} jours : créer un OT de récidive lié (COR-14).`);
        }
      }
      break;
    }
    case "WORK_DONE": {
      if (!wo.hasWorkDescription) errors.push("Au moins une ligne de travaux ou un compte rendu est obligatoire.");
      if (wo.requiredTasksIncomplete > 0) {
        errors.push(`${wo.requiredTasksIncomplete} point(s) obligatoire(s) de checklist à renseigner.`);
      }
      if (wo.equipmentHasMeter && !wo.hasMeterReadingSinceStart) {
        errors.push("Le relevé du compteur est obligatoire.");
      }
      if (!wo.isExternal && wo.totalMinutes <= 0) errors.push("Le temps passé doit être saisi.");
      if (wo.hasOpenTimeEntry) errors.push("Un pointage est encore en cours.");
      break;
    }
    case "TECH_CLOSED": {
      if (!input.testsPassed) errors.push("Les essais de remise en service doivent être conformes.");
      if (requiresReleaseValidation(wo)) {
        if (!actor.canReleaseCriticalEquipment) {
          errors.push("La remise en service doit être validée par une personne habilitée.");
        }
        if (actor.technicianId && wo.assigneeTechnicianIds.includes(actor.technicianId)) {
          errors.push("Le valideur doit être différent de l'exécutant (séparation des tâches).");
        }
      } else if (!actor.canManage) {
        errors.push("Seul un gestionnaire d'OT peut clôturer techniquement.");
      }
      if (wo.activeReservations > 0) {
        errors.push("Des réservations de pièces sont encore actives : les consommer ou les retourner.");
      }
      break;
    }
    case "CLOSED": {
      if (!actor.canManage) errors.push("Seul un gestionnaire d'OT peut clôturer administrativement.");
      if (wo.hasOpenTimeEntry) errors.push("Un pointage est encore ouvert.");
      if (wo.isExternal && !wo.externalCostKnown) {
        errors.push("Le coût du prestataire (facture ou provision) doit être renseigné.");
      }
      break;
    }
    case "CANCELLED": {
      if (!actor.canManage) errors.push("Seul un gestionnaire d'OT peut annuler.");
      if (!reason) errors.push("Le motif d'annulation est obligatoire.");
      if (wo.timeEntryCount > 0 || wo.consumedPartLines > 0) {
        errors.push("Annulation impossible : du temps ou des pièces sont imputés. Clôturer « sans suite » (DON-08).");
      }
      break;
    }
    default:
      break;
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

/** Transitions proposées à l'utilisateur depuis un statut donné. */
export function nextStatuses(status: WorkOrderStatus): readonly WorkOrderStatus[] {
  return ALLOWED_TRANSITIONS[status];
}

function daysBetween(from: Date, to: Date) {
  return (to.getTime() - from.getTime()) / 86_400_000;
}

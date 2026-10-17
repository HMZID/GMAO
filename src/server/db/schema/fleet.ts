import { index, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { createdAt, id, money, ts, updatedAt } from "./columns";
import { deadlineKindEnum, deadlineStatusEnum } from "./enums";
import { equipment } from "./equipment";
import { tenants } from "./organization";

/**
 * Échéances administratives d'un équipement (assurance, visite technique, vignette…). Une échéance renouvelée
 * passe « faite » et en crée une nouvelle (renewalOfId) : l'historique des renouvellements est conservé.
 * Alertes au responsable du parc : `src/server/services/email.ts` (fleetDeadlineAlerts).
 */
export const equipmentDeadlines = pgTable(
  "equipment_deadlines",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    equipmentId: uuid("equipment_id")
      .notNull()
      .references(() => equipment.id),
    kind: deadlineKindEnum("kind").notNull(),
    /** Libellé précis (« Assurance tous risques », « Vignette 2027 »…) ; sinon le type. */
    label: text("label"),
    /** Assureur, centre de visite technique, recette des finances… */
    provider: text("provider"),
    /** N° de police, de procès-verbal, de quittance… */
    reference: text("reference"),
    dueDate: ts("due_date").notNull(),
    amount: money("amount"),
    notes: text("notes"),
    status: deadlineStatusEnum("status").notNull().default("OPEN"),
    doneAt: ts("done_at"),
    doneById: text("done_by_id").references(() => user.id),
    renewalOfId: uuid("renewal_of_id"),
    createdById: text("created_by_id").references(() => user.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("equipment_deadlines_due_idx").on(t.tenantId, t.status, t.dueDate), index("equipment_deadlines_equipment_idx").on(t.equipmentId)],
);

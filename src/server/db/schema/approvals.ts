import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, text, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { RequestStep } from "@/server/domain/approvals";
import { user } from "./auth";
import { createdAt, id, money, quantity, ts, updatedAt } from "./columns";
import { approvalDecisionEnum, approvalObjectEnum, approvalStatusEnum, purchaseRequestStatusEnum, roleEnum } from "./enums";
import { equipment } from "./equipment";
import { workOrders } from "./maintenance";
import { companies, costCenters, sites, tenants } from "./organization";
import { parts, suppliers } from "./stock";

/**
 * Circuits de validation paramétrables (CDC §2.4, HAB-04) : un circuit par type d'objet, pour une
 * société ou pour tout le groupe, fait d'étapes ordonnées avec leurs valideurs et leurs seuils.
 */
export const approvalWorkflows = pgTable(
  "approval_workflows",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    /** Société concernée ; null : circuit du groupe, utilisé à défaut de circuit propre à la société. */
    companyId: uuid("company_id").references(() => companies.id),
    objectType: approvalObjectEnum("object_type").notNull(),
    name: text("name").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [unique("approval_workflows_uq").on(t.tenantId, t.companyId, t.objectType).nullsNotDistinct()],
);

export const approvalSteps = pgTable(
  "approval_steps",
  {
    id: id(),
    workflowId: uuid("workflow_id")
      .notNull()
      .references(() => approvalWorkflows.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    name: text("name").notNull(),
    /** Rôle valideur, détenu sur la société ou le site de l'objet. */
    approverRole: roleEnum("approver_role"),
    /** Ou personne nommée. */
    approverUserId: text("approver_user_id").references(() => user.id),
    /** Seuil financier : l'étape s'applique à partir de ce montant (inclus). */
    minAmount: money("min_amount"),
    /** Priorités concernées (DI) ; vide : toutes. */
    priorities: jsonb("priorities").$type<string[]>().notNull().default([]),
  },
  (t) => [uniqueIndex("approval_steps_position_uq").on(t.workflowId, t.position)],
);

/** Suppléants des valideurs, pour une période (CDC §2.4). */
export const approvalSubstitutes = pgTable(
  "approval_substitutes",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    substituteUserId: text("substitute_user_id")
      .notNull()
      .references(() => user.id),
    validFrom: ts("valid_from").notNull(),
    validTo: ts("valid_to").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("approval_substitutes_sub_idx").on(t.substituteUserId), index("approval_substitutes_user_idx").on(t.userId)],
);

/**
 * Demande de validation d'un objet. Les étapes applicables sont figées à la soumission : un objet soumis
 * ne change pas d'état sans décision tracée (HAB-04), même si le circuit est modifié entre-temps.
 */
export const approvalRequests = pgTable(
  "approval_requests",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    siteId: uuid("site_id").references(() => sites.id),
    objectType: approvalObjectEnum("object_type").notNull(),
    objectId: uuid("object_id").notNull(),
    /** Libellé affiché dans les listes (numéro, objet). */
    label: text("label").notNull(),
    amount: money("amount"),
    workflowId: uuid("workflow_id")
      .notNull()
      .references(() => approvalWorkflows.id),
    steps: jsonb("steps").$type<RequestStep[]>().notNull(),
    currentPosition: integer("current_position"),
    status: approvalStatusEnum("status").notNull().default("PENDING"),
    requestedById: text("requested_by_id")
      .notNull()
      .references(() => user.id),
    createdAt: createdAt(),
    decidedAt: ts("decided_at"),
  },
  (t) => [
    index("approval_requests_object_idx").on(t.objectType, t.objectId),
    index("approval_requests_status_idx").on(t.tenantId, t.status),
    // Une seule demande en attente par objet.
    uniqueIndex("approval_requests_pending_uq")
      .on(t.objectType, t.objectId)
      .where(sql`status = 'PENDING'`),
  ],
);

/** Décisions, en ajout seul : auteur, date, décision, commentaire (obligatoire en cas de refus). */
export const approvalDecisions = pgTable(
  "approval_decisions",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    requestId: uuid("request_id")
      .notNull()
      .references(() => approvalRequests.id),
    stepPosition: integer("step_position").notNull(),
    stepName: text("step_name").notNull(),
    decision: approvalDecisionEnum("decision").notNull(),
    comment: text("comment"),
    decidedById: text("decided_by_id")
      .notNull()
      .references(() => user.id),
    /** Valideur remplacé, quand la décision est prise par son suppléant. */
    onBehalfOfId: text("on_behalf_of_id").references(() => user.id),
    createdAt: createdAt(),
  },
  (t) => [index("approval_decisions_request_idx").on(t.requestId, t.createdAt)],
);

/**
 * Demandes d'achat de pièces ou de prestations (ACH-01, ACH-02) : rattachées à un OT, un équipement
 * ou un centre de coût, validées selon le circuit « demande d'achat ».
 */
export const purchaseRequests = pgTable(
  "purchase_requests",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id),
    number: text("number").notNull(),
    description: text("description").notNull(),
    partId: uuid("part_id").references(() => parts.id),
    quantity: quantity("quantity").notNull(),
    estimatedUnitPrice: money("estimated_unit_price").notNull(),
    amount: money("amount").notNull(),
    supplierId: uuid("supplier_id").references(() => suppliers.id),
    workOrderId: uuid("work_order_id").references(() => workOrders.id),
    equipmentId: uuid("equipment_id").references(() => equipment.id),
    costCenterId: uuid("cost_center_id").references(() => costCenters.id),
    neededBy: ts("needed_by"),
    status: purchaseRequestStatusEnum("status").notNull().default("PENDING_APPROVAL"),
    cancellationReason: text("cancellation_reason"),
    requestedById: text("requested_by_id")
      .notNull()
      .references(() => user.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("purchase_requests_number_uq").on(t.tenantId, t.number),
    index("purchase_requests_scope_idx").on(t.tenantId, t.companyId, t.siteId),
    index("purchase_requests_wo_idx").on(t.workOrderId),
  ],
);

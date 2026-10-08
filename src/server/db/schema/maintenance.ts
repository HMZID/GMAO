import { boolean, doublePrecision, index, integer, jsonb, pgTable, primaryKey, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, meterValue, money, quantity, ts, updatedAt } from "./columns";
import {
  calendarUnitEnum,
  downtimeReasonEnum,
  dueStatusEnum,
  holdReasonEnum,
  meterTypeEnum,
  operationModeEnum,
  priorityEnum,
  requestStatusEnum,
  requestTypeEnum,
  taskKindEnum,
  taskResultEnum,
  triggerKindEnum,
  workOrderOutcomeEnum,
  workOrderStatusEnum,
  workOrderTypeEnum,
} from "./enums";
import { user } from "./auth";
import { equipment, equipmentCategories, equipmentModels, meters } from "./equipment";
import { companies, jobsites, sites, tenants, workshops } from "./organization";
import { technicians } from "./resources";
import { parts, suppliers } from "./stock";

/* ------------------------------------------------------------------ */
/* Gammes (CDC §4.1, PRV-11)                                           */
/* ------------------------------------------------------------------ */

export const taskLists = pgTable("task_lists", {
  id: id(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  name: text("name").notNull(),
  description: text("description"),
  estimatedMinutes: integer("estimated_minutes"),
  safetyNotes: text("safety_notes"),
  requiredSkillCodes: jsonb("required_skill_codes").$type<string[]>().notNull().default([]),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const taskListItems = pgTable(
  "task_list_items",
  {
    id: id(),
    taskListId: uuid("task_list_id")
      .notNull()
      .references(() => taskLists.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    label: text("label").notNull(),
    kind: taskKindEnum("kind").notNull().default("CHECK"),
    unit: text("unit"),
    minValue: doublePrecision("min_value"),
    maxValue: doublePrecision("max_value"),
    required: boolean("required").notNull().default(true),
  },
  (t) => [index("task_list_items_list_idx").on(t.taskListId, t.position)],
);

export const taskListParts = pgTable(
  "task_list_parts",
  {
    id: id(),
    taskListId: uuid("task_list_id")
      .notNull()
      .references(() => taskLists.id, { onDelete: "cascade" }),
    partId: uuid("part_id")
      .notNull()
      .references(() => parts.id),
    quantity: quantity("quantity").notNull(),
  },
  (t) => [index("task_list_parts_list_idx").on(t.taskListId)],
);

/* ------------------------------------------------------------------ */
/* Plans d'entretien (CDC §4, PRV-01 à PRV-12)                         */
/* ------------------------------------------------------------------ */

export const maintenancePlans = pgTable("maintenance_plans", {
  id: id(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  name: text("name").notNull(),
  description: text("description"),
  /** Plan type par catégorie ou par modèle ; equipmentId pour un plan propre à un équipement. */
  categoryId: uuid("category_id").references(() => equipmentCategories.id),
  modelId: uuid("model_id").references(() => equipmentModels.id),
  version: integer("version").notNull().default(1),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const planOperations = pgTable(
  "plan_operations",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    planId: uuid("plan_id")
      .notNull()
      .references(() => maintenancePlans.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    /** PRV-04 : échéance fixe (grille théorique) ou glissante (recalculée après réalisation). */
    mode: operationModeEnum("mode").notNull().default("SLIDING"),
    isRegulatory: boolean("is_regulatory").notNull().default(false),
    /** PRV-12 : bloque l'équipement quand le contrôle réglementaire est échu. */
    blockWhenOverdue: boolean("block_when_overdue").notNull().default(false),
    /** Pré-alerte (PRV-06) en jours et/ou en unités de compteur. */
    preAlertDays: integer("pre_alert_days"),
    preAlertMeter: meterValue("pre_alert_meter"),
    /** Tolérance de retard (PRV-09) en % de l'intervalle. */
    tolerancePercent: integer("tolerance_percent").notNull().default(10),
    taskListId: uuid("task_list_id").references(() => taskLists.id),
    estimatedMinutes: integer("estimated_minutes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("plan_operations_plan_idx").on(t.planId)],
);

/**
 * Déclencheurs d'une opération (PRV-02, PRV-03). Plusieurs déclencheurs = premier seuil atteint.
 * CALENDAR : every + unit ; METER : every + meterType.
 */
export const planTriggers = pgTable(
  "plan_triggers",
  {
    id: id(),
    operationId: uuid("operation_id")
      .notNull()
      .references(() => planOperations.id, { onDelete: "cascade" }),
    kind: triggerKindEnum("kind").notNull(),
    every: doublePrecision("every").notNull(),
    calendarUnit: calendarUnitEnum("calendar_unit"),
    meterType: meterTypeEnum("meter_type"),
  },
  (t) => [index("plan_triggers_op_idx").on(t.operationId)],
);

/** Application d'un plan à un équipement, avec surcharges tracées (PRV-01, PRV-13). */
export const equipmentPlans = pgTable(
  "equipment_plans",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    equipmentId: uuid("equipment_id")
      .notNull()
      .references(() => equipment.id),
    planId: uuid("plan_id")
      .notNull()
      .references(() => maintenancePlans.id),
    active: boolean("active").notNull().default(true),
    suspendedReason: text("suspended_reason"),
    /** Surcharges locales par code d'opération, ex. { "VID-250": { every: 200 } } (TODO PRV-01). */
    overrides: jsonb("overrides").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("equipment_plans_uq").on(t.equipmentId, t.planId)],
);

/**
 * Échéance d'une opération sur un équipement (CDC §4.4).
 * Une seule échéance ouverte par opération et équipement ; la base (date, compteur) sert au calcul suivant.
 */
export const dueItems = pgTable(
  "due_items",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    equipmentId: uuid("equipment_id")
      .notNull()
      .references(() => equipment.id),
    equipmentPlanId: uuid("equipment_plan_id")
      .notNull()
      .references(() => equipmentPlans.id),
    operationId: uuid("operation_id")
      .notNull()
      .references(() => planOperations.id),
    meterId: uuid("meter_id").references(() => meters.id),
    baseDate: ts("base_date").notNull(),
    baseMeterValue: meterValue("base_meter_value"),
    dueDate: ts("due_date"),
    dueMeterValue: meterValue("due_meter_value"),
    projectedDate: ts("projected_date"),
    status: dueStatusEnum("status").notNull().default("UPCOMING"),
    workOrderId: uuid("work_order_id"),
    completedAt: ts("completed_at"),
    completedMeterValue: meterValue("completed_meter_value"),
    postponedTo: ts("postponed_to"),
    postponeReason: text("postpone_reason"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("due_items_status_idx").on(t.tenantId, t.status), index("due_items_equipment_idx").on(t.equipmentId)],
);

/* ------------------------------------------------------------------ */
/* Demandes d'intervention (CDC §5.1, §5.3)                            */
/* ------------------------------------------------------------------ */

export const workRequests = pgTable(
  "work_requests",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    number: text("number").notNull(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id),
    equipmentId: uuid("equipment_id")
      .notNull()
      .references(() => equipment.id),
    reportedById: text("reported_by_id").references(() => user.id),
    reportedAt: ts("reported_at").notNull(),
    symptom: text("symptom").notNull(),
    description: text("description"),
    isStopped: boolean("is_stopped").notNull().default(false),
    isSafetyRisk: boolean("is_safety_risk").notNull().default(false),
    meterValue: meterValue("meter_value"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    status: requestStatusEnum("status").notNull().default("NEW"),
    priority: priorityEnum("priority"),
    type: requestTypeEnum("type"),
    immobilize: boolean("immobilize").notNull().default(false),
    rejectionReason: text("rejection_reason"),
    mergedIntoId: uuid("merged_into_id"),
    workOrderId: uuid("work_order_id"),
    qualifiedById: text("qualified_by_id").references(() => user.id),
    qualifiedAt: ts("qualified_at"),
    clientId: text("client_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("work_requests_number_uq").on(t.tenantId, t.number),
    uniqueIndex("work_requests_client_uq").on(t.tenantId, t.clientId),
    index("work_requests_scope_idx").on(t.tenantId, t.companyId, t.siteId, t.status),
    index("work_requests_equipment_idx").on(t.equipmentId),
  ],
);

/* ------------------------------------------------------------------ */
/* Ordres de travail (CDC §5.4, COR-05 à COR-15)                       */
/* ------------------------------------------------------------------ */

export const workOrders = pgTable(
  "work_orders",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    number: text("number").notNull(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id),
    equipmentId: uuid("equipment_id")
      .notNull()
      .references(() => equipment.id),
    type: workOrderTypeEnum("type").notNull(),
    status: workOrderStatusEnum("status").notNull().default("CREATED"),
    priority: priorityEnum("priority").notNull().default("P3"),
    title: text("title").notNull(),
    description: text("description"),
    /** Le statut de l'équipement dépend des OT immobilisants (CDC §5.5). */
    isImmobilizing: boolean("is_immobilizing").notNull().default(false),
    /** Défaut de sécurité : impose la validation de remise en service (COR-12). */
    isSafetyRelated: boolean("is_safety_related").notNull().default(false),
    holdReason: holdReasonEnum("hold_reason"),
    holdComment: text("hold_comment"),
    workshopId: uuid("workshop_id").references(() => workshops.id),
    jobsiteId: uuid("jobsite_id").references(() => jobsites.id),
    isExternal: boolean("is_external").notNull().default(false),
    supplierId: uuid("supplier_id").references(() => suppliers.id),
    /** Coût externe (devis, commande puis facture) — COR-15, ACH-10. */
    externalCost: money("external_cost"),
    externalCostIsFinal: boolean("external_cost_is_final").notNull().default(false),
    plannedStart: ts("planned_start"),
    plannedEnd: ts("planned_end"),
    estimatedMinutes: integer("estimated_minutes"),
    dueItemId: uuid("due_item_id").references(() => dueItems.id),
    taskListId: uuid("task_list_id").references(() => taskLists.id),
    workSummary: text("work_summary"),
    symptomCode: text("symptom_code"),
    causeCode: text("cause_code"),
    remedyCode: text("remedy_code"),
    outcome: workOrderOutcomeEnum("outcome"),
    meterValueAtClose: meterValue("meter_value_at_close"),
    startedAt: ts("started_at"),
    workDoneAt: ts("work_done_at"),
    techClosedAt: ts("tech_closed_at"),
    closedAt: ts("closed_at"),
    cancelledAt: ts("cancelled_at"),
    cancelReason: text("cancel_reason"),
    releaseValidatedById: text("release_validated_by_id").references(() => user.id),
    releaseValidatedAt: ts("release_validated_at"),
    reopenCount: integer("reopen_count").notNull().default(0),
    /** OT d'origine pour une récidive (COR-14). */
    parentWorkOrderId: uuid("parent_work_order_id"),
    createdById: text("created_by_id").references(() => user.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("work_orders_number_uq").on(t.tenantId, t.number),
    index("work_orders_scope_idx").on(t.tenantId, t.companyId, t.siteId, t.status),
    index("work_orders_equipment_idx").on(t.equipmentId, t.createdAt),
    index("work_orders_planned_idx").on(t.tenantId, t.plannedStart),
  ],
);

export const workOrderAssignees = pgTable(
  "work_order_assignees",
  {
    workOrderId: uuid("work_order_id")
      .notNull()
      .references(() => workOrders.id, { onDelete: "cascade" }),
    technicianId: uuid("technician_id")
      .notNull()
      .references(() => technicians.id),
  },
  (t) => [primaryKey({ columns: [t.workOrderId, t.technicianId] })],
);

/** Lignes de travaux et points de checklist (COR-11, PRV-11). */
export const workOrderTasks = pgTable(
  "work_order_tasks",
  {
    id: id(),
    workOrderId: uuid("work_order_id")
      .notNull()
      .references(() => workOrders.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    label: text("label").notNull(),
    kind: taskKindEnum("kind").notNull().default("CHECK"),
    required: boolean("required").notNull().default(false),
    unit: text("unit"),
    minValue: doublePrecision("min_value"),
    maxValue: doublePrecision("max_value"),
    result: taskResultEnum("result"),
    measuredValue: doublePrecision("measured_value"),
    comment: text("comment"),
    doneById: text("done_by_id").references(() => user.id),
    doneAt: ts("done_at"),
  },
  (t) => [index("work_order_tasks_wo_idx").on(t.workOrderId, t.position)],
);

export const workOrderStatusHistory = pgTable(
  "work_order_status_history",
  {
    id: id(),
    workOrderId: uuid("work_order_id")
      .notNull()
      .references(() => workOrders.id, { onDelete: "cascade" }),
    fromStatus: workOrderStatusEnum("from_status"),
    toStatus: workOrderStatusEnum("to_status").notNull(),
    reason: text("reason"),
    changedById: text("changed_by_id").references(() => user.id),
    changedAt: createdAt(),
  },
  (t) => [index("wo_status_history_wo_idx").on(t.workOrderId, t.changedAt)],
);

/** Pointages (COR-09) ; le taux horaire est figé à la saisie (KPI-02). */
export const timeEntries = pgTable(
  "time_entries",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    workOrderId: uuid("work_order_id")
      .notNull()
      .references(() => workOrders.id),
    technicianId: uuid("technician_id")
      .notNull()
      .references(() => technicians.id),
    startedAt: ts("started_at").notNull(),
    endedAt: ts("ended_at"),
    minutes: integer("minutes"),
    hourlyRate: money("hourly_rate"),
    comment: text("comment"),
    clientId: text("client_id"),
    createdById: text("created_by_id").references(() => user.id),
    createdAt: createdAt(),
  },
  (t) => [
    index("time_entries_wo_idx").on(t.workOrderId),
    index("time_entries_tech_idx").on(t.technicianId, t.startedAt),
    uniqueIndex("time_entries_client_uq").on(t.tenantId, t.clientId),
  ],
);

/** Périodes d'immobilisation (COR-07) : base des indicateurs de disponibilité (KPI-03). */
export const downtimes = pgTable(
  "downtimes",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    equipmentId: uuid("equipment_id")
      .notNull()
      .references(() => equipment.id),
    workOrderId: uuid("work_order_id").references(() => workOrders.id),
    workRequestId: uuid("work_request_id").references(() => workRequests.id),
    reason: downtimeReasonEnum("reason").notNull(),
    startedAt: ts("started_at").notNull(),
    endedAt: ts("ended_at"),
    comment: text("comment"),
    createdAt: createdAt(),
  },
  (t) => [index("downtimes_equipment_idx").on(t.equipmentId, t.startedAt)],
);

/** Coût saisi manuellement (frais divers) — complète main-d'œuvre, pièces et prestations (KPI-01). */
export const workOrderCosts = pgTable(
  "work_order_costs",
  {
    id: id(),
    workOrderId: uuid("work_order_id")
      .notNull()
      .references(() => workOrders.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    amount: money("amount").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("work_order_costs_wo_idx").on(t.workOrderId)],
);

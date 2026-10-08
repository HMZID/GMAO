import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Énumérations PostgreSQL du domaine GMAO.
 * Les libellés français affichés à l'écran sont dans `src/lib/labels.ts`.
 */

// Habilitations (CDC §2)
export const roleEnum = pgEnum("role", [
  "ADMIN",
  "MAINTENANCE_MANAGER",
  "FLEET_MANAGER",
  "WORKSHOP_MANAGER",
  "TECHNICIAN",
  "OPERATOR",
  "STOREKEEPER",
  "PURCHASING_MANAGER",
  "EXECUTIVE",
  "CONTRACTOR",
]);

export const scopeTypeEnum = pgEnum("scope_type", ["TENANT", "COMPANY", "SITE"]);

export const auditChannelEnum = pgEnum("audit_channel", ["WEB", "API", "MOBILE", "IMPORT", "SYSTEM"]);

// Équipements (CDC §3)
export const equipmentStatusEnum = pgEnum("equipment_status", ["AVAILABLE", "IN_SERVICE", "IN_MAINTENANCE", "IMMOBILIZED", "RETIRED"]);

export const criticalityEnum = pgEnum("criticality", ["A", "B", "C"]);

export const acquisitionModeEnum = pgEnum("acquisition_mode", ["PURCHASE", "LEASE", "LONG_TERM_RENTAL", "SHORT_TERM_RENTAL"]);

export const meterTypeEnum = pgEnum("meter_type", ["HOURS", "KM", "CYCLES", "OTHER"]);

export const readingSourceEnum = pgEnum("reading_source", ["MANUAL", "WORK_ORDER", "TELEMATICS", "IMPORT"]);

export const readingStatusEnum = pgEnum("reading_status", ["VALID", "TO_CHECK", "REJECTED"]);

export const meterEventTypeEnum = pgEnum("meter_event_type", ["REPLACEMENT", "CORRECTION"]);

// Documents (EQP-07)
export const documentEntityEnum = pgEnum("document_entity", ["EQUIPMENT", "WORK_ORDER"]);

export const documentKindEnum = pgEnum("document_kind", ["MANUAL", "CERTIFICATE", "INVOICE", "PHOTO", "REPORT", "OTHER"]);

// Imports (EQP-13, INT-01)
export const importKindEnum = pgEnum("import_kind", ["EQUIPMENT", "PARTS", "INITIAL_STOCK"]);

export const importStatusEnum = pgEnum("import_status", ["SIMULATED", "RUNNING", "DONE", "FAILED"]);

export const importModeEnum = pgEnum("import_mode", ["ALL_OR_NOTHING", "VALID_ONLY"]);

export const downtimeReasonEnum = pgEnum("downtime_reason", ["BREAKDOWN", "SAFETY", "REGULATORY", "PLANNED_MAINTENANCE"]);

// Préventif (CDC §4)
export const operationModeEnum = pgEnum("operation_mode", ["FIXED", "SLIDING"]);

export const triggerKindEnum = pgEnum("trigger_kind", ["CALENDAR", "METER"]);

export const calendarUnitEnum = pgEnum("calendar_unit", ["DAY", "WEEK", "MONTH", "YEAR"]);

export const dueStatusEnum = pgEnum("due_status", ["UPCOMING", "PRE_ALERT", "DUE", "OVERDUE", "DONE", "SUPERSEDED", "SKIPPED"]);

// Correctif et OT (CDC §5)
export const requestStatusEnum = pgEnum("request_status", ["NEW", "QUALIFIED", "CONVERTED", "REJECTED", "MERGED"]);

export const priorityEnum = pgEnum("priority", ["P1", "P2", "P3", "P4"]);

export const requestTypeEnum = pgEnum("request_type", ["BREAKDOWN", "DAMAGE", "SAFETY", "IMPROVEMENT", "OTHER"]);

export const workOrderTypeEnum = pgEnum("work_order_type", ["PREVENTIVE", "CORRECTIVE", "REGULATORY", "IMPROVEMENT", "ACCIDENT"]);

export const workOrderStatusEnum = pgEnum("work_order_status", [
  "CREATED",
  "PLANNED",
  "ON_HOLD",
  "IN_PROGRESS",
  "WORK_DONE",
  "TECH_CLOSED",
  "CLOSED",
  "CANCELLED",
]);

export const holdReasonEnum = pgEnum("hold_reason", ["PARTS", "CONTRACTOR", "ACCESS", "QUOTE", "OTHER"]);

export const workOrderOutcomeEnum = pgEnum("work_order_outcome", ["RESOLVED", "DIAGNOSTIC_ONLY", "NO_FOLLOW_UP"]);

export const taskKindEnum = pgEnum("task_kind", ["CHECK", "MEASURE", "TEXT"]);

export const taskResultEnum = pgEnum("task_result", ["OK", "NOK", "NA"]);

// Stocks (CDC §7)
export const partTrackingEnum = pgEnum("part_tracking", ["QUANTITY", "LOT", "SERIAL"]);

export const movementTypeEnum = pgEnum("movement_type", ["RECEIPT", "ISSUE", "RETURN", "TRANSFER_OUT", "TRANSFER_IN", "ADJUSTMENT", "SCRAP"]);

export const reservationStatusEnum = pgEnum("reservation_status", ["ACTIVE", "CONSUMED", "RELEASED"]);

export const absenceTypeEnum = pgEnum("absence_type", ["LEAVE", "TRAINING", "SICK", "OTHER"]);

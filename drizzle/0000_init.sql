CREATE TYPE "public"."absence_type" AS ENUM('LEAVE', 'TRAINING', 'SICK', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."acquisition_mode" AS ENUM('PURCHASE', 'LEASE', 'LONG_TERM_RENTAL', 'SHORT_TERM_RENTAL');--> statement-breakpoint
CREATE TYPE "public"."audit_channel" AS ENUM('WEB', 'API', 'MOBILE', 'IMPORT', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "public"."calendar_unit" AS ENUM('DAY', 'WEEK', 'MONTH', 'YEAR');--> statement-breakpoint
CREATE TYPE "public"."criticality" AS ENUM('A', 'B', 'C');--> statement-breakpoint
CREATE TYPE "public"."downtime_reason" AS ENUM('BREAKDOWN', 'SAFETY', 'REGULATORY', 'PLANNED_MAINTENANCE');--> statement-breakpoint
CREATE TYPE "public"."due_status" AS ENUM('UPCOMING', 'PRE_ALERT', 'DUE', 'OVERDUE', 'DONE', 'SUPERSEDED', 'SKIPPED');--> statement-breakpoint
CREATE TYPE "public"."equipment_status" AS ENUM('AVAILABLE', 'IN_SERVICE', 'IN_MAINTENANCE', 'IMMOBILIZED', 'RETIRED');--> statement-breakpoint
CREATE TYPE "public"."hold_reason" AS ENUM('PARTS', 'CONTRACTOR', 'ACCESS', 'QUOTE', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."meter_event_type" AS ENUM('REPLACEMENT', 'CORRECTION');--> statement-breakpoint
CREATE TYPE "public"."meter_type" AS ENUM('HOURS', 'KM', 'CYCLES', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."movement_type" AS ENUM('RECEIPT', 'ISSUE', 'RETURN', 'TRANSFER_OUT', 'TRANSFER_IN', 'ADJUSTMENT', 'SCRAP');--> statement-breakpoint
CREATE TYPE "public"."operation_mode" AS ENUM('FIXED', 'SLIDING');--> statement-breakpoint
CREATE TYPE "public"."part_tracking" AS ENUM('QUANTITY', 'LOT', 'SERIAL');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('P1', 'P2', 'P3', 'P4');--> statement-breakpoint
CREATE TYPE "public"."reading_source" AS ENUM('MANUAL', 'WORK_ORDER', 'TELEMATICS', 'IMPORT');--> statement-breakpoint
CREATE TYPE "public"."reading_status" AS ENUM('VALID', 'TO_CHECK', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('NEW', 'QUALIFIED', 'CONVERTED', 'REJECTED', 'MERGED');--> statement-breakpoint
CREATE TYPE "public"."request_type" AS ENUM('BREAKDOWN', 'DAMAGE', 'SAFETY', 'IMPROVEMENT', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."reservation_status" AS ENUM('ACTIVE', 'CONSUMED', 'RELEASED');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('ADMIN', 'MAINTENANCE_MANAGER', 'FLEET_MANAGER', 'WORKSHOP_MANAGER', 'TECHNICIAN', 'OPERATOR', 'STOREKEEPER', 'PURCHASING_MANAGER', 'EXECUTIVE', 'CONTRACTOR');--> statement-breakpoint
CREATE TYPE "public"."scope_type" AS ENUM('TENANT', 'COMPANY', 'SITE');--> statement-breakpoint
CREATE TYPE "public"."task_kind" AS ENUM('CHECK', 'MEASURE', 'TEXT');--> statement-breakpoint
CREATE TYPE "public"."task_result" AS ENUM('OK', 'NOK', 'NA');--> statement-breakpoint
CREATE TYPE "public"."trigger_kind" AS ENUM('CALENDAR', 'METER');--> statement-breakpoint
CREATE TYPE "public"."work_order_outcome" AS ENUM('RESOLVED', 'DIAGNOSTIC_ONLY', 'NO_FOLLOW_UP');--> statement-breakpoint
CREATE TYPE "public"."work_order_status" AS ENUM('CREATED', 'PLANNED', 'ON_HOLD', 'IN_PROGRESS', 'WORK_DONE', 'TECH_CLOSED', 'CLOSED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."work_order_type" AS ENUM('PREVENTIVE', 'CORRECTIVE', 'REGULATORY', 'IMPROVEMENT', 'ACCIDENT');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" text,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"channel" "audit_channel" DEFAULT 'WEB' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"country" text DEFAULT 'FR' NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cost_centers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobsites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"latitude" double precision,
	"longitude" double precision,
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"year" integer NOT NULL,
	"value" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"timezone" text DEFAULT 'Europe/Paris' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "storage_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"code" text NOT NULL,
	"label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warehouses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"is_mobile" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workshops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"bays" integer DEFAULT 1 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"entity_type" text,
	"entity_id" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "role" NOT NULL,
	"scope_type" "scope_type" NOT NULL,
	"scope_id" uuid,
	"valid_from" timestamp with time zone,
	"valid_to" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"tenant_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"equipment_id" uuid NOT NULL,
	"site_id" uuid,
	"jobsite_id" uuid,
	"workshop_id" uuid,
	"responsible_user_id" text,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "components" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"equipment_id" uuid,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"serial_number" text,
	"installed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"storage_key" text,
	"url" text,
	"expires_at" timestamp with time zone,
	"uploaded_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equipment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"model_id" uuid,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"manufacturer" text NOT NULL,
	"serial_number" text,
	"registration" text,
	"year" integer,
	"status" "equipment_status" DEFAULT 'AVAILABLE' NOT NULL,
	"criticality" "criticality" DEFAULT 'B' NOT NULL,
	"acquisition_mode" "acquisition_mode" DEFAULT 'PURCHASE' NOT NULL,
	"acquisition_date" timestamp with time zone,
	"acquisition_value" numeric(14, 2),
	"commissioning_date" timestamp with time zone,
	"warranty_end_date" timestamp with time zone,
	"warranty_end_meter" numeric(14, 1),
	"cost_center_id" uuid,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"qr_token" text NOT NULL,
	"notes" text,
	"retired_at" timestamp with time zone,
	"retirement_reason" text,
	"disposal_value" numeric(14, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equipment_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"parent_id" uuid,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"default_criticality" "criticality" DEFAULT 'B' NOT NULL,
	"attribute_definitions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equipment_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"manufacturer" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equipment_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"equipment_id" uuid NOT NULL,
	"from_status" "equipment_status",
	"to_status" "equipment_status" NOT NULL,
	"reason" text,
	"work_order_id" uuid,
	"changed_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meter_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"meter_id" uuid NOT NULL,
	"type" "meter_event_type" NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"old_final_value" numeric(14, 1),
	"new_initial_value" numeric(14, 1),
	"reading_id" uuid,
	"reason" text NOT NULL,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meter_readings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"meter_id" uuid NOT NULL,
	"read_at" timestamp with time zone NOT NULL,
	"value" numeric(14, 1) NOT NULL,
	"cumulative_value" numeric(14, 1) NOT NULL,
	"source" "reading_source" DEFAULT 'MANUAL' NOT NULL,
	"status" "reading_status" DEFAULT 'VALID' NOT NULL,
	"status_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"client_id" text,
	"work_order_id" uuid,
	"comment" text,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"equipment_id" uuid NOT NULL,
	"component_id" uuid,
	"type" "meter_type" NOT NULL,
	"unit" text NOT NULL,
	"label" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"offset" numeric(14, 1) DEFAULT 0 NOT NULL,
	"last_value" numeric(14, 1),
	"last_cumulative_value" numeric(14, 1),
	"last_read_at" timestamp with time zone,
	"average_daily_usage" numeric(14, 1),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "absences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"technician_id" uuid NOT NULL,
	"type" "absence_type" DEFAULT 'LEAVE' NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"technician_id" uuid NOT NULL,
	"name" text NOT NULL,
	"valid_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "labor_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"technician_id" uuid NOT NULL,
	"hourly_rate" numeric(14, 2) NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "technician_skills" (
	"technician_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "technician_skills_technician_id_skill_id_pk" PRIMARY KEY("technician_id","skill_id")
);
--> statement-breakpoint
CREATE TABLE "technicians" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" text,
	"site_id" uuid NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"qualification" text,
	"daily_hours" integer DEFAULT 7 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "part_compatibilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"part_id" uuid NOT NULL,
	"model_id" uuid,
	"equipment_id" uuid
);
--> statement-breakpoint
CREATE TABLE "part_suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"part_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"supplier_ref" text,
	"price" numeric(14, 2),
	"lead_time_days" integer,
	"preferred" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"family" text,
	"unit" text DEFAULT 'u' NOT NULL,
	"manufacturer" text,
	"manufacturer_ref" text,
	"tracking" "part_tracking" DEFAULT 'QUANTITY' NOT NULL,
	"is_repairable" boolean DEFAULT false NOT NULL,
	"criticality" "criticality" DEFAULT 'C' NOT NULL,
	"average_cost" numeric(14, 2) DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"part_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"location_id" uuid,
	"on_hand" numeric(14, 3) DEFAULT 0 NOT NULL,
	"reserved" numeric(14, 3) DEFAULT 0 NOT NULL,
	"in_transit" numeric(14, 3) DEFAULT 0 NOT NULL,
	"min_qty" numeric(14, 3),
	"reorder_point" numeric(14, 3),
	"max_qty" numeric(14, 3),
	"safety_stock" numeric(14, 3),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"tax_id" text,
	"email" text,
	"phone" text,
	"address" text,
	"is_contractor" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "downtimes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"equipment_id" uuid NOT NULL,
	"work_order_id" uuid,
	"work_request_id" uuid,
	"reason" "downtime_reason" NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "due_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"equipment_id" uuid NOT NULL,
	"equipment_plan_id" uuid NOT NULL,
	"operation_id" uuid NOT NULL,
	"meter_id" uuid,
	"base_date" timestamp with time zone NOT NULL,
	"base_meter_value" numeric(14, 1),
	"due_date" timestamp with time zone,
	"due_meter_value" numeric(14, 1),
	"projected_date" timestamp with time zone,
	"status" "due_status" DEFAULT 'UPCOMING' NOT NULL,
	"work_order_id" uuid,
	"completed_at" timestamp with time zone,
	"completed_meter_value" numeric(14, 1),
	"postponed_to" timestamp with time zone,
	"postpone_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equipment_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"equipment_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"suspended_reason" text,
	"overrides" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintenance_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category_id" uuid,
	"model_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"mode" "operation_mode" DEFAULT 'SLIDING' NOT NULL,
	"is_regulatory" boolean DEFAULT false NOT NULL,
	"block_when_overdue" boolean DEFAULT false NOT NULL,
	"pre_alert_days" integer,
	"pre_alert_meter" numeric(14, 1),
	"tolerance_percent" integer DEFAULT 10 NOT NULL,
	"task_list_id" uuid,
	"estimated_minutes" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_triggers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operation_id" uuid NOT NULL,
	"kind" "trigger_kind" NOT NULL,
	"every" double precision NOT NULL,
	"calendar_unit" "calendar_unit",
	"meter_type" "meter_type"
);
--> statement-breakpoint
CREATE TABLE "task_list_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_list_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"label" text NOT NULL,
	"kind" "task_kind" DEFAULT 'CHECK' NOT NULL,
	"unit" text,
	"min_value" double precision,
	"max_value" double precision,
	"required" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_list_parts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_list_id" uuid NOT NULL,
	"part_id" uuid NOT NULL,
	"quantity" numeric(14, 3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"estimated_minutes" integer,
	"safety_notes" text,
	"required_skill_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "time_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"work_order_id" uuid NOT NULL,
	"technician_id" uuid NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"minutes" integer,
	"hourly_rate" numeric(14, 2),
	"comment" text,
	"client_id" text,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_order_assignees" (
	"work_order_id" uuid NOT NULL,
	"technician_id" uuid NOT NULL,
	CONSTRAINT "work_order_assignees_work_order_id_technician_id_pk" PRIMARY KEY("work_order_id","technician_id")
);
--> statement-breakpoint
CREATE TABLE "work_order_costs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_order_id" uuid NOT NULL,
	"label" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_order_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_order_id" uuid NOT NULL,
	"from_status" "work_order_status",
	"to_status" "work_order_status" NOT NULL,
	"reason" text,
	"changed_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_order_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_order_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"label" text NOT NULL,
	"kind" "task_kind" DEFAULT 'CHECK' NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"unit" text,
	"min_value" double precision,
	"max_value" double precision,
	"result" "task_result",
	"measured_value" double precision,
	"comment" text,
	"done_by_id" text,
	"done_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "work_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"number" text NOT NULL,
	"company_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"equipment_id" uuid NOT NULL,
	"type" "work_order_type" NOT NULL,
	"status" "work_order_status" DEFAULT 'CREATED' NOT NULL,
	"priority" "priority" DEFAULT 'P3' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"is_immobilizing" boolean DEFAULT false NOT NULL,
	"is_safety_related" boolean DEFAULT false NOT NULL,
	"hold_reason" "hold_reason",
	"hold_comment" text,
	"workshop_id" uuid,
	"jobsite_id" uuid,
	"is_external" boolean DEFAULT false NOT NULL,
	"supplier_id" uuid,
	"external_cost" numeric(14, 2),
	"external_cost_is_final" boolean DEFAULT false NOT NULL,
	"planned_start" timestamp with time zone,
	"planned_end" timestamp with time zone,
	"estimated_minutes" integer,
	"due_item_id" uuid,
	"task_list_id" uuid,
	"work_summary" text,
	"symptom_code" text,
	"cause_code" text,
	"remedy_code" text,
	"outcome" "work_order_outcome",
	"meter_value_at_close" numeric(14, 1),
	"started_at" timestamp with time zone,
	"work_done_at" timestamp with time zone,
	"tech_closed_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"release_validated_by_id" text,
	"release_validated_at" timestamp with time zone,
	"reopen_count" integer DEFAULT 0 NOT NULL,
	"parent_work_order_id" uuid,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"number" text NOT NULL,
	"company_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"equipment_id" uuid NOT NULL,
	"reported_by_id" text,
	"reported_at" timestamp with time zone NOT NULL,
	"symptom" text NOT NULL,
	"description" text,
	"is_stopped" boolean DEFAULT false NOT NULL,
	"is_safety_risk" boolean DEFAULT false NOT NULL,
	"meter_value" numeric(14, 1),
	"latitude" double precision,
	"longitude" double precision,
	"status" "request_status" DEFAULT 'NEW' NOT NULL,
	"priority" "priority",
	"type" "request_type",
	"immobilize" boolean DEFAULT false NOT NULL,
	"rejection_reason" text,
	"merged_into_id" uuid,
	"work_order_id" uuid,
	"qualified_by_id" text,
	"qualified_at" timestamp with time zone,
	"client_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"part_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"location_id" uuid,
	"type" "movement_type" NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"unit_cost" numeric(14, 2) DEFAULT 0 NOT NULL,
	"work_order_id" uuid,
	"cost_center_id" uuid,
	"counterpart_warehouse_id" uuid,
	"reference" text,
	"reason" text,
	"reversal_of_id" uuid,
	"client_id" text,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"part_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"work_order_id" uuid NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"consumed_quantity" numeric(14, 3) DEFAULT 0 NOT NULL,
	"status" "reservation_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobsites" ADD CONSTRAINT "jobsites_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobsites" ADD CONSTRAINT "jobsites_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequences" ADD CONSTRAINT "sequences_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequences" ADD CONSTRAINT "sequences_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_locations" ADD CONSTRAINT "storage_locations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_locations" ADD CONSTRAINT "storage_locations_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshops" ADD CONSTRAINT "workshops_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshops" ADD CONSTRAINT "workshops_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_jobsite_id_jobsites_id_fk" FOREIGN KEY ("jobsite_id") REFERENCES "public"."jobsites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_responsible_user_id_user_id_fk" FOREIGN KEY ("responsible_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "components" ADD CONSTRAINT "components_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "components" ADD CONSTRAINT "components_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_id_user_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_category_id_equipment_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."equipment_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_model_id_equipment_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."equipment_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_cost_center_id_cost_centers_id_fk" FOREIGN KEY ("cost_center_id") REFERENCES "public"."cost_centers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_categories" ADD CONSTRAINT "equipment_categories_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_models" ADD CONSTRAINT "equipment_models_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_models" ADD CONSTRAINT "equipment_models_category_id_equipment_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."equipment_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_status_history" ADD CONSTRAINT "equipment_status_history_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_status_history" ADD CONSTRAINT "equipment_status_history_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_status_history" ADD CONSTRAINT "equipment_status_history_changed_by_id_user_id_fk" FOREIGN KEY ("changed_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meter_events" ADD CONSTRAINT "meter_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meter_events" ADD CONSTRAINT "meter_events_meter_id_meters_id_fk" FOREIGN KEY ("meter_id") REFERENCES "public"."meters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meter_events" ADD CONSTRAINT "meter_events_reading_id_meter_readings_id_fk" FOREIGN KEY ("reading_id") REFERENCES "public"."meter_readings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meter_events" ADD CONSTRAINT "meter_events_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meter_readings" ADD CONSTRAINT "meter_readings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meter_readings" ADD CONSTRAINT "meter_readings_meter_id_meters_id_fk" FOREIGN KEY ("meter_id") REFERENCES "public"."meters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meter_readings" ADD CONSTRAINT "meter_readings_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meters" ADD CONSTRAINT "meters_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meters" ADD CONSTRAINT "meters_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meters" ADD CONSTRAINT "meters_component_id_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."components"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "absences" ADD CONSTRAINT "absences_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "absences" ADD CONSTRAINT "absences_technician_id_technicians_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."technicians"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certifications" ADD CONSTRAINT "certifications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certifications" ADD CONSTRAINT "certifications_technician_id_technicians_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."technicians"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labor_rates" ADD CONSTRAINT "labor_rates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labor_rates" ADD CONSTRAINT "labor_rates_technician_id_technicians_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."technicians"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technician_skills" ADD CONSTRAINT "technician_skills_technician_id_technicians_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."technicians"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technician_skills" ADD CONSTRAINT "technician_skills_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technicians" ADD CONSTRAINT "technicians_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technicians" ADD CONSTRAINT "technicians_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technicians" ADD CONSTRAINT "technicians_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_compatibilities" ADD CONSTRAINT "part_compatibilities_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_compatibilities" ADD CONSTRAINT "part_compatibilities_model_id_equipment_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."equipment_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_compatibilities" ADD CONSTRAINT "part_compatibilities_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_suppliers" ADD CONSTRAINT "part_suppliers_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_suppliers" ADD CONSTRAINT "part_suppliers_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parts" ADD CONSTRAINT "parts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_location_id_storage_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."storage_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "downtimes" ADD CONSTRAINT "downtimes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "downtimes" ADD CONSTRAINT "downtimes_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "downtimes" ADD CONSTRAINT "downtimes_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "downtimes" ADD CONSTRAINT "downtimes_work_request_id_work_requests_id_fk" FOREIGN KEY ("work_request_id") REFERENCES "public"."work_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "due_items" ADD CONSTRAINT "due_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "due_items" ADD CONSTRAINT "due_items_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "due_items" ADD CONSTRAINT "due_items_equipment_plan_id_equipment_plans_id_fk" FOREIGN KEY ("equipment_plan_id") REFERENCES "public"."equipment_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "due_items" ADD CONSTRAINT "due_items_operation_id_plan_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."plan_operations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "due_items" ADD CONSTRAINT "due_items_meter_id_meters_id_fk" FOREIGN KEY ("meter_id") REFERENCES "public"."meters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_plans" ADD CONSTRAINT "equipment_plans_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_plans" ADD CONSTRAINT "equipment_plans_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_plans" ADD CONSTRAINT "equipment_plans_plan_id_maintenance_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."maintenance_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_plans" ADD CONSTRAINT "maintenance_plans_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_plans" ADD CONSTRAINT "maintenance_plans_category_id_equipment_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."equipment_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_plans" ADD CONSTRAINT "maintenance_plans_model_id_equipment_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."equipment_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_operations" ADD CONSTRAINT "plan_operations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_operations" ADD CONSTRAINT "plan_operations_plan_id_maintenance_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."maintenance_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_operations" ADD CONSTRAINT "plan_operations_task_list_id_task_lists_id_fk" FOREIGN KEY ("task_list_id") REFERENCES "public"."task_lists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_triggers" ADD CONSTRAINT "plan_triggers_operation_id_plan_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."plan_operations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_list_items" ADD CONSTRAINT "task_list_items_task_list_id_task_lists_id_fk" FOREIGN KEY ("task_list_id") REFERENCES "public"."task_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_list_parts" ADD CONSTRAINT "task_list_parts_task_list_id_task_lists_id_fk" FOREIGN KEY ("task_list_id") REFERENCES "public"."task_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_list_parts" ADD CONSTRAINT "task_list_parts_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_lists" ADD CONSTRAINT "task_lists_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_technician_id_technicians_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."technicians"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_assignees" ADD CONSTRAINT "work_order_assignees_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_assignees" ADD CONSTRAINT "work_order_assignees_technician_id_technicians_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."technicians"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_costs" ADD CONSTRAINT "work_order_costs_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_status_history" ADD CONSTRAINT "work_order_status_history_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_status_history" ADD CONSTRAINT "work_order_status_history_changed_by_id_user_id_fk" FOREIGN KEY ("changed_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_tasks" ADD CONSTRAINT "work_order_tasks_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_tasks" ADD CONSTRAINT "work_order_tasks_done_by_id_user_id_fk" FOREIGN KEY ("done_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_jobsite_id_jobsites_id_fk" FOREIGN KEY ("jobsite_id") REFERENCES "public"."jobsites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_due_item_id_due_items_id_fk" FOREIGN KEY ("due_item_id") REFERENCES "public"."due_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_task_list_id_task_lists_id_fk" FOREIGN KEY ("task_list_id") REFERENCES "public"."task_lists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_release_validated_by_id_user_id_fk" FOREIGN KEY ("release_validated_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_requests" ADD CONSTRAINT "work_requests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_requests" ADD CONSTRAINT "work_requests_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_requests" ADD CONSTRAINT "work_requests_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_requests" ADD CONSTRAINT "work_requests_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_requests" ADD CONSTRAINT "work_requests_reported_by_id_user_id_fk" FOREIGN KEY ("reported_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_requests" ADD CONSTRAINT "work_requests_qualified_by_id_user_id_fk" FOREIGN KEY ("qualified_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_location_id_storage_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."storage_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_cost_center_id_cost_centers_id_fk" FOREIGN KEY ("cost_center_id") REFERENCES "public"."cost_centers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_counterpart_warehouse_id_warehouses_id_fk" FOREIGN KEY ("counterpart_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_tenant_created_idx" ON "audit_logs" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "companies_tenant_code_uq" ON "companies" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "cost_centers_company_code_uq" ON "cost_centers" USING btree ("company_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "jobsites_tenant_code_uq" ON "jobsites" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "sequences_uq" ON "sequences" USING btree ("company_id","kind","year");--> statement-breakpoint
CREATE UNIQUE INDEX "sites_tenant_code_uq" ON "sites" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE INDEX "sites_company_idx" ON "sites" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "storage_locations_wh_code_uq" ON "storage_locations" USING btree ("warehouse_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "warehouses_tenant_code_uq" ON "warehouses" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "workshops_tenant_code_uq" ON "workshops" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE INDEX "role_assignments_user_idx" ON "role_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "assignments_equipment_idx" ON "assignments" USING btree ("equipment_id","start_at");--> statement-breakpoint
CREATE INDEX "components_equipment_idx" ON "components" USING btree ("equipment_id");--> statement-breakpoint
CREATE INDEX "documents_entity_idx" ON "documents" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "equipment_tenant_code_uq" ON "equipment" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "equipment_tenant_serial_uq" ON "equipment" USING btree ("tenant_id","manufacturer","serial_number");--> statement-breakpoint
CREATE UNIQUE INDEX "equipment_qr_token_uq" ON "equipment" USING btree ("qr_token");--> statement-breakpoint
CREATE INDEX "equipment_scope_idx" ON "equipment" USING btree ("tenant_id","company_id","site_id");--> statement-breakpoint
CREATE INDEX "equipment_status_idx" ON "equipment" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "equipment_categories_tenant_code_uq" ON "equipment_categories" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "equipment_models_uq" ON "equipment_models" USING btree ("tenant_id","manufacturer","name");--> statement-breakpoint
CREATE INDEX "equipment_status_history_eq_idx" ON "equipment_status_history" USING btree ("equipment_id","created_at");--> statement-breakpoint
CREATE INDEX "meter_events_meter_idx" ON "meter_events" USING btree ("meter_id","occurred_at");--> statement-breakpoint
CREATE INDEX "meter_readings_meter_idx" ON "meter_readings" USING btree ("meter_id","read_at");--> statement-breakpoint
CREATE UNIQUE INDEX "meter_readings_client_uq" ON "meter_readings" USING btree ("tenant_id","client_id");--> statement-breakpoint
CREATE INDEX "meters_equipment_idx" ON "meters" USING btree ("equipment_id");--> statement-breakpoint
CREATE INDEX "absences_tech_idx" ON "absences" USING btree ("technician_id","start_at");--> statement-breakpoint
CREATE INDEX "certifications_tech_idx" ON "certifications" USING btree ("technician_id");--> statement-breakpoint
CREATE INDEX "labor_rates_tech_idx" ON "labor_rates" USING btree ("technician_id","valid_from");--> statement-breakpoint
CREATE UNIQUE INDEX "skills_tenant_code_uq" ON "skills" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "technicians_user_uq" ON "technicians" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "technicians_site_idx" ON "technicians" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "part_compat_part_idx" ON "part_compatibilities" USING btree ("part_id");--> statement-breakpoint
CREATE UNIQUE INDEX "part_suppliers_uq" ON "part_suppliers" USING btree ("part_id","supplier_id");--> statement-breakpoint
CREATE UNIQUE INDEX "parts_tenant_sku_uq" ON "parts" USING btree ("tenant_id","sku");--> statement-breakpoint
CREATE UNIQUE INDEX "parts_tenant_mfr_ref_uq" ON "parts" USING btree ("tenant_id","manufacturer","manufacturer_ref");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_levels_part_wh_uq" ON "stock_levels" USING btree ("part_id","warehouse_id");--> statement-breakpoint
CREATE INDEX "stock_levels_wh_idx" ON "stock_levels" USING btree ("warehouse_id");--> statement-breakpoint
CREATE UNIQUE INDEX "suppliers_tenant_tax_uq" ON "suppliers" USING btree ("tenant_id","tax_id");--> statement-breakpoint
CREATE INDEX "downtimes_equipment_idx" ON "downtimes" USING btree ("equipment_id","started_at");--> statement-breakpoint
CREATE INDEX "due_items_status_idx" ON "due_items" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "due_items_equipment_idx" ON "due_items" USING btree ("equipment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "equipment_plans_uq" ON "equipment_plans" USING btree ("equipment_id","plan_id");--> statement-breakpoint
CREATE INDEX "plan_operations_plan_idx" ON "plan_operations" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "plan_triggers_op_idx" ON "plan_triggers" USING btree ("operation_id");--> statement-breakpoint
CREATE INDEX "task_list_items_list_idx" ON "task_list_items" USING btree ("task_list_id","position");--> statement-breakpoint
CREATE INDEX "task_list_parts_list_idx" ON "task_list_parts" USING btree ("task_list_id");--> statement-breakpoint
CREATE INDEX "time_entries_wo_idx" ON "time_entries" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "time_entries_tech_idx" ON "time_entries" USING btree ("technician_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "time_entries_client_uq" ON "time_entries" USING btree ("tenant_id","client_id");--> statement-breakpoint
CREATE INDEX "work_order_costs_wo_idx" ON "work_order_costs" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "wo_status_history_wo_idx" ON "work_order_status_history" USING btree ("work_order_id","created_at");--> statement-breakpoint
CREATE INDEX "work_order_tasks_wo_idx" ON "work_order_tasks" USING btree ("work_order_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "work_orders_number_uq" ON "work_orders" USING btree ("tenant_id","number");--> statement-breakpoint
CREATE INDEX "work_orders_scope_idx" ON "work_orders" USING btree ("tenant_id","company_id","site_id","status");--> statement-breakpoint
CREATE INDEX "work_orders_equipment_idx" ON "work_orders" USING btree ("equipment_id","created_at");--> statement-breakpoint
CREATE INDEX "work_orders_planned_idx" ON "work_orders" USING btree ("tenant_id","planned_start");--> statement-breakpoint
CREATE UNIQUE INDEX "work_requests_number_uq" ON "work_requests" USING btree ("tenant_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "work_requests_client_uq" ON "work_requests" USING btree ("tenant_id","client_id");--> statement-breakpoint
CREATE INDEX "work_requests_scope_idx" ON "work_requests" USING btree ("tenant_id","company_id","site_id","status");--> statement-breakpoint
CREATE INDEX "work_requests_equipment_idx" ON "work_requests" USING btree ("equipment_id");--> statement-breakpoint
CREATE INDEX "stock_movements_part_idx" ON "stock_movements" USING btree ("part_id","created_at");--> statement-breakpoint
CREATE INDEX "stock_movements_wo_idx" ON "stock_movements" USING btree ("work_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_movements_client_uq" ON "stock_movements" USING btree ("tenant_id","client_id");--> statement-breakpoint
CREATE INDEX "stock_reservations_wo_idx" ON "stock_reservations" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "stock_reservations_part_idx" ON "stock_reservations" USING btree ("part_id");
CREATE TYPE "public"."deadline_kind" AS ENUM('INSURANCE', 'TECHNICAL_INSPECTION', 'VIGNETTE', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."deadline_status" AS ENUM('OPEN', 'DONE', 'CANCELLED');--> statement-breakpoint
ALTER TYPE "public"."email_event" ADD VALUE 'FLEET_DEADLINE';--> statement-breakpoint
CREATE TABLE "equipment_deadlines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"equipment_id" uuid NOT NULL,
	"kind" "deadline_kind" NOT NULL,
	"label" text,
	"provider" text,
	"reference" text,
	"due_date" timestamp with time zone NOT NULL,
	"amount" numeric(14, 2),
	"notes" text,
	"status" "deadline_status" DEFAULT 'OPEN' NOT NULL,
	"done_at" timestamp with time zone,
	"done_by_id" text,
	"renewal_of_id" uuid,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "equipment_deadlines" ADD CONSTRAINT "equipment_deadlines_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_deadlines" ADD CONSTRAINT "equipment_deadlines_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_deadlines" ADD CONSTRAINT "equipment_deadlines_done_by_id_user_id_fk" FOREIGN KEY ("done_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_deadlines" ADD CONSTRAINT "equipment_deadlines_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "equipment_deadlines_due_idx" ON "equipment_deadlines" USING btree ("tenant_id","status","due_date");--> statement-breakpoint
CREATE INDEX "equipment_deadlines_equipment_idx" ON "equipment_deadlines" USING btree ("equipment_id");
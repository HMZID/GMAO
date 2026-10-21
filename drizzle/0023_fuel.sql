CREATE TYPE "public"."fluid_kind" AS ENUM('DIESEL', 'GASOLINE', 'ADBLUE', 'ENGINE_OIL', 'HYDRAULIC_OIL', 'COOLANT', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."fuel_entry_status" AS ENUM('VALID', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."fuel_review" AS ENUM('NONE', 'TO_REVIEW', 'JUSTIFIED');--> statement-breakpoint
CREATE TYPE "public"."fuel_source" AS ENUM('MANUAL', 'MOBILE', 'CARD_IMPORT', 'API');--> statement-breakpoint
ALTER TYPE "public"."import_kind" ADD VALUE 'FUEL';--> statement-breakpoint
CREATE TABLE "equipment_fuel_settings" (
	"equipment_id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"fuel_type" "fluid_kind",
	"tank_capacity" numeric(14, 3),
	"reference_consumption" numeric(14, 3),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fuel_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"last4" text NOT NULL,
	"label" text,
	"equipment_id" uuid,
	"holder_name" text,
	"valid_to" timestamp with time zone,
	"monthly_limit_litres" numeric(14, 3),
	"active" boolean DEFAULT true NOT NULL,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fuel_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"equipment_id" uuid NOT NULL,
	"fluid" "fluid_kind" NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"unit_price" numeric(14, 3),
	"amount" numeric(14, 2),
	"filled_at" timestamp with time zone NOT NULL,
	"meter_id" uuid,
	"meter_value" numeric(14, 1),
	"cumulative_meter_value" numeric(14, 1),
	"full_tank" boolean DEFAULT true NOT NULL,
	"station" text,
	"reference" text,
	"fuel_card_id" uuid,
	"source" "fuel_source" DEFAULT 'MANUAL' NOT NULL,
	"anomalies" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"review_status" "fuel_review" DEFAULT 'NONE' NOT NULL,
	"review_comment" text,
	"reviewed_by_id" text,
	"reviewed_at" timestamp with time zone,
	"status" "fuel_entry_status" DEFAULT 'VALID' NOT NULL,
	"cancel_reason" text,
	"client_id" text,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "equipment_fuel_settings" ADD CONSTRAINT "equipment_fuel_settings_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_fuel_settings" ADD CONSTRAINT "equipment_fuel_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_cards" ADD CONSTRAINT "fuel_cards_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_cards" ADD CONSTRAINT "fuel_cards_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_cards" ADD CONSTRAINT "fuel_cards_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_cards" ADD CONSTRAINT "fuel_cards_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_entries" ADD CONSTRAINT "fuel_entries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_entries" ADD CONSTRAINT "fuel_entries_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_entries" ADD CONSTRAINT "fuel_entries_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_entries" ADD CONSTRAINT "fuel_entries_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_entries" ADD CONSTRAINT "fuel_entries_meter_id_meters_id_fk" FOREIGN KEY ("meter_id") REFERENCES "public"."meters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_entries" ADD CONSTRAINT "fuel_entries_fuel_card_id_fuel_cards_id_fk" FOREIGN KEY ("fuel_card_id") REFERENCES "public"."fuel_cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_entries" ADD CONSTRAINT "fuel_entries_reviewed_by_id_user_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_entries" ADD CONSTRAINT "fuel_entries_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fuel_cards_uq" ON "fuel_cards" USING btree ("tenant_id","provider","last4");--> statement-breakpoint
CREATE INDEX "fuel_cards_equipment_idx" ON "fuel_cards" USING btree ("equipment_id");--> statement-breakpoint
CREATE INDEX "fuel_entries_equipment_idx" ON "fuel_entries" USING btree ("equipment_id","filled_at");--> statement-breakpoint
CREATE INDEX "fuel_entries_scope_idx" ON "fuel_entries" USING btree ("tenant_id","company_id","site_id","filled_at");--> statement-breakpoint
CREATE INDEX "fuel_entries_review_idx" ON "fuel_entries" USING btree ("tenant_id","review_status");--> statement-breakpoint
CREATE UNIQUE INDEX "fuel_entries_client_uq" ON "fuel_entries" USING btree ("tenant_id","client_id");
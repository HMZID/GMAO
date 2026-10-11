CREATE TABLE "custom_indicators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"source" text NOT NULL,
	"aggregate" text NOT NULL,
	"field" text,
	"group_by" text,
	"filter_key" text,
	"filter_value" text,
	"period_days" integer,
	"chart" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "custom_indicators" ADD CONSTRAINT "custom_indicators_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_indicators" ADD CONSTRAINT "custom_indicators_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "custom_indicators_tenant_idx" ON "custom_indicators" USING btree ("tenant_id","position");
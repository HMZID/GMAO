CREATE TYPE "public"."import_kind" AS ENUM('EQUIPMENT', 'PARTS', 'INITIAL_STOCK');--> statement-breakpoint
CREATE TYPE "public"."import_mode" AS ENUM('ALL_OR_NOTHING', 'VALID_ONLY');--> statement-breakpoint
CREATE TYPE "public"."import_status" AS ENUM('SIMULATED', 'RUNNING', 'DONE', 'FAILED');--> statement-breakpoint
CREATE TABLE "import_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"kind" "import_kind" NOT NULL,
	"file_name" text NOT NULL,
	"sha256" text NOT NULL,
	"status" "import_status" DEFAULT 'SIMULATED' NOT NULL,
	"mode" "import_mode",
	"total_rows" integer DEFAULT 0 NOT NULL,
	"ready_rows" integer DEFAULT 0 NOT NULL,
	"existing_rows" integer DEFAULT 0 NOT NULL,
	"error_rows" integer DEFAULT 0 NOT NULL,
	"imported_rows" integer DEFAULT 0 NOT NULL,
	"file_errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rows" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"executed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "import_jobs_tenant_idx" ON "import_jobs" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "import_jobs_sha_idx" ON "import_jobs" USING btree ("tenant_id","sha256");
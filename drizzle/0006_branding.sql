ALTER TABLE "tenants" ADD COLUMN "display_name" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "logo_data" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "logo_content_type" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "logo_updated_at" timestamp with time zone;
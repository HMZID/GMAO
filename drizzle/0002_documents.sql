ALTER TABLE "documents" ALTER COLUMN "entity_type" SET DATA TYPE "public"."document_entity" USING "entity_type"::"public"."document_entity";--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "kind" SET DATA TYPE "public"."document_kind" USING "kind"::"public"."document_kind";--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "storage_key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "company_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "site_id" uuid;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "file_name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "content_type" text NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "size_bytes" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "sha256" text NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "client_id" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "deleted_by_id" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "deletion_reason" text;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_deleted_by_id_user_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "documents_scope_idx" ON "documents" USING btree ("tenant_id","company_id","site_id");--> statement-breakpoint
CREATE UNIQUE INDEX "documents_client_uq" ON "documents" USING btree ("tenant_id","client_id");
ALTER TYPE "public"."import_kind" ADD VALUE 'SUPPLIERS';--> statement-breakpoint
ALTER TYPE "public"."import_kind" ADD VALUE 'TECHNICIANS';--> statement-breakpoint
ALTER TABLE "technicians" ADD COLUMN "employee_number" text;--> statement-breakpoint
CREATE UNIQUE INDEX "technicians_tenant_employee_uq" ON "technicians" USING btree ("tenant_id","employee_number");
ALTER TYPE "public"."approval_object" ADD VALUE 'WORK_ORDER';--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "estimated_cost" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "validation_status" "expense_approval" DEFAULT 'APPROVED' NOT NULL;--> statement-breakpoint
ALTER TABLE "approval_steps" ADD COLUMN "max_amount" numeric(14, 2);
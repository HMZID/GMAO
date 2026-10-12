CREATE TYPE "public"."inventory_count_status" AS ENUM('PENDING', 'APPLIED', 'REJECTED');--> statement-breakpoint
CREATE TABLE "inventory_counts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"part_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"counted_quantity" numeric(14, 3) NOT NULL,
	"expected_quantity" numeric(14, 3) NOT NULL,
	"difference" numeric(14, 3) NOT NULL,
	"unit_cost" numeric(14, 2) NOT NULL,
	"counted_at" timestamp with time zone NOT NULL,
	"status" "inventory_count_status" NOT NULL,
	"comment" text,
	"decision_comment" text,
	"adjustment_id" uuid,
	"client_id" text,
	"created_by_id" text,
	"decided_by_id" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inventory_counts" ADD CONSTRAINT "inventory_counts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_counts" ADD CONSTRAINT "inventory_counts_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_counts" ADD CONSTRAINT "inventory_counts_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_counts" ADD CONSTRAINT "inventory_counts_adjustment_id_stock_movements_id_fk" FOREIGN KEY ("adjustment_id") REFERENCES "public"."stock_movements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_counts" ADD CONSTRAINT "inventory_counts_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_counts" ADD CONSTRAINT "inventory_counts_decided_by_id_user_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inventory_counts_status_idx" ON "inventory_counts" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "inventory_counts_part_idx" ON "inventory_counts" USING btree ("part_id","warehouse_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_counts_client_uq" ON "inventory_counts" USING btree ("tenant_id","client_id");
ALTER TABLE "user" ADD COLUMN "locale" text DEFAULT 'fr' NOT NULL;--> statement-breakpoint
ALTER TABLE "demo_requests" ADD COLUMN "locale" text DEFAULT 'fr' NOT NULL;
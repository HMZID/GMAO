CREATE TYPE "public"."document_entity" AS ENUM('EQUIPMENT', 'WORK_ORDER');--> statement-breakpoint
CREATE TYPE "public"."document_kind" AS ENUM('MANUAL', 'CERTIFICATE', 'INVOICE', 'PHOTO', 'REPORT', 'OTHER');--> statement-breakpoint
ALTER TABLE "documents" DROP COLUMN "url";
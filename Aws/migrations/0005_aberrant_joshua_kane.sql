CREATE TYPE "public"."alert_severity" AS ENUM('info', 'warning', 'error');--> statement-breakpoint
CREATE TYPE "public"."alert_subject_type" AS ENUM('compliance_document', 'truck', 'payout');--> statement-breakpoint
CREATE TYPE "public"."alert_type" AS ENUM('doc_expiring', 'doc_expired', 'truck_idle', 'payout_failed');--> statement-breakpoint
CREATE TYPE "public"."import_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fleet_id" uuid NOT NULL,
	"type" "alert_type" NOT NULL,
	"severity" "alert_severity" NOT NULL,
	"message" text NOT NULL,
	"href" text NOT NULL,
	"subject_type" "alert_subject_type" NOT NULL,
	"subject_id" uuid NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "truck_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fleet_id" uuid NOT NULL,
	"filename" text,
	"status" "import_status" DEFAULT 'pending' NOT NULL,
	"total_rows" integer DEFAULT 0 NOT NULL,
	"imported_rows" integer DEFAULT 0 NOT NULL,
	"failed_rows" integer DEFAULT 0 NOT NULL,
	"errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"payload" text,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_fleet_id_fleets_id_fk" FOREIGN KEY ("fleet_id") REFERENCES "public"."fleets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "truck_imports" ADD CONSTRAINT "truck_imports_fleet_id_fleets_id_fk" FOREIGN KEY ("fleet_id") REFERENCES "public"."fleets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_alerts_fleet_open" ON "alerts" USING btree ("fleet_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_truck_imports_fleet" ON "truck_imports" USING btree ("fleet_id","created_at" DESC NULLS LAST);--> statement-breakpoint
--
-- Hand-written: drizzle-kit does not emit partial indexes (same reason
-- 0004 carries `uq_drivers_assigned_truck` by hand).
--
-- THIS is what makes the hourly compliance sweep idempotent. Re-running it must
-- not add a second "insurance expires in 30 days" alert for the same document
-- every hour, and a flag on the document alone cannot express "open alert
-- exists" once alerts can be resolved and then re-fire. The sweep upserts
-- against this constraint.
--
-- Scoped to unresolved rows only, so an alert that fired, was resolved, and
-- legitimately recurs (renewed doc expires again next year) can be inserted.
CREATE UNIQUE INDEX "uq_alerts_open_subject"
  ON "alerts" ("fleet_id", "type", "subject_id")
  WHERE "resolved_at" IS NULL;--> statement-breakpoint
-- The dashboard/alerts feed reads unresolved rows newest-first. Partial, because
-- resolved alerts are history and never appear in the feed.
CREATE INDEX "idx_alerts_feed_open"
  ON "alerts" ("fleet_id", "created_at" DESC NULLS LAST, "id" DESC NULLS LAST)
  WHERE "resolved_at" IS NULL;
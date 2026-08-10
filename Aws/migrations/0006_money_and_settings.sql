CREATE TYPE "public"."fleet_onboarding_step" AS ENUM('profile', 'payout_account', 'notifications', 'done');--> statement-breakpoint
CREATE TYPE "public"."payout_account_status" AS ENUM('unlinked', 'pending', 'active', 'rejected', 'suspended');--> statement-breakpoint
CREATE TABLE "payout_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"owner_type" "wallet_owner_type" NOT NULL,
	"status" "payout_account_status" DEFAULT 'unlinked' NOT NULL,
	"route_account_id" text,
	"route_fund_account_id" text,
	"beneficiary_name" text,
	"account_number_last4" text,
	"account_number_fingerprint" text,
	"ifsc" text,
	"bank_name" text,
	"failure_reason" text,
	"linked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_payout_accounts_owner" UNIQUE("owner_type","owner_id")
);
--> statement-breakpoint
CREATE TABLE "earnings_daily" (
	"fleet_id" uuid NOT NULL,
	"day" date NOT NULL,
	"driver_id" uuid NOT NULL,
	"jobs" integer DEFAULT 0 NOT NULL,
	"gross" numeric(12, 2) DEFAULT '0' NOT NULL,
	"commission" numeric(12, 2) DEFAULT '0' NOT NULL,
	"pool" numeric(12, 2) DEFAULT '0' NOT NULL,
	"driver_share" numeric(12, 2) DEFAULT '0' NOT NULL,
	"fleet_share" numeric(12, 2) DEFAULT '0' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "earnings_daily_pkey" PRIMARY KEY("fleet_id","day","driver_id")
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text,
	CONSTRAINT "uq_webhook_events_provider_event" UNIQUE("provider","event_id")
);
--> statement-breakpoint
--
-- Hand-inserted BEFORE the NOT NULL below. Postgres unique indexes treat NULLs
-- as distinct, so any legacy keyless leg was silently exempt from the dedup
-- §14.1 requires. Every shipped writer sets a key (seed `seed:v1:*`, the test
-- fixture `test:*`), so this normally updates zero rows — it exists so a
-- hand-inserted local row fails a developer's `pnpm db:migrate` with nothing
-- rather than with a confusing "column contains null values".
--
UPDATE "wallet_transactions" SET "idempotency_key" = 'legacy:' || "id"::text
 WHERE "idempotency_key" IS NULL;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ALTER COLUMN "idempotency_key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "fleets" ADD COLUMN "notification_prefs" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "fleets" ADD COLUMN "onboarding_step" "fleet_onboarding_step" DEFAULT 'profile' NOT NULL;--> statement-breakpoint
ALTER TABLE "fleets" ADD COLUMN "profile_completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN "failure_reason" text;--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN "provider" text;--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN "last_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "earnings_daily" ADD CONSTRAINT "earnings_daily_fleet_id_fleets_id_fk" FOREIGN KEY ("fleet_id") REFERENCES "public"."fleets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "earnings_daily" ADD CONSTRAINT "earnings_daily_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_payout_accounts_status" ON "payout_accounts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_earnings_daily_fleet_day" ON "earnings_daily" USING btree ("fleet_id","day" DESC NULLS LAST);--> statement-breakpoint

--
-- ===========================================================================
-- Hand-written from here down: drizzle-kit emits neither CHECK constraints nor
-- partial indexes (same reason 0002 carries the money CHECKs, 0004 carries
-- `uq_drivers_assigned_truck` and 0005 carries `uq_alerts_open_subject`).
-- ===========================================================================
--

-- --- payout_accounts -------------------------------------------------------
-- A malformed IFSC is not a validation nicety: it is a bank transfer into the
-- void. Enforced at the DB as well as in `payoutAccountLinkSchema` because the
-- provider adapter and any future admin repair path bypass the Zod layer.
ALTER TABLE "payout_accounts" ADD CONSTRAINT "ck_payout_accounts_ifsc"
  CHECK ("ifsc" IS NULL OR "ifsc" ~ '^[A-Z]{4}0[A-Z0-9]{6}$');--> statement-breakpoint
-- `active` is the only status `POST /fleet/payouts` accepts, so an active row
-- without a destination would be a payout with nowhere to go.
ALTER TABLE "payout_accounts" ADD CONSTRAINT "ck_payout_accounts_active_has_destination"
  CHECK ("status" <> 'active' OR "route_fund_account_id" IS NOT NULL);--> statement-breakpoint

-- --- fleets ----------------------------------------------------------------
ALTER TABLE "fleets" ADD CONSTRAINT "ck_fleets_notification_prefs_object"
  CHECK (jsonb_typeof("notification_prefs") = 'object');--> statement-breakpoint
-- `profile_completed_at` is a stored summary of the profile fields. This is
-- what stops it drifting from the data it summarises — §9.3.1 makes GSTIN
-- optional, so address is the field that actually decides completeness.
ALTER TABLE "fleets" ADD CONSTRAINT "ck_fleets_profile_completed_requires_address"
  CHECK ("profile_completed_at" IS NULL
         OR ("address" IS NOT NULL AND length(btrim("address")) > 0));--> statement-breakpoint

-- --- payouts ---------------------------------------------------------------
-- THE most important line in this migration. One open payout per owner is the
-- database's own defeat of the concurrent double-payout: it holds with Redis
-- down and the idempotency interceptor bypassed entirely, which is exactly the
-- "unique constraints as the final backstop" §19.4 asks for. Partial, because a
-- fleet must of course be able to request again once the last one settled.
CREATE UNIQUE INDEX "uq_payouts_one_open_per_owner"
  ON "payouts" ("owner_type", "owner_id")
  WHERE "status" IN ('requested', 'processing');--> statement-breakpoint
-- The webhook's lookup key. Unique so two payouts can never claim one provider
-- reference — that would make a `payout.processed` event ambiguous.
CREATE UNIQUE INDEX "uq_payouts_route_ref"
  ON "payouts" ("route_ref") WHERE "route_ref" IS NOT NULL;--> statement-breakpoint
-- The payout history feed. `DESC NULLS LAST` on both columns because a bare
-- DESC index does not match `ORDER BY … DESC` (which implies NULLS FIRST) and
-- Postgres then re-sorts every page — the lesson Phase 4 paid for.
CREATE INDEX "idx_payouts_owner_feed"
  ON "payouts" ("owner_type", "owner_id", "requested_at" DESC NULLS LAST, "id" DESC NULLS LAST);--> statement-breakpoint

-- --- wallet_transactions ---------------------------------------------------
-- No new index here, deliberately. `GET /fleet/earnings/split` is anchored on
-- `bookings` (see EarningsRepo.splitFeed — a wallet-anchored feed silently
-- drops bookings at a 100/0 driver split), so it is served by the existing
-- `idx_bookings_fleet_feed` for the ordering and `idx_wallet_transactions_ref`
-- for the per-booking lateral. An extra partial index on the busiest money
-- table would be pure write amplification for a query nobody issues.

-- --- backfill --------------------------------------------------------------
-- Every fleet that exists today already has a business profile (both seeded
-- fixtures carry an address, and so does any hand-created dev row). Without
-- this the §9.3.1 gate locks every existing account out of payouts on the day
-- this migration lands.
UPDATE "fleets"
   SET "profile_completed_at" = COALESCE("profile_completed_at", "created_at"),
       "onboarding_step" = 'done'
 WHERE "address" IS NOT NULL AND length(btrim("address")) > 0;
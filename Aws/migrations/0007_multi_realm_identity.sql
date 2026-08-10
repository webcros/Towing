CREATE TYPE "public"."admin_sub_role" AS ENUM('super_admin', 'operations', 'support', 'finance');--> statement-breakpoint
CREATE TYPE "public"."social_provider" AS ENUM('google', 'apple');--> statement-breakpoint
--
-- Postgres permits ALTER TYPE ... ADD VALUE inside a transaction block (PG12+),
-- but the new label CANNOT BE USED in that same transaction — and drizzle runs
-- each migration file in one. This is safe here ONLY because nothing below
-- inserts, defaults to, or compares against 'admin_login'; the first row
-- carrying it is written at runtime by AdminAuthService, long after this
-- commits. A future migration that needs to USE a label it adds must split
-- across two files.
--
ALTER TYPE "public"."otp_purpose" ADD VALUE IF NOT EXISTS 'admin_login';--> statement-breakpoint
CREATE TABLE "admin_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid NOT NULL,
	"action" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" uuid,
	"before" jsonb,
	"after" jsonb,
	"reason" text,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"mobile" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"sub_role" "admin_sub_role" NOT NULL,
	"status" "account_status" DEFAULT 'active' NOT NULL,
	"twofa_secret" text,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_users_email_unique" UNIQUE("email"),
	CONSTRAINT "admin_users_mobile_unique" UNIQUE("mobile")
);
--> statement-breakpoint
CREATE TABLE "social_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" "social_provider" NOT NULL,
	"provider_subject" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"email" text,
	"email_verified" boolean DEFAULT false NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	-- `subject_type` is part of the key on purpose: one person can drive AND
	-- book tows, and phone login already treats that as two accounts
	-- (`users.mobile` and `drivers.mobile` are independent unique keys).
	CONSTRAINT "uq_social_identities_provider_subject" UNIQUE("provider","provider_subject","subject_type")
);
--> statement-breakpoint
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_admin_id_admin_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_admin_actions_admin" ON "admin_actions" USING btree ("admin_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_admin_actions_subject" ON "admin_actions" USING btree ("subject_type","subject_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_admin_users_status" ON "admin_users" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_social_identities_subject" ON "social_identities" USING btree ("subject_type","subject_id");--> statement-breakpoint
--
-- §3.1: `pending` must mean "submitted and awaiting a human", and nothing else.
-- Phase 11's approval queue selects `pending`; leave the old default in place
-- and it fills with zero-document rows from every driver who has merely entered
-- an OTP, while the queue's "resume from incomplete" path becomes unreachable
-- for anyone who self-signed-up. Behaviourally inert for existing code: the one
-- insert site (drivers.repo.ts, the fleet invite path) already passes
-- 'incomplete' explicitly, and the seed passes a fixture value for every driver.
--
ALTER TABLE "drivers" ALTER COLUMN "kyc_status" SET DEFAULT 'incomplete';--> statement-breakpoint

--
-- ===========================================================================
-- Hand-written from here down: drizzle-kit emits neither CHECK constraints nor
-- a column RENAME without an interactive prompt (same reason 0002 carries the
-- money CHECKs, 0004 carries `uq_drivers_assigned_truck` and 0005 carries
-- `uq_alerts_open_subject`).
-- ===========================================================================
--

-- --- login_challenges: make the subject realm-portable ----------------------
--
-- `user_id` referenced `users` — the CUSTOMER table. Drivers live in `drivers`
-- and admins in `admin_users`, so neither id exists in `users`: the FIRST
-- driver OTP login took a foreign-key violation on INSERT.
--
--   ERROR: insert or update on table "login_challenges" violates foreign key
--          constraint "login_challenges_user_id_users_id_fk"
--   DETAIL: Key (user_id)=(<driver-uuid>) is not present in table "users".
--
-- `refresh_tokens.subject_id` has been polymorphic and FK-free (paired with
-- `realm`) since 0001 and happens to work, which is exactly what would have
-- made this present as a driver-only mystery bug.
--
-- A RENAME, not drop-and-add: a drop-and-add would discard every in-flight
-- login. Safe to do in one step here because 0007 lands pre-launch with no
-- production data; a zero-downtime version would need add / dual-write / drop
-- across two releases.
ALTER TABLE "login_challenges" DROP CONSTRAINT "login_challenges_user_id_users_id_fk";--> statement-breakpoint
DROP INDEX "idx_login_challenges_user";--> statement-breakpoint
ALTER TABLE "login_challenges" RENAME COLUMN "user_id" TO "subject_id";--> statement-breakpoint
-- Nullable, backfilled, then NOT NULL: a bare ADD COLUMN ... NOT NULL fails on
-- a non-empty table. Every row that exists today is a fleet-console challenge,
-- and fleet owners ARE rows in `users`, so 'user' is correct for all of them.
ALTER TABLE "login_challenges" ADD COLUMN "subject_type" text;--> statement-breakpoint
UPDATE "login_challenges" SET "subject_type" = 'user' WHERE "subject_type" IS NULL;--> statement-breakpoint
ALTER TABLE "login_challenges" ALTER COLUMN "subject_type" SET NOT NULL;--> statement-breakpoint
-- A CHECK rather than an enum: the set is closed and tiny, and an enum would
-- need its own ALTER TYPE dance (see the note at the top) every time a realm is
-- added. `refresh_tokens.realm` is unconstrained text for historical reasons;
-- this is the shape it should have had.
ALTER TABLE "login_challenges" ADD CONSTRAINT "ck_login_challenges_subject_type" CHECK ("subject_type" IN ('user', 'driver', 'admin'));--> statement-breakpoint
CREATE INDEX "idx_login_challenges_subject" ON "login_challenges" USING btree ("subject_type","subject_id","expires_at");--> statement-breakpoint

-- --- social_identities: same polymorphic shape ------------------------------
-- `subject_id` carries no FK because one Google identity binds to either a
-- `users` row or a `drivers` row, and no single foreign key expresses that.
ALTER TABLE "social_identities" ADD CONSTRAINT "ck_social_identities_subject_type" CHECK ("subject_type" IN ('user', 'driver'));--> statement-breakpoint

-- --- KYC approver identity: users -> admin_users ----------------------------
--
-- Both columns have referenced `users` — the CUSTOMER table — since 0001, and
-- nothing has ever read or written either (the seed sets `approved_at` but
-- never `approved_by`). So these two UPDATEs normally touch zero rows; they
-- exist so a hand-inserted local row fails a developer's `pnpm db:migrate`
-- with a readable NULL-out rather than an opaque constraint violation.
--
-- Deciding this now is the whole point: post-launch it is an expensive data
-- migration, and `POST /v1/admin/drivers/:id/kyc` becomes the first writer.
UPDATE "drivers" SET "approved_by" = NULL WHERE "approved_by" IS NOT NULL;--> statement-breakpoint
UPDATE "driver_documents" SET "verified_by" = NULL WHERE "verified_by" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "drivers" DROP CONSTRAINT "drivers_approved_by_users_id_fk";--> statement-breakpoint
ALTER TABLE "driver_documents" DROP CONSTRAINT "driver_documents_verified_by_users_id_fk";--> statement-breakpoint
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_approved_by_admin_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_documents" ADD CONSTRAINT "driver_documents_verified_by_admin_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;

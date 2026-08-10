CREATE TYPE "public"."account_status" AS ENUM('active', 'suspended', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."actor_role" AS ENUM('customer', 'driver', 'fleet_owner', 'admin', 'system');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('searching', 'assigned', 'en_route', 'arrived', 'in_progress', 'completed', 'paid', 'cancelled', 'no_drivers_found', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."commission_band" AS ENUM('A', 'B', 'C');--> statement-breakpoint
CREATE TYPE "public"."compliance_doc_type" AS ENUM('insurance', 'rc', 'puc', 'permit');--> statement-breakpoint
CREATE TYPE "public"."compliance_status" AS ENUM('valid', 'expiring_soon', 'expired');--> statement-breakpoint
CREATE TYPE "public"."doc_review_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."driver_doc_type" AS ENUM('license', 'rc', 'gov_id', 'inspection', 'selfie');--> statement-breakpoint
CREATE TYPE "public"."driver_level" AS ENUM('bronze', 'silver', 'gold', 'platinum');--> statement-breakpoint
CREATE TYPE "public"."fleet_status" AS ENUM('pending', 'active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."kyc_status" AS ENUM('pending', 'approved', 'rejected', 'incomplete', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."otp_purpose" AS ENUM('fleet_login', 'driver_login', 'customer_login', 'booking_start');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('upi', 'card', 'cash', 'wallet');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'authorized', 'captured', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('requested', 'processing', 'paid', 'failed');--> statement-breakpoint
CREATE TYPE "public"."refund_status" AS ENUM('pending', 'processed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."service_type" AS ENUM('tow', 'battery', 'flat_tyre', 'fuel', 'breakdown', 'accident_recovery');--> statement-breakpoint
CREATE TYPE "public"."truck_status" AS ENUM('active', 'inactive', 'non_compliant');--> statement-breakpoint
CREATE TYPE "public"."vehicle_class" AS ENUM('wheel_lift', 'flatbed');--> statement-breakpoint
CREATE TYPE "public"."wallet_owner_type" AS ENUM('user', 'driver', 'fleet');--> statement-breakpoint
CREATE TYPE "public"."wallet_txn_type" AS ENUM('fare_credit', 'commission_debit', 'fleet_share_credit', 'driver_share_credit', 'payout_debit', 'refund_debit', 'refund_credit', 'adjustment');--> statement-breakpoint
CREATE TABLE "addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"label" text,
	"full_address" text NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "emergency_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"relation" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"make_model" text,
	"plate" text,
	"rc_url" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mobile" text NOT NULL,
	"name" text,
	"email" text,
	"photo_url" text,
	"default_lat" double precision,
	"default_lng" double precision,
	"status" "account_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_mobile_unique" UNIQUE("mobile")
);
--> statement-breakpoint
CREATE TABLE "fleet_driver_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fleet_id" uuid NOT NULL,
	"driver_id" uuid NOT NULL,
	"driver_share" numeric(5, 2) NOT NULL,
	"fleet_share" numeric(5, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fleets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"business_name" text NOT NULL,
	"gstin" text,
	"address" text,
	"status" "fleet_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "driver_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" uuid NOT NULL,
	"doc_type" "driver_doc_type" NOT NULL,
	"file_url" text NOT NULL,
	"status" "doc_review_status" DEFAULT 'pending' NOT NULL,
	"verified_by" uuid,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drivers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mobile" text NOT NULL,
	"name" text,
	"email" text,
	"photo_url" text,
	"fleet_id" uuid,
	"kyc_status" "kyc_status" DEFAULT 'pending' NOT NULL,
	"is_online" boolean DEFAULT false NOT NULL,
	"vehicle_class" "vehicle_class",
	"long_distance_enabled" boolean DEFAULT false NOT NULL,
	"current_location" geography(Point,4326),
	"last_ping_at" timestamp with time zone,
	"rating" numeric(2, 1),
	"total_trips" integer DEFAULT 0 NOT NULL,
	"acceptance_rate" numeric(5, 2),
	"completion_rate" numeric(5, 2),
	"level" "driver_level" DEFAULT 'bronze' NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drivers_mobile_unique" UNIQUE("mobile")
);
--> statement-breakpoint
CREATE TABLE "compliance_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"truck_id" uuid NOT NULL,
	"doc_type" "compliance_doc_type" NOT NULL,
	"file_url" text,
	"issued_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"alert_sent_30d" boolean DEFAULT false NOT NULL,
	"status" "compliance_status" DEFAULT 'valid' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fleet_trucks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fleet_id" uuid NOT NULL,
	"type" "vehicle_class" NOT NULL,
	"plate" text NOT NULL,
	"capacity" text,
	"current_location" geography(Point,4326),
	"last_ping_at" timestamp with time zone,
	"status" "truck_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"area" geography(Polygon,4326) NOT NULL,
	"surge_band" text,
	"is_highway" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"dispatch_config" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_location_path" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"status" "booking_status" NOT NULL,
	"actor" "actor_role" DEFAULT 'system' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"driver_id" uuid,
	"fleet_id" uuid,
	"zone_id" uuid,
	"service_type" "service_type" NOT NULL,
	"vehicle_class" "vehicle_class" NOT NULL,
	"pickup_lat" double precision NOT NULL,
	"pickup_lng" double precision NOT NULL,
	"pickup_address" text,
	"drop_lat" double precision,
	"drop_lng" double precision,
	"drop_address" text,
	"distance_km" numeric(8, 2),
	"status" "booking_status" DEFAULT 'searching' NOT NULL,
	"base_fare" numeric(12, 2) DEFAULT '0' NOT NULL,
	"distance_charge" numeric(12, 2) DEFAULT '0' NOT NULL,
	"night_charge" numeric(12, 2) DEFAULT '0' NOT NULL,
	"highway_charge" numeric(12, 2) DEFAULT '0' NOT NULL,
	"accident_charge" numeric(12, 2) DEFAULT '0' NOT NULL,
	"waiting_charge" numeric(12, 2) DEFAULT '0' NOT NULL,
	"surge_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"discount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"commission_band" "commission_band",
	"commission_pct" numeric(5, 2),
	"commission_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"driver_payout" numeric(12, 2) DEFAULT '0' NOT NULL,
	"booking_otp" text,
	"otp_verified" boolean DEFAULT false NOT NULL,
	"otp_expires_at" timestamp with time zone,
	"share_token" text,
	"share_expires_at" timestamp with time zone,
	"cancelled_by" "actor_role",
	"cancellation_reason" text,
	"cancellation_fee" numeric(12, 2) DEFAULT '0' NOT NULL,
	"unable_reason" text,
	"payment_id" uuid,
	"payment_method" "payment_method",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dispatch_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"wave" integer NOT NULL,
	"radius_km" numeric(6, 2) NOT NULL,
	"driver_id" uuid,
	"outcome" text NOT NULL,
	"offered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"gateway_ref" text,
	"amount" numeric(12, 2) NOT NULL,
	"method" "payment_method" NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_payments_idempotency_key" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"owner_type" "wallet_owner_type" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"route_ref" text,
	"status" "payout_status" DEFAULT 'requested' NOT NULL,
	"idempotency_key" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone,
	CONSTRAINT "uq_payouts_idempotency_key" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"reason" text,
	"gateway_ref" text,
	"status" "refund_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallet_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_id" uuid NOT NULL,
	"type" "wallet_txn_type" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"reason" text,
	"ref_id" uuid,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_wallet_transactions_idempotency_key" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"owner_type" "wallet_owner_type" NOT NULL,
	"balance" numeric(12, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_wallets_owner" UNIQUE("owner_type","owner_id")
);
--> statement-breakpoint
CREATE TABLE "otp_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"purpose" "otp_purpose" NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"realm" text NOT NULL,
	"fleet_id" uuid,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"rotated_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_reason" text,
	"user_agent" text,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refresh_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emergency_contacts" ADD CONSTRAINT "emergency_contacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_vehicles" ADD CONSTRAINT "saved_vehicles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet_driver_shares" ADD CONSTRAINT "fleet_driver_shares_fleet_id_fleets_id_fk" FOREIGN KEY ("fleet_id") REFERENCES "public"."fleets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleets" ADD CONSTRAINT "fleets_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_documents" ADD CONSTRAINT "driver_documents_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_documents" ADD CONSTRAINT "driver_documents_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_fleet_id_fleets_id_fk" FOREIGN KEY ("fleet_id") REFERENCES "public"."fleets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_documents" ADD CONSTRAINT "compliance_documents_truck_id_fleet_trucks_id_fk" FOREIGN KEY ("truck_id") REFERENCES "public"."fleet_trucks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet_trucks" ADD CONSTRAINT "fleet_trucks_fleet_id_fleets_id_fk" FOREIGN KEY ("fleet_id") REFERENCES "public"."fleets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_location_path" ADD CONSTRAINT "booking_location_path_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_status_history" ADD CONSTRAINT "booking_status_history_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_fleet_id_fleets_id_fk" FOREIGN KEY ("fleet_id") REFERENCES "public"."fleets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_zone_id_service_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."service_zones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatch_attempts" ADD CONSTRAINT "dispatch_attempts_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatch_attempts" ADD CONSTRAINT "dispatch_attempts_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_addresses_user" ON "addresses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_emergency_contacts_user" ON "emergency_contacts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_saved_vehicles_user" ON "saved_vehicles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_users_status" ON "users" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_fleet_driver_shares_fleet" ON "fleet_driver_shares" USING btree ("fleet_id");--> statement-breakpoint
CREATE INDEX "idx_fleets_owner" ON "fleets" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_fleets_status" ON "fleets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_driver_documents_driver" ON "driver_documents" USING btree ("driver_id");--> statement-breakpoint
CREATE INDEX "idx_drivers_status" ON "drivers" USING btree ("kyc_status","is_online");--> statement-breakpoint
CREATE INDEX "idx_drivers_fleet" ON "drivers" USING btree ("fleet_id");--> statement-breakpoint
CREATE INDEX "idx_compliance_documents_truck" ON "compliance_documents" USING btree ("truck_id");--> statement-breakpoint
CREATE INDEX "idx_fleet_trucks_fleet" ON "fleet_trucks" USING btree ("fleet_id");--> statement-breakpoint
CREATE INDEX "idx_fleet_trucks_status" ON "fleet_trucks" USING btree ("fleet_id","status");--> statement-breakpoint
CREATE INDEX "idx_booking_location_path_booking" ON "booking_location_path" USING btree ("booking_id","recorded_at");--> statement-breakpoint
CREATE INDEX "idx_booking_status_history_booking" ON "booking_status_history" USING btree ("booking_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_bookings_status" ON "bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_bookings_user" ON "bookings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_bookings_driver" ON "bookings" USING btree ("driver_id");--> statement-breakpoint
CREATE INDEX "idx_bookings_fleet" ON "bookings" USING btree ("fleet_id");--> statement-breakpoint
CREATE INDEX "idx_bookings_fleet_feed" ON "bookings" USING btree ("fleet_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_dispatch_attempts_booking" ON "dispatch_attempts" USING btree ("booking_id","wave");--> statement-breakpoint
CREATE INDEX "idx_payments_booking" ON "payments" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "idx_payouts_owner" ON "payouts" USING btree ("owner_type","owner_id","requested_at");--> statement-breakpoint
CREATE INDEX "idx_refunds_booking" ON "refunds" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "idx_wallet_transactions_wallet" ON "wallet_transactions" USING btree ("wallet_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_wallet_transactions_ref" ON "wallet_transactions" USING btree ("ref_id");--> statement-breakpoint
CREATE INDEX "idx_otp_verifications_lookup" ON "otp_verifications" USING btree ("phone","purpose","expires_at");--> statement-breakpoint
CREATE INDEX "idx_refresh_tokens_family" ON "refresh_tokens" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "idx_refresh_tokens_subject" ON "refresh_tokens" USING btree ("subject_id","realm");
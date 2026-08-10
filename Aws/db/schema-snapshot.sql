--
-- PostgreSQL database dump
--

-- Dumped from database version 16.4 (Debian 16.4-1.pgdg110+2)
-- Dumped by pg_dump version 16.4 (Debian 16.4-1.pgdg110+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: drizzle; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA drizzle;


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- Name: tiger; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA tiger;


--
-- Name: tiger_data; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA tiger_data;


--
-- Name: topology; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA topology;


--
-- Name: SCHEMA topology; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA topology IS 'PostGIS Topology schema';


--
-- Name: postgis; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;


--
-- Name: EXTENSION postgis; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION postgis IS 'PostGIS geometry and geography spatial types and functions';


--
-- Name: account_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.account_status AS ENUM (
    'active',
    'suspended',
    'deleted'
);


--
-- Name: actor_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.actor_role AS ENUM (
    'customer',
    'driver',
    'fleet_owner',
    'admin',
    'system'
);


--
-- Name: admin_sub_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.admin_sub_role AS ENUM (
    'super_admin',
    'operations',
    'support',
    'finance'
);


--
-- Name: alert_severity; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.alert_severity AS ENUM (
    'info',
    'warning',
    'error'
);


--
-- Name: alert_subject_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.alert_subject_type AS ENUM (
    'compliance_document',
    'truck',
    'payout'
);


--
-- Name: alert_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.alert_type AS ENUM (
    'doc_expiring',
    'doc_expired',
    'truck_idle',
    'payout_failed'
);


--
-- Name: booking_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.booking_status AS ENUM (
    'searching',
    'assigned',
    'en_route',
    'arrived',
    'in_progress',
    'completed',
    'paid',
    'cancelled',
    'no_drivers_found',
    'disputed'
);


--
-- Name: commission_band; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.commission_band AS ENUM (
    'A',
    'B',
    'C'
);


--
-- Name: compliance_doc_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.compliance_doc_type AS ENUM (
    'insurance',
    'rc',
    'puc',
    'permit'
);


--
-- Name: compliance_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.compliance_status AS ENUM (
    'valid',
    'expiring_soon',
    'expired'
);


--
-- Name: doc_review_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.doc_review_status AS ENUM (
    'pending',
    'approved',
    'rejected'
);


--
-- Name: driver_doc_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.driver_doc_type AS ENUM (
    'license',
    'rc',
    'gov_id',
    'inspection',
    'selfie'
);


--
-- Name: driver_level; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.driver_level AS ENUM (
    'bronze',
    'silver',
    'gold',
    'platinum'
);


--
-- Name: fleet_onboarding_step; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.fleet_onboarding_step AS ENUM (
    'profile',
    'payout_account',
    'notifications',
    'done'
);


--
-- Name: fleet_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.fleet_status AS ENUM (
    'pending',
    'active',
    'suspended'
);


--
-- Name: import_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.import_status AS ENUM (
    'pending',
    'processing',
    'completed',
    'failed'
);


--
-- Name: kyc_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.kyc_status AS ENUM (
    'pending',
    'approved',
    'rejected',
    'incomplete',
    'suspended'
);


--
-- Name: otp_purpose; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.otp_purpose AS ENUM (
    'fleet_login',
    'driver_login',
    'customer_login',
    'booking_start',
    'admin_login'
);


--
-- Name: payment_method; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_method AS ENUM (
    'upi',
    'card',
    'cash',
    'wallet'
);


--
-- Name: payment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_status AS ENUM (
    'pending',
    'authorized',
    'captured',
    'failed',
    'refunded'
);


--
-- Name: payout_account_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payout_account_status AS ENUM (
    'unlinked',
    'pending',
    'active',
    'rejected',
    'suspended'
);


--
-- Name: payout_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payout_status AS ENUM (
    'requested',
    'processing',
    'paid',
    'failed'
);


--
-- Name: refund_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.refund_status AS ENUM (
    'pending',
    'processed',
    'failed'
);


--
-- Name: service_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.service_type AS ENUM (
    'tow',
    'battery',
    'flat_tyre',
    'fuel',
    'breakdown',
    'accident_recovery'
);


--
-- Name: social_provider; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.social_provider AS ENUM (
    'google',
    'apple'
);


--
-- Name: truck_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.truck_status AS ENUM (
    'active',
    'inactive',
    'non_compliant'
);


--
-- Name: vehicle_class; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.vehicle_class AS ENUM (
    'wheel_lift',
    'flatbed'
);


--
-- Name: wallet_owner_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.wallet_owner_type AS ENUM (
    'user',
    'driver',
    'fleet'
);


--
-- Name: wallet_txn_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.wallet_txn_type AS ENUM (
    'fare_credit',
    'commission_debit',
    'fleet_share_credit',
    'driver_share_credit',
    'payout_debit',
    'refund_debit',
    'refund_credit',
    'adjustment'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: __drizzle_migrations; Type: TABLE; Schema: drizzle; Owner: -
--

CREATE TABLE drizzle.__drizzle_migrations (
    id integer NOT NULL,
    hash text NOT NULL,
    created_at bigint
);


--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE; Schema: drizzle; Owner: -
--

CREATE SEQUENCE drizzle.__drizzle_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: drizzle; Owner: -
--

ALTER SEQUENCE drizzle.__drizzle_migrations_id_seq OWNED BY drizzle.__drizzle_migrations.id;


--
-- Name: addresses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.addresses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    label text,
    full_address text NOT NULL,
    lat double precision NOT NULL,
    lng double precision NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: admin_actions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_actions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    admin_id uuid NOT NULL,
    action text NOT NULL,
    subject_type text NOT NULL,
    subject_id uuid,
    before jsonb,
    after jsonb,
    reason text,
    ip text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: admin_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    mobile text NOT NULL,
    name text NOT NULL,
    password_hash text NOT NULL,
    sub_role public.admin_sub_role NOT NULL,
    status public.account_status DEFAULT 'active'::public.account_status NOT NULL,
    twofa_secret text,
    failed_attempts integer DEFAULT 0 NOT NULL,
    locked_until timestamp with time zone,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    fleet_id uuid NOT NULL,
    type public.alert_type NOT NULL,
    severity public.alert_severity NOT NULL,
    message text NOT NULL,
    href text NOT NULL,
    subject_type public.alert_subject_type NOT NULL,
    subject_id uuid NOT NULL,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: booking_location_path; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_location_path (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid NOT NULL,
    lat double precision NOT NULL,
    lng double precision NOT NULL,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: booking_status_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_status_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid NOT NULL,
    status public.booking_status NOT NULL,
    actor public.actor_role DEFAULT 'system'::public.actor_role NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bookings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    driver_id uuid,
    fleet_id uuid,
    zone_id uuid,
    service_type public.service_type NOT NULL,
    vehicle_class public.vehicle_class NOT NULL,
    pickup_lat double precision NOT NULL,
    pickup_lng double precision NOT NULL,
    pickup_address text,
    drop_lat double precision,
    drop_lng double precision,
    drop_address text,
    distance_km numeric(8,2),
    status public.booking_status DEFAULT 'searching'::public.booking_status NOT NULL,
    base_fare numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    distance_charge numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    night_charge numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    highway_charge numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    accident_charge numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    waiting_charge numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    surge_amount numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    discount numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    total numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    commission_band public.commission_band,
    commission_pct numeric(5,2),
    commission_amount numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    driver_payout numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    booking_otp text,
    otp_verified boolean DEFAULT false NOT NULL,
    otp_expires_at timestamp with time zone,
    share_token text,
    share_expires_at timestamp with time zone,
    cancelled_by public.actor_role,
    cancellation_reason text,
    cancellation_fee numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    unable_reason text,
    payment_id uuid,
    payment_method public.payment_method,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_bookings_commission_pct_guardrail CHECK (((commission_pct IS NULL) OR ((commission_pct >= (5)::numeric) AND (commission_pct <= (10)::numeric)))),
    CONSTRAINT ck_bookings_non_negative CHECK (((total >= (0)::numeric) AND (commission_amount >= (0)::numeric) AND (driver_payout >= (0)::numeric) AND (discount >= (0)::numeric))),
    CONSTRAINT ck_bookings_payout_within_total CHECK (((commission_amount + driver_payout) <= total))
);


--
-- Name: compliance_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compliance_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    truck_id uuid NOT NULL,
    doc_type public.compliance_doc_type NOT NULL,
    file_url text,
    issued_at timestamp with time zone,
    expires_at timestamp with time zone,
    alert_sent_30d boolean DEFAULT false NOT NULL,
    status public.compliance_status DEFAULT 'valid'::public.compliance_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: dispatch_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dispatch_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid NOT NULL,
    wave integer NOT NULL,
    radius_km numeric(6,2) NOT NULL,
    driver_id uuid,
    outcome text NOT NULL,
    offered_at timestamp with time zone DEFAULT now() NOT NULL,
    responded_at timestamp with time zone
);


--
-- Name: driver_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.driver_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    driver_id uuid NOT NULL,
    doc_type public.driver_doc_type NOT NULL,
    file_url text NOT NULL,
    status public.doc_review_status DEFAULT 'pending'::public.doc_review_status NOT NULL,
    verified_by uuid,
    verified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: drivers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.drivers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    mobile text NOT NULL,
    name text,
    email text,
    photo_url text,
    fleet_id uuid,
    kyc_status public.kyc_status DEFAULT 'incomplete'::public.kyc_status NOT NULL,
    is_online boolean DEFAULT false NOT NULL,
    vehicle_class public.vehicle_class,
    long_distance_enabled boolean DEFAULT false NOT NULL,
    current_location public.geography(Point,4326),
    last_ping_at timestamp with time zone,
    rating numeric(2,1),
    total_trips integer DEFAULT 0 NOT NULL,
    acceptance_rate numeric(5,2),
    completion_rate numeric(5,2),
    level public.driver_level DEFAULT 'bronze'::public.driver_level NOT NULL,
    approved_by uuid,
    approved_at timestamp with time zone,
    rejection_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    assigned_truck_id uuid
);


--
-- Name: earnings_daily; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.earnings_daily (
    fleet_id uuid NOT NULL,
    day date NOT NULL,
    driver_id uuid NOT NULL,
    jobs integer DEFAULT 0 NOT NULL,
    gross numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    commission numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    pool numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    driver_share numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    fleet_share numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: emergency_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.emergency_contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    phone text NOT NULL,
    relation text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: fleet_driver_shares; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fleet_driver_shares (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    fleet_id uuid NOT NULL,
    driver_id uuid NOT NULL,
    driver_share numeric(5,2) NOT NULL,
    fleet_share numeric(5,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_fleet_driver_shares_sum_100 CHECK (((driver_share + fleet_share) = (100)::numeric))
);


--
-- Name: fleet_owner_credentials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fleet_owner_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    failed_attempts integer DEFAULT 0 NOT NULL,
    locked_until timestamp with time zone,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: fleet_trucks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fleet_trucks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    fleet_id uuid NOT NULL,
    type public.vehicle_class NOT NULL,
    plate text NOT NULL,
    capacity text,
    current_location public.geography(Point,4326),
    last_ping_at timestamp with time zone,
    status public.truck_status DEFAULT 'active'::public.truck_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: fleets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fleets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    business_name text NOT NULL,
    gstin text,
    address text,
    status public.fleet_status DEFAULT 'pending'::public.fleet_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    notification_prefs jsonb DEFAULT '{}'::jsonb NOT NULL,
    onboarding_step public.fleet_onboarding_step DEFAULT 'profile'::public.fleet_onboarding_step NOT NULL,
    profile_completed_at timestamp with time zone,
    CONSTRAINT ck_fleets_notification_prefs_object CHECK ((jsonb_typeof(notification_prefs) = 'object'::text)),
    CONSTRAINT ck_fleets_profile_completed_requires_address CHECK (((profile_completed_at IS NULL) OR ((address IS NOT NULL) AND (length(btrim(address)) > 0))))
);


--
-- Name: login_challenges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.login_challenges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subject_id uuid NOT NULL,
    realm text NOT NULL,
    otp_id uuid NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    consumed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    subject_type text NOT NULL,
    CONSTRAINT ck_login_challenges_subject_type CHECK ((subject_type = ANY (ARRAY['user'::text, 'driver'::text, 'admin'::text])))
);


--
-- Name: otp_verifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.otp_verifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    phone text NOT NULL,
    purpose public.otp_purpose NOT NULL,
    code_hash text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid NOT NULL,
    gateway_ref text,
    amount numeric(12,2) NOT NULL,
    method public.payment_method NOT NULL,
    status public.payment_status DEFAULT 'pending'::public.payment_status NOT NULL,
    idempotency_key text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_payments_amount_positive CHECK ((amount > (0)::numeric))
);


--
-- Name: payout_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payout_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    owner_type public.wallet_owner_type NOT NULL,
    status public.payout_account_status DEFAULT 'unlinked'::public.payout_account_status NOT NULL,
    route_account_id text,
    route_fund_account_id text,
    beneficiary_name text,
    account_number_last4 text,
    account_number_fingerprint text,
    ifsc text,
    bank_name text,
    failure_reason text,
    linked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_payout_accounts_active_has_destination CHECK (((status <> 'active'::public.payout_account_status) OR (route_fund_account_id IS NOT NULL))),
    CONSTRAINT ck_payout_accounts_ifsc CHECK (((ifsc IS NULL) OR (ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$'::text)))
);


--
-- Name: payouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payouts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    owner_type public.wallet_owner_type NOT NULL,
    amount numeric(12,2) NOT NULL,
    route_ref text,
    status public.payout_status DEFAULT 'requested'::public.payout_status NOT NULL,
    idempotency_key text,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    paid_at timestamp with time zone,
    failure_reason text,
    provider text,
    last_synced_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_payouts_amount_positive CHECK ((amount > (0)::numeric))
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refresh_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    family_id uuid NOT NULL,
    subject_id uuid NOT NULL,
    realm text NOT NULL,
    fleet_id uuid,
    token_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    rotated_at timestamp with time zone,
    revoked_at timestamp with time zone,
    revoked_reason text,
    user_agent text,
    ip text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: refunds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refunds (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid NOT NULL,
    amount numeric(12,2) NOT NULL,
    reason text,
    gateway_ref text,
    status public.refund_status DEFAULT 'pending'::public.refund_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_refunds_amount_positive CHECK ((amount > (0)::numeric))
);


--
-- Name: saved_vehicles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.saved_vehicles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type text NOT NULL,
    make_model text,
    plate text,
    rc_url text,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: service_zones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_zones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    area public.geography(Polygon,4326) NOT NULL,
    surge_band text,
    is_highway boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    dispatch_config jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: social_identities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.social_identities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider public.social_provider NOT NULL,
    provider_subject text NOT NULL,
    subject_type text NOT NULL,
    subject_id uuid NOT NULL,
    email text,
    email_verified boolean DEFAULT false NOT NULL,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_social_identities_subject_type CHECK ((subject_type = ANY (ARRAY['user'::text, 'driver'::text])))
);


--
-- Name: truck_imports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.truck_imports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    fleet_id uuid NOT NULL,
    filename text,
    status public.import_status DEFAULT 'pending'::public.import_status NOT NULL,
    total_rows integer DEFAULT 0 NOT NULL,
    imported_rows integer DEFAULT 0 NOT NULL,
    failed_rows integer DEFAULT 0 NOT NULL,
    errors jsonb DEFAULT '[]'::jsonb NOT NULL,
    payload text,
    failure_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    mobile text NOT NULL,
    name text,
    email text,
    photo_url text,
    default_lat double precision,
    default_lng double precision,
    status public.account_status DEFAULT 'active'::public.account_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: wallet_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wallet_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    wallet_id uuid NOT NULL,
    type public.wallet_txn_type NOT NULL,
    amount numeric(12,2) NOT NULL,
    reason text,
    ref_id uuid,
    idempotency_key text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_wallet_transactions_amount_nonzero CHECK ((amount <> (0)::numeric))
);


--
-- Name: wallets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wallets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    owner_type public.wallet_owner_type NOT NULL,
    balance numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: webhook_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.webhook_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider text NOT NULL,
    event_id text NOT NULL,
    event_type text NOT NULL,
    payload jsonb NOT NULL,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone,
    error text
);


--
-- Name: __drizzle_migrations id; Type: DEFAULT; Schema: drizzle; Owner: -
--

ALTER TABLE ONLY drizzle.__drizzle_migrations ALTER COLUMN id SET DEFAULT nextval('drizzle.__drizzle_migrations_id_seq'::regclass);


--
-- Name: __drizzle_migrations __drizzle_migrations_pkey; Type: CONSTRAINT; Schema: drizzle; Owner: -
--

ALTER TABLE ONLY drizzle.__drizzle_migrations
    ADD CONSTRAINT __drizzle_migrations_pkey PRIMARY KEY (id);


--
-- Name: addresses addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addresses
    ADD CONSTRAINT addresses_pkey PRIMARY KEY (id);


--
-- Name: admin_actions admin_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_actions
    ADD CONSTRAINT admin_actions_pkey PRIMARY KEY (id);


--
-- Name: admin_users admin_users_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_email_unique UNIQUE (email);


--
-- Name: admin_users admin_users_mobile_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_mobile_unique UNIQUE (mobile);


--
-- Name: admin_users admin_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_pkey PRIMARY KEY (id);


--
-- Name: alerts alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_pkey PRIMARY KEY (id);


--
-- Name: booking_location_path booking_location_path_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_location_path
    ADD CONSTRAINT booking_location_path_pkey PRIMARY KEY (id);


--
-- Name: booking_status_history booking_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_status_history
    ADD CONSTRAINT booking_status_history_pkey PRIMARY KEY (id);


--
-- Name: bookings bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);


--
-- Name: compliance_documents compliance_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_documents
    ADD CONSTRAINT compliance_documents_pkey PRIMARY KEY (id);


--
-- Name: dispatch_attempts dispatch_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispatch_attempts
    ADD CONSTRAINT dispatch_attempts_pkey PRIMARY KEY (id);


--
-- Name: driver_documents driver_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_documents
    ADD CONSTRAINT driver_documents_pkey PRIMARY KEY (id);


--
-- Name: drivers drivers_mobile_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_mobile_unique UNIQUE (mobile);


--
-- Name: drivers drivers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_pkey PRIMARY KEY (id);


--
-- Name: earnings_daily earnings_daily_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.earnings_daily
    ADD CONSTRAINT earnings_daily_pkey PRIMARY KEY (fleet_id, day, driver_id);


--
-- Name: emergency_contacts emergency_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emergency_contacts
    ADD CONSTRAINT emergency_contacts_pkey PRIMARY KEY (id);


--
-- Name: fleet_driver_shares fleet_driver_shares_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fleet_driver_shares
    ADD CONSTRAINT fleet_driver_shares_pkey PRIMARY KEY (id);


--
-- Name: fleet_owner_credentials fleet_owner_credentials_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fleet_owner_credentials
    ADD CONSTRAINT fleet_owner_credentials_email_unique UNIQUE (email);


--
-- Name: fleet_owner_credentials fleet_owner_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fleet_owner_credentials
    ADD CONSTRAINT fleet_owner_credentials_pkey PRIMARY KEY (id);


--
-- Name: fleet_owner_credentials fleet_owner_credentials_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fleet_owner_credentials
    ADD CONSTRAINT fleet_owner_credentials_user_id_unique UNIQUE (user_id);


--
-- Name: fleet_trucks fleet_trucks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fleet_trucks
    ADD CONSTRAINT fleet_trucks_pkey PRIMARY KEY (id);


--
-- Name: fleets fleets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fleets
    ADD CONSTRAINT fleets_pkey PRIMARY KEY (id);


--
-- Name: login_challenges login_challenges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_challenges
    ADD CONSTRAINT login_challenges_pkey PRIMARY KEY (id);


--
-- Name: otp_verifications otp_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.otp_verifications
    ADD CONSTRAINT otp_verifications_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: payout_accounts payout_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payout_accounts
    ADD CONSTRAINT payout_accounts_pkey PRIMARY KEY (id);


--
-- Name: payouts payouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payouts
    ADD CONSTRAINT payouts_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_hash_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_hash_unique UNIQUE (token_hash);


--
-- Name: refunds refunds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_pkey PRIMARY KEY (id);


--
-- Name: saved_vehicles saved_vehicles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_vehicles
    ADD CONSTRAINT saved_vehicles_pkey PRIMARY KEY (id);


--
-- Name: service_zones service_zones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_zones
    ADD CONSTRAINT service_zones_pkey PRIMARY KEY (id);


--
-- Name: social_identities social_identities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_identities
    ADD CONSTRAINT social_identities_pkey PRIMARY KEY (id);


--
-- Name: truck_imports truck_imports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.truck_imports
    ADD CONSTRAINT truck_imports_pkey PRIMARY KEY (id);


--
-- Name: fleet_driver_shares uq_fleet_driver_shares_pair; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fleet_driver_shares
    ADD CONSTRAINT uq_fleet_driver_shares_pair UNIQUE (fleet_id, driver_id);


--
-- Name: payments uq_payments_idempotency_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT uq_payments_idempotency_key UNIQUE (idempotency_key);


--
-- Name: payout_accounts uq_payout_accounts_owner; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payout_accounts
    ADD CONSTRAINT uq_payout_accounts_owner UNIQUE (owner_type, owner_id);


--
-- Name: payouts uq_payouts_idempotency_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payouts
    ADD CONSTRAINT uq_payouts_idempotency_key UNIQUE (idempotency_key);


--
-- Name: social_identities uq_social_identities_provider_subject; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_identities
    ADD CONSTRAINT uq_social_identities_provider_subject UNIQUE (provider, provider_subject, subject_type);


--
-- Name: wallet_transactions uq_wallet_transactions_idempotency_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_transactions
    ADD CONSTRAINT uq_wallet_transactions_idempotency_key UNIQUE (idempotency_key);


--
-- Name: wallets uq_wallets_owner; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT uq_wallets_owner UNIQUE (owner_type, owner_id);


--
-- Name: webhook_events uq_webhook_events_provider_event; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_events
    ADD CONSTRAINT uq_webhook_events_provider_event UNIQUE (provider, event_id);


--
-- Name: users users_mobile_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_mobile_unique UNIQUE (mobile);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: wallet_transactions wallet_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_transactions
    ADD CONSTRAINT wallet_transactions_pkey PRIMARY KEY (id);


--
-- Name: wallets wallets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_pkey PRIMARY KEY (id);


--
-- Name: webhook_events webhook_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_events
    ADD CONSTRAINT webhook_events_pkey PRIMARY KEY (id);


--
-- Name: idx_addresses_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_addresses_user ON public.addresses USING btree (user_id);


--
-- Name: idx_admin_actions_admin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_actions_admin ON public.admin_actions USING btree (admin_id, created_at DESC NULLS LAST);


--
-- Name: idx_admin_actions_subject; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_actions_subject ON public.admin_actions USING btree (subject_type, subject_id, created_at DESC NULLS LAST);


--
-- Name: idx_admin_users_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_users_status ON public.admin_users USING btree (status);


--
-- Name: idx_alerts_feed_open; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alerts_feed_open ON public.alerts USING btree (fleet_id, created_at DESC NULLS LAST, id DESC NULLS LAST) WHERE (resolved_at IS NULL);


--
-- Name: idx_alerts_fleet_open; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alerts_fleet_open ON public.alerts USING btree (fleet_id, created_at DESC NULLS LAST);


--
-- Name: idx_booking_location_path_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_location_path_booking ON public.booking_location_path USING btree (booking_id, recorded_at);


--
-- Name: idx_booking_status_history_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_status_history_booking ON public.booking_status_history USING btree (booking_id, created_at);


--
-- Name: idx_bookings_driver; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_driver ON public.bookings USING btree (driver_id);


--
-- Name: idx_bookings_fleet; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_fleet ON public.bookings USING btree (fleet_id);


--
-- Name: idx_bookings_fleet_feed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_fleet_feed ON public.bookings USING btree (fleet_id, created_at DESC NULLS LAST, id DESC NULLS LAST);


--
-- Name: idx_bookings_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_status ON public.bookings USING btree (status);


--
-- Name: idx_bookings_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_user ON public.bookings USING btree (user_id);


--
-- Name: idx_compliance_documents_active_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compliance_documents_active_expiry ON public.compliance_documents USING btree (expires_at) WHERE ((status <> 'expired'::public.compliance_status) AND (expires_at IS NOT NULL));


--
-- Name: idx_compliance_documents_truck; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compliance_documents_truck ON public.compliance_documents USING btree (truck_id);


--
-- Name: idx_dispatch_attempts_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dispatch_attempts_booking ON public.dispatch_attempts USING btree (booking_id, wave);


--
-- Name: idx_driver_documents_driver; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_driver_documents_driver ON public.driver_documents USING btree (driver_id);


--
-- Name: idx_drivers_fleet; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_drivers_fleet ON public.drivers USING btree (fleet_id);


--
-- Name: idx_drivers_geo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_drivers_geo ON public.drivers USING gist (current_location);


--
-- Name: idx_drivers_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_drivers_status ON public.drivers USING btree (kyc_status, is_online);


--
-- Name: idx_earnings_daily_fleet_day; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_earnings_daily_fleet_day ON public.earnings_daily USING btree (fleet_id, day DESC NULLS LAST);


--
-- Name: idx_emergency_contacts_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_emergency_contacts_user ON public.emergency_contacts USING btree (user_id);


--
-- Name: idx_fleet_driver_shares_fleet; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fleet_driver_shares_fleet ON public.fleet_driver_shares USING btree (fleet_id);


--
-- Name: idx_fleet_owner_credentials_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fleet_owner_credentials_email ON public.fleet_owner_credentials USING btree (email);


--
-- Name: idx_fleet_trucks_fleet; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fleet_trucks_fleet ON public.fleet_trucks USING btree (fleet_id);


--
-- Name: idx_fleet_trucks_geo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fleet_trucks_geo ON public.fleet_trucks USING gist (current_location);


--
-- Name: idx_fleet_trucks_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fleet_trucks_status ON public.fleet_trucks USING btree (fleet_id, status);


--
-- Name: idx_fleets_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fleets_owner ON public.fleets USING btree (owner_id);


--
-- Name: idx_fleets_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fleets_status ON public.fleets USING btree (status);


--
-- Name: idx_login_challenges_subject; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_login_challenges_subject ON public.login_challenges USING btree (subject_type, subject_id, expires_at);


--
-- Name: idx_otp_verifications_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_otp_verifications_lookup ON public.otp_verifications USING btree (phone, purpose, expires_at);


--
-- Name: idx_payments_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_booking ON public.payments USING btree (booking_id);


--
-- Name: idx_payout_accounts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payout_accounts_status ON public.payout_accounts USING btree (status);


--
-- Name: idx_payouts_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payouts_owner ON public.payouts USING btree (owner_type, owner_id, requested_at);


--
-- Name: idx_payouts_owner_feed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payouts_owner_feed ON public.payouts USING btree (owner_type, owner_id, requested_at DESC NULLS LAST, id DESC NULLS LAST);


--
-- Name: idx_refresh_tokens_family; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refresh_tokens_family ON public.refresh_tokens USING btree (family_id);


--
-- Name: idx_refresh_tokens_subject; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refresh_tokens_subject ON public.refresh_tokens USING btree (subject_id, realm);


--
-- Name: idx_refunds_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refunds_booking ON public.refunds USING btree (booking_id);


--
-- Name: idx_saved_vehicles_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_saved_vehicles_user ON public.saved_vehicles USING btree (user_id);


--
-- Name: idx_service_zones_geo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_zones_geo ON public.service_zones USING gist (area);


--
-- Name: idx_social_identities_subject; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_social_identities_subject ON public.social_identities USING btree (subject_type, subject_id);


--
-- Name: idx_truck_imports_fleet; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_truck_imports_fleet ON public.truck_imports USING btree (fleet_id, created_at DESC NULLS LAST);


--
-- Name: idx_users_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_status ON public.users USING btree (status);


--
-- Name: idx_wallet_transactions_ref; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wallet_transactions_ref ON public.wallet_transactions USING btree (ref_id);


--
-- Name: idx_wallet_transactions_wallet; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wallet_transactions_wallet ON public.wallet_transactions USING btree (wallet_id, created_at);


--
-- Name: uq_alerts_open_subject; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_alerts_open_subject ON public.alerts USING btree (fleet_id, type, subject_id) WHERE (resolved_at IS NULL);


--
-- Name: uq_drivers_assigned_truck; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_drivers_assigned_truck ON public.drivers USING btree (assigned_truck_id) WHERE (assigned_truck_id IS NOT NULL);


--
-- Name: uq_fleet_trucks_fleet_plate; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_fleet_trucks_fleet_plate ON public.fleet_trucks USING btree (fleet_id, plate);


--
-- Name: uq_payouts_one_open_per_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_payouts_one_open_per_owner ON public.payouts USING btree (owner_type, owner_id) WHERE (status = ANY (ARRAY['requested'::public.payout_status, 'processing'::public.payout_status]));


--
-- Name: uq_payouts_route_ref; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_payouts_route_ref ON public.payouts USING btree (route_ref) WHERE (route_ref IS NOT NULL);


--
-- Name: addresses addresses_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addresses
    ADD CONSTRAINT addresses_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: admin_actions admin_actions_admin_id_admin_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_actions
    ADD CONSTRAINT admin_actions_admin_id_admin_users_id_fk FOREIGN KEY (admin_id) REFERENCES public.admin_users(id);


--
-- Name: alerts alerts_fleet_id_fleets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_fleet_id_fleets_id_fk FOREIGN KEY (fleet_id) REFERENCES public.fleets(id) ON DELETE CASCADE;


--
-- Name: booking_location_path booking_location_path_booking_id_bookings_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_location_path
    ADD CONSTRAINT booking_location_path_booking_id_bookings_id_fk FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: booking_status_history booking_status_history_booking_id_bookings_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_status_history
    ADD CONSTRAINT booking_status_history_booking_id_bookings_id_fk FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: bookings bookings_driver_id_drivers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_driver_id_drivers_id_fk FOREIGN KEY (driver_id) REFERENCES public.drivers(id);


--
-- Name: bookings bookings_fleet_id_fleets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_fleet_id_fleets_id_fk FOREIGN KEY (fleet_id) REFERENCES public.fleets(id);


--
-- Name: bookings bookings_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: bookings bookings_zone_id_service_zones_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_zone_id_service_zones_id_fk FOREIGN KEY (zone_id) REFERENCES public.service_zones(id);


--
-- Name: compliance_documents compliance_documents_truck_id_fleet_trucks_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_documents
    ADD CONSTRAINT compliance_documents_truck_id_fleet_trucks_id_fk FOREIGN KEY (truck_id) REFERENCES public.fleet_trucks(id) ON DELETE CASCADE;


--
-- Name: dispatch_attempts dispatch_attempts_booking_id_bookings_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispatch_attempts
    ADD CONSTRAINT dispatch_attempts_booking_id_bookings_id_fk FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: dispatch_attempts dispatch_attempts_driver_id_drivers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispatch_attempts
    ADD CONSTRAINT dispatch_attempts_driver_id_drivers_id_fk FOREIGN KEY (driver_id) REFERENCES public.drivers(id);


--
-- Name: driver_documents driver_documents_driver_id_drivers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_documents
    ADD CONSTRAINT driver_documents_driver_id_drivers_id_fk FOREIGN KEY (driver_id) REFERENCES public.drivers(id) ON DELETE CASCADE;


--
-- Name: driver_documents driver_documents_verified_by_admin_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_documents
    ADD CONSTRAINT driver_documents_verified_by_admin_users_id_fk FOREIGN KEY (verified_by) REFERENCES public.admin_users(id);


--
-- Name: drivers drivers_approved_by_admin_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_approved_by_admin_users_id_fk FOREIGN KEY (approved_by) REFERENCES public.admin_users(id);


--
-- Name: drivers drivers_assigned_truck_id_fleet_trucks_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_assigned_truck_id_fleet_trucks_id_fk FOREIGN KEY (assigned_truck_id) REFERENCES public.fleet_trucks(id) ON DELETE SET NULL;


--
-- Name: drivers drivers_fleet_id_fleets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_fleet_id_fleets_id_fk FOREIGN KEY (fleet_id) REFERENCES public.fleets(id) ON DELETE SET NULL;


--
-- Name: earnings_daily earnings_daily_driver_id_drivers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.earnings_daily
    ADD CONSTRAINT earnings_daily_driver_id_drivers_id_fk FOREIGN KEY (driver_id) REFERENCES public.drivers(id) ON DELETE CASCADE;


--
-- Name: earnings_daily earnings_daily_fleet_id_fleets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.earnings_daily
    ADD CONSTRAINT earnings_daily_fleet_id_fleets_id_fk FOREIGN KEY (fleet_id) REFERENCES public.fleets(id) ON DELETE CASCADE;


--
-- Name: emergency_contacts emergency_contacts_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emergency_contacts
    ADD CONSTRAINT emergency_contacts_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: fleet_driver_shares fleet_driver_shares_driver_id_drivers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fleet_driver_shares
    ADD CONSTRAINT fleet_driver_shares_driver_id_drivers_id_fk FOREIGN KEY (driver_id) REFERENCES public.drivers(id) ON DELETE CASCADE;


--
-- Name: fleet_driver_shares fleet_driver_shares_fleet_id_fleets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fleet_driver_shares
    ADD CONSTRAINT fleet_driver_shares_fleet_id_fleets_id_fk FOREIGN KEY (fleet_id) REFERENCES public.fleets(id) ON DELETE CASCADE;


--
-- Name: fleet_owner_credentials fleet_owner_credentials_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fleet_owner_credentials
    ADD CONSTRAINT fleet_owner_credentials_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: fleet_trucks fleet_trucks_fleet_id_fleets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fleet_trucks
    ADD CONSTRAINT fleet_trucks_fleet_id_fleets_id_fk FOREIGN KEY (fleet_id) REFERENCES public.fleets(id) ON DELETE CASCADE;


--
-- Name: fleets fleets_owner_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fleets
    ADD CONSTRAINT fleets_owner_id_users_id_fk FOREIGN KEY (owner_id) REFERENCES public.users(id);


--
-- Name: payments payments_booking_id_bookings_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_booking_id_bookings_id_fk FOREIGN KEY (booking_id) REFERENCES public.bookings(id);


--
-- Name: refunds refunds_booking_id_bookings_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_booking_id_bookings_id_fk FOREIGN KEY (booking_id) REFERENCES public.bookings(id);


--
-- Name: saved_vehicles saved_vehicles_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_vehicles
    ADD CONSTRAINT saved_vehicles_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: truck_imports truck_imports_fleet_id_fleets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.truck_imports
    ADD CONSTRAINT truck_imports_fleet_id_fleets_id_fk FOREIGN KEY (fleet_id) REFERENCES public.fleets(id) ON DELETE CASCADE;


--
-- Name: wallet_transactions wallet_transactions_wallet_id_wallets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_transactions
    ADD CONSTRAINT wallet_transactions_wallet_id_wallets_id_fk FOREIGN KEY (wallet_id) REFERENCES public.wallets(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


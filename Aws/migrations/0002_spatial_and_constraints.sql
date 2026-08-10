-- Indexes and constraints drizzle-kit cannot express in the schema DSL.

--------------------------------------------------------------------------------
-- Spatial (GIST). These carry the progressive-radius nearest-driver search
-- (§6.2/§6.4) and the zone point-in-polygon check (§6.10). Without them every
-- dispatch wave degrades to a sequential scan.
--------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "idx_drivers_geo"
  ON "drivers" USING GIST ("current_location");

CREATE INDEX IF NOT EXISTS "idx_fleet_trucks_geo"
  ON "fleet_trucks" USING GIST ("current_location");

CREATE INDEX IF NOT EXISTS "idx_service_zones_geo"
  ON "service_zones" USING GIST ("area");

--------------------------------------------------------------------------------
-- Compliance expiry board (§9.3). Only non-expired docs are ever queried for
-- the "expiring within 30 days" widget, so a partial index keeps it small and
-- stops historical rows from bloating it as the fleet ages.
--------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "idx_compliance_documents_active_expiry"
  ON "compliance_documents" ("expires_at")
  WHERE "status" <> 'expired' AND "expires_at" IS NOT NULL;

--------------------------------------------------------------------------------
-- fleet_driver_shares.driver_id → drivers.id. Declared here rather than in the
-- schema DSL because fleets.ts and drivers.ts would otherwise import each other.
--------------------------------------------------------------------------------
ALTER TABLE "fleet_driver_shares"
  ADD CONSTRAINT "fleet_driver_shares_driver_id_drivers_id_fk"
  FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE;

-- A driver has exactly one share row per fleet.
ALTER TABLE "fleet_driver_shares"
  ADD CONSTRAINT "uq_fleet_driver_shares_pair" UNIQUE ("fleet_id", "driver_id");

--------------------------------------------------------------------------------
-- Money integrity (§3.4). These are the invariants that must hold even if
-- application code is wrong, so they live in the database.
--------------------------------------------------------------------------------

-- The driver/fleet split of the post-commission pool must account for all of it.
ALTER TABLE "fleet_driver_shares"
  ADD CONSTRAINT "ck_fleet_driver_shares_sum_100"
  CHECK ("driver_share" + "fleet_share" = 100);

-- §3.3 guardrail: commission is admin-tunable but only within 5–10%.
ALTER TABLE "bookings"
  ADD CONSTRAINT "ck_bookings_commission_pct_guardrail"
  CHECK ("commission_pct" IS NULL OR ("commission_pct" >= 5 AND "commission_pct" <= 10));

-- Fares and their derived amounts are never negative.
ALTER TABLE "bookings"
  ADD CONSTRAINT "ck_bookings_non_negative"
  CHECK ("total" >= 0 AND "commission_amount" >= 0 AND "driver_payout" >= 0 AND "discount" >= 0);

-- Commission plus payout can never exceed what the customer was charged.
ALTER TABLE "bookings"
  ADD CONSTRAINT "ck_bookings_payout_within_total"
  CHECK ("commission_amount" + "driver_payout" <= "total");

ALTER TABLE "payments" ADD CONSTRAINT "ck_payments_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "payouts"  ADD CONSTRAINT "ck_payouts_amount_positive"  CHECK ("amount" > 0);
ALTER TABLE "refunds"  ADD CONSTRAINT "ck_refunds_amount_positive"  CHECK ("amount" > 0);

-- A ledger entry of zero is always a bug; the sign carries credit vs debit.
ALTER TABLE "wallet_transactions"
  ADD CONSTRAINT "ck_wallet_transactions_amount_nonzero" CHECK ("amount" <> 0);

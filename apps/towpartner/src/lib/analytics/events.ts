/**
 * §22.1 — the input to every launch-cohort KPI (activation %, fill rate,
 * repeat-booking rate...). Events not emitted at launch cannot be recovered
 * for the launch cohort, which is why this exists now even though most rows
 * below aren't emitted until a later phase installs the feature that fires
 * them. Phase 12 emits exactly `app_open`/`signup_start`/`signup_complete`;
 * the rest are named here so each later phase has a stable event name to
 * emit into, not something it invents ad hoc.
 */
export interface AnalyticsEventMap {
  app_open: Record<string, never>;
  signup_start: Record<string, never>;
  signup_complete: Record<string, never>;
  // Driver-side events named by the spec for later phases to emit into —
  // Phase 12 (KYC): kyc_submit
  // Phase 16 (going online / offers): driver_online, offer_accepted, offer_declined
  // Phase 17 (jobs): job_started, job_completed
  // Phase 19 (payouts): payout_requested
}

export type AnalyticsEventName = keyof AnalyticsEventMap;

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
  // Customer-side events named by the spec for later phases to emit into —
  // Phase 15: service_selected, estimate_viewed, booking_confirmed
  // Phase 18: trip_shared
  // Phase 19: payment_success, payment_failure, booking_cancelled, booking_completed
  // Phase 20: sos_triggered
}

export type AnalyticsEventName = keyof AnalyticsEventMap;

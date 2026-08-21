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
  /** Phase 13 — the OS permission answer, so prompt-accept rate is measurable from day one. */
  push_permission_granted: Record<string, never>;
  push_permission_denied: Record<string, never>;
  /** Phase 13 — the bell was opened. Distinguishes notified from noticed. */
  notification_opened: Record<string, never>;
  /**
   * Phase 14 — the §9.1.5 funnel's first two steps.
   *
   * `service_selected` fires when the customer picks a catalogue entry;
   * `estimate_viewed` when a FARE LANDS, not when the screen mounts, so it
   * measures quotes seen rather than screens opened. Together with
   * `booking_confirmed` (Phase 15) they are the drop-off funnel behind §2.5's
   * booking-conversion KPI — and §22.1's rule is that an event not emitted at
   * launch cannot be recovered for the launch cohort.
   */
  service_selected: { slug: string };
  estimate_viewed: Record<string, never>;
  /**
   * Phase 15 — the §9.1.5 funnel's last step. Fires on a CONFIRMED booking, so
   * `estimate_viewed → booking_confirmed` is the conversion rate §2.5 asks for.
   */
  booking_confirmed: Record<string, never>;
  // Customer-side events named by the spec for later phases to emit into —
  // Phase 18: trip_shared
  // Phase 19: payment_success, payment_failure, booking_cancelled, booking_completed
  // Phase 20: sos_triggered
}

export type AnalyticsEventName = keyof AnalyticsEventMap;

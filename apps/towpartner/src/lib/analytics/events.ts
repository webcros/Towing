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
   * Phase 16 — §22.1's supply-side activation signals.
   *
   * `driver_first_online` fires ONCE per install, at the moment a driver first
   * becomes real supply. It is the denominator of every activation-rate number
   * for the launch cohort and cannot be reconstructed afterwards: the closest
   * proxy, "first booking assigned", excludes everyone who went online and never
   * matched — which is exactly the cohort a supply problem lives in.
   */
  driver_first_online: Record<string, never>;
  /** Every subsequent go-online. Shift starts, i.e. supply over time. */
  driver_online: Record<string, never>;
  /**
   * Phase 17 — §22.1's offer funnel, from the handset's side.
   *
   * `offer_shown` IS NOT REDUNDANT WITH THE SERVER'S `dispatch_attempts` ROW,
   * which is the whole reason it exists. The server knows it emitted an offer;
   * it cannot know whether the frame arrived, whether the push was suppressed by
   * Doze, or whether the takeover ever reached a screen. A driver who "never got
   * any offers" and a driver who ignored twelve of them look identical in the
   * database and completely different here — and the gap between this count and
   * the server's is the delivery-failure rate, which nothing else measures.
   */
  offer_shown: { wave: number; secondsLeft: number };
  offer_accepted: { wave: number; secondsLeft: number };
  offer_declined: { wave: number; secondsLeft: number };
  // Driver-side events named by the spec for later phases to emit into —
  // Phase 12 (KYC): kyc_submit
  // Phase 18 (jobs): job_started, job_completed
  // Phase 19 (payouts): payout_requested
}

export type AnalyticsEventName = keyof AnalyticsEventMap;

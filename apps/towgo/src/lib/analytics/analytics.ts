import type { AnalyticsEventMap, AnalyticsEventName } from './events';
import { ga4Adapter } from './ga4Adapter';
import { logAdapter } from './logAdapter';

export interface AnalyticsPort {
  track(event: AnalyticsEventName, props?: Record<string, unknown>): void;
}

/**
 * §22.1 analytics spine. Both adapters fire — the log line is always visible
 * in Metro/device logs for manual verification during development, and the
 * GA4 call is a no-op until real credentials exist (`ga4Adapter.ts`'s own
 * empty-env-var guard). Never throws; a broken analytics call must not break
 * the feature it's instrumenting.
 */
export function track<E extends AnalyticsEventName>(
  event: E,
  props?: AnalyticsEventMap[E],
): void {
  try {
    logAdapter.track(event, props);
    ga4Adapter.track(event, props);
  } catch {
    // Analytics must never surface an error to the caller.
  }
}

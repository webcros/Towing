import type { AnalyticsPort } from './analytics';

/** The permanent local-dev path — same standing as the backend's `LogNotificationAdapter`/`DevOtpAdapter`. */
export const logAdapter: AnalyticsPort = {
  track(event, props) {
    console.log(`[analytics] ${event}`, props ?? {});
  },
};

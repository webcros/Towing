import { randomUUID } from 'expo-crypto';
import { env } from '@/lib/env';
import { storage } from '@/lib/storage/storage';
import type { AnalyticsPort } from './analytics';

const CLIENT_ID_KEY = 'analytics.ga4ClientId';

/** A stable per-install id, generated once and persisted — GA4 attributes events to it, not to a session. */
function clientId(): string {
  const existing = storage.getString(CLIENT_ID_KEY);
  if (existing) return existing;
  const generated = randomUUID();
  storage.set(CLIENT_ID_KEY, generated);
  return generated;
}

/**
 * GA4 Measurement Protocol — a plain `fetch` POST, no SDK, no native module.
 * Deliberately not `@react-native-firebase/analytics`: that pulls in a heavy
 * native SDK needing `google-services.json`/`GoogleService-Info.plist` (its
 * own external-account + native-rebuild cost) for 3 events this phase emits.
 * Same reasoning `ToBeDoneEhsan.md` already applies to Sentry.
 *
 * Fire-and-forget: an analytics call must never block or fail a user action.
 */
export const ga4Adapter: AnalyticsPort = {
  track(event, props) {
    if (!env.ga4MeasurementId || !env.ga4ApiSecret) return;

    const url = `https://www.google-analytics.com/mp/collect?measurement_id=${env.ga4MeasurementId}&api_secret=${env.ga4ApiSecret}`;
    fetch(url, {
      method: 'POST',
      body: JSON.stringify({
        client_id: clientId(),
        events: [{ name: event, params: props ?? {} }],
      }),
    }).catch(() => {});
  },
};

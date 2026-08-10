import { jsonb, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { primaryId } from './columns';

/**
 * Inbound vendor webhooks (§19.3: "signature-verified, idempotent, **and
 * replayable**").
 *
 * The unique `(provider, event_id)` is what makes delivery-at-least-once safe:
 * a redelivered event inserts zero rows and the handler returns 200 without
 * re-applying the transition. Razorpay retries on any non-2xx, so a duplicate
 * must be a cheap 200 and never a 409.
 *
 * Storing the raw payload is what makes "replayable" true — a status can be
 * re-derived without asking the vendor again, and it is the audit trail when a
 * payout outcome is disputed. `error` records why a delivery could not be
 * applied (typically: no payout matches the reference yet), which is exactly the
 * case the 5-minute reconciliation poll then resolves.
 *
 * No `updated_at`: a webhook event is a fact that happened, not a mutable row.
 */
export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: primaryId(),
    provider: text('provider').notNull(),
    /** The vendor's own event id — the dedup key, not ours. */
    eventId: text('event_id').notNull(),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    error: text('error'),
  },
  (t) => [unique('uq_webhook_events_provider_event').on(t.provider, t.eventId)],
);

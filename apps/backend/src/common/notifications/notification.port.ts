import type { NotificationChannel } from '@towing/api-contracts';
import type { ChannelResult, ChannelSendParams } from './channel.port';

export type { NotificationChannel };

/**
 * The outbound seam (§12). ONE implementation —
 * `NotificationRouterAdapter` — which dispatches to the four `ChannelPort`s.
 *
 * ⚠ NOTHING OUTSIDE `src/common/notifications/**` MAY INJECT THIS.
 *
 * Before Phase 13 four domain services called `notify()` directly with a
 * hand-assembled `to`, and two of them passed a UUID into a field documented as
 * "E.164 phone or email address" (`compliance.service.ts` passed a fleet id,
 * `payouts.service.ts` an owner id). That was harmless against the log adapter
 * and silent non-delivery the instant a real one bound.
 *
 * Producers now call `NotificationService.emit(event, payload)` with DOMAIN
 * IDS, and a trigger's `resolve()` is the only thing in the system that turns a
 * subject into an address. `notification-port-usage.spec.ts` fails the build on
 * any import of `NOTIFICATIONS` outside this directory, which is what makes
 * invariant 69 enforceable rather than aspirational.
 */
export interface NotificationPort {
  notify(channel: NotificationChannel, params: ChannelSendParams): Promise<ChannelResult>;
}

export const NOTIFICATIONS = Symbol('NOTIFICATIONS');

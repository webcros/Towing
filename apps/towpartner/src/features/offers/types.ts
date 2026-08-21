import type { JobEarnings, JobOffer as WireJobOffer } from '@towing/api-contracts';

/**
 * §6.3's offer, as the app sees it.
 *
 * IT IS THE CONTRACT TYPE NOW, not a local invention. Until Phase 17 this file
 * declared its own `JobOffer` with `minutesAway`, a single `fare` number and a
 * relative `expiresInSeconds` — a shape derived from the Figma card rather than
 * from anything a server could send. Two of those three were actively wrong:
 *
 *  - `fare` was the GROSS. A driver reading it was over-estimating their
 *    earnings by the commission on every offer (§9.2.2 asks for the net).
 *  - `expiresInSeconds` is relative, so a lagging client extends its own
 *    countdown and two drivers end up believing they hold the same booking.
 *    The server sends an absolute instant on its own clock.
 *
 * The display fields the card still needs and the server does not send —
 * vehicle description, plate, payment method — are additive and optional, so
 * mock mode can keep showing the full Figma card while the real payload stays
 * honest about what it actually knows.
 */
export type JobOffer = WireJobOffer & {
  /** Figma's vehicle line. Absent from the wire until a booking carries a saved vehicle. */
  vehicleName?: string;
  vehicleColor?: string;
  vehiclePlate?: string;
  /** §14's payment method, once Phase 19 puts one on the booking. */
  payment?: 'online';
  /** Human label for the service, e.g. "Flatbed Tow". */
  towTypeLabel?: string;
};

export type { JobEarnings };

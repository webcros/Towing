import type { PricingEstimateRequest } from '@towing/api-contracts';

/**
 * Query key factory for `POST /v1/pricing/estimate`.
 *
 * The whole request is part of the key: an estimate is a pure function of
 * (service, class, pickup, drop, time), and §9.1.5 re-quotes when the pin moves.
 * Coordinates are rounded to ~11 m so a one-pixel map drag does not evict a
 * perfectly good quote and flash the skeleton back at the customer.
 */
export const pricingKeys = {
  all: ['pricing'] as const,
  estimate: (input: PricingEstimateRequest | undefined) =>
    [
      'pricing',
      'estimate',
      input?.serviceSlug ?? null,
      input?.vehicleClass ?? null,
      round(input?.pickup.lat),
      round(input?.pickup.lng),
      round(input?.drop?.lat),
      round(input?.drop?.lng),
      input?.scheduledAt ?? null,
    ] as const,
};

function round(value: number | undefined): number | null {
  return value === undefined ? null : Math.round(value * 10_000) / 10_000;
}

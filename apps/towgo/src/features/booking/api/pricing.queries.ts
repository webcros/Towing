import { useQuery } from '@tanstack/react-query';
import type { PricingEstimateRequest } from '@towing/api-contracts';
import { pricingDataSource } from './pricingDataSource';
import { pricingKeys } from './pricing.keys';

/**
 * The §9.1.5 step-3 fare estimate.
 *
 * A QUERY, NOT A MUTATION, despite riding a POST. It is idempotent, it is
 * re-run whenever the pin or the service changes, and §9.1.5 wants it cached
 * across a back-and-forward through the flow — all of which are query
 * behaviours. The verb is a POST only because two coordinate pairs do not
 * belong in a query string.
 *
 * `enabled` is what implements "no drop needed": a roadside service quotes with
 * a pickup alone, a tow waits for its destination rather than firing a request
 * that would 422.
 */
export function useFareEstimate(input: PricingEstimateRequest | undefined, requiresDrop: boolean) {
  return useQuery({
    queryKey: pricingKeys.estimate(input),
    queryFn: () => pricingDataSource.estimate(input!),
    enabled: Boolean(input) && (!requiresDrop || Boolean(input?.drop)),
    // §7.6: "fare locks when you confirm; may change with demand until then."
    // A stale quote shown as current is the thing that sentence promises not to
    // do, so this is short.
    staleTime: 60 * 1000,
    retry: 1,
  });
}

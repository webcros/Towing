import type { PricingEstimateRequest, PricingEstimateResponse } from '@towing/api-contracts';
import { env } from '@/lib/env';
import { pricingMockSource } from './pricingMockSource';
import { pricingRestSource } from './pricingRestSource';

/** `POST /v1/pricing/estimate` (§7.6) — breakdown + band + ETA in ≤ 2 s. */
export interface PricingDataSource {
  estimate(input: PricingEstimateRequest): Promise<PricingEstimateResponse>;
}

export const pricingDataSource: PricingDataSource = env.useMocks
  ? pricingMockSource
  : pricingRestSource;

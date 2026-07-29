import type { EarningsData, EarningsPeriod } from '../types';
import { earningsMockSource } from './earningsMockSource';

/**
 * Boundary between UI and backend. Mock now; a REST implementation swaps in
 * later (selected by env.useMocks) with no change to query hooks or components.
 */
export interface EarningsDataSource {
  getEarnings(period: EarningsPeriod): Promise<EarningsData>;
}

export const earningsDataSource: EarningsDataSource = earningsMockSource;

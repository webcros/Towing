import { env } from '@/lib/env';
import type { EarningsDataSource } from './earningsDataSource';
import type { EarningsData, EarningsPeriod } from '../types';
import { earningsByPeriod } from '../mocks/earnings.mock';

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Mock earnings with realistic latency. `EXPO_PUBLIC_MOCK_EARNINGS_STATE`
 * forces error so the §10.9 state can be exercised without a backend.
 */
export const earningsMockSource: EarningsDataSource = {
  async getEarnings(period: EarningsPeriod): Promise<EarningsData> {
    await delay(600);
    if (env.mockEarningsState === 'error') {
      throw new Error('Failed to load earnings');
    }
    return earningsByPeriod[period];
  },
};

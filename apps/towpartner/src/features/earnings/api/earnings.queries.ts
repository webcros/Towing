import { useQuery } from '@tanstack/react-query';
import { earningsDataSource } from './earningsDataSource';
import { earningsKeys } from './earnings.keys';
import type { EarningsPeriod } from '../types';

/** Earnings summary, trend and transactions for a period (Figma "Earnings"). */
export function useEarnings(period: EarningsPeriod) {
  return useQuery({
    queryKey: earningsKeys.byPeriod(period),
    queryFn: () => earningsDataSource.getEarnings(period),
  });
}

import type { EarningsPeriod } from '../types';

export const earningsKeys = {
  all: ['earnings'] as const,
  byPeriod: (period: EarningsPeriod) => ['earnings', period] as const,
};

/** Which window the earnings screen is showing. */
export type EarningsPeriod = 'week' | 'month' | 'lastMonth' | 'custom';

export type EarningsSummary = {
  total: number;
  /** Change vs the previous comparable window, e.g. +12.5. */
  deltaPercent: number;
  jobsCompleted: number;
  avgPerJob: number;
  bonus: number;
};

/** One point on the earnings trend chart. */
export type EarningsPoint = {
  /** Short axis label, e.g. "12 May". */
  label: string;
  value: number;
};

export type TransactionKind = 'job' | 'bonus';

export type Transaction = {
  id: string;
  title: string;
  dateTimeLabel: string;
  amount: number;
  kind: TransactionKind;
  /** e.g. "Completed" / "Bonus Credited". */
  statusLabel: string;
};

export type EarningsData = {
  summary: EarningsSummary;
  trend: EarningsPoint[];
  transactions: Transaction[];
};

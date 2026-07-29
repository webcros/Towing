import type { EarningsData, EarningsPeriod } from '../types';

const weekTransactions: EarningsData['transactions'] = [
  {
    id: 't1',
    title: 'Maruti Swift',
    dateTimeLabel: '18 May, 10:30 AM',
    amount: 850,
    kind: 'job',
    statusLabel: 'Completed',
  },
  {
    id: 't2',
    title: 'Hyundai i20',
    dateTimeLabel: '17 May, 09:15 AM',
    amount: 1200,
    kind: 'job',
    statusLabel: 'Completed',
  },
  {
    id: 't3',
    title: 'Honda City',
    dateTimeLabel: '16 May, 10:30 AM',
    amount: 750,
    kind: 'job',
    statusLabel: 'Completed',
  },
  {
    id: 't4',
    title: 'Weekly Bonus',
    dateTimeLabel: '16 May, 12:00 AM',
    amount: 480,
    kind: 'bonus',
    statusLabel: 'Bonus Credited',
  },
];

/** Earnings seed per period (Figma driver "Earnings" — default is This Week). */
export const earningsByPeriod: Record<EarningsPeriod, EarningsData> = {
  week: {
    summary: { total: 6480, deltaPercent: 12.5, jobsCompleted: 8, avgPerJob: 810, bonus: 480 },
    trend: [
      { label: '12 May', value: 1250 },
      { label: '13 May', value: 1680 },
      { label: '14 May', value: 1020 },
      { label: '15 May', value: 1850 },
      { label: '16 May', value: 2680 },
      { label: '17 May', value: 2480 },
      { label: '18 May', value: 2680 },
    ],
    transactions: weekTransactions,
  },
  month: {
    summary: { total: 27340, deltaPercent: 8.2, jobsCompleted: 34, avgPerJob: 804, bonus: 1800 },
    trend: [
      { label: 'Wk 1', value: 5820 },
      { label: 'Wk 2', value: 6410 },
      { label: 'Wk 3', value: 8630 },
      { label: 'Wk 4', value: 6480 },
    ],
    transactions: weekTransactions,
  },
  lastMonth: {
    summary: { total: 25280, deltaPercent: -3.4, jobsCompleted: 31, avgPerJob: 815, bonus: 1500 },
    trend: [
      { label: 'Wk 1', value: 6120 },
      { label: 'Wk 2', value: 7040 },
      { label: 'Wk 3', value: 6210 },
      { label: 'Wk 4', value: 5910 },
    ],
    transactions: weekTransactions,
  },
  custom: {
    summary: { total: 6480, deltaPercent: 12.5, jobsCompleted: 8, avgPerJob: 810, bonus: 480 },
    trend: [
      { label: '12 May', value: 1250 },
      { label: '13 May', value: 1680 },
      { label: '14 May', value: 1020 },
      { label: '15 May', value: 1850 },
      { label: '16 May', value: 2680 },
      { label: '17 May', value: 2480 },
      { label: '18 May', value: 2680 },
    ],
    transactions: weekTransactions,
  },
};

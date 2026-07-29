import type { JobStatus } from '@/features/jobs/types';

/** Today's headline numbers on the driver dashboard. */
export type DriverSummary = {
  jobsCompleted: number;
  earnings: number;
  rating: number;
};

/** A compact recent-activity entry (subset of a full Job). */
export type RecentJob = {
  id: string;
  vehicleName: string;
  pickup: string;
  drop: string;
  fare: number;
  status: JobStatus;
};

export type DashboardData = {
  /** First name for the greeting, e.g. "Rahul". */
  driverName: string;
  summary: DriverSummary;
  recentActivity: RecentJob[];
};

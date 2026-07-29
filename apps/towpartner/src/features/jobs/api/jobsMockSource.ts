import { env } from '@/lib/env';
import type { JobsDataSource } from './jobsDataSource';
import type { Job, JobFilter } from '../types';
import { jobsMock } from '../mocks/jobs.mock';

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function applyFilter(jobs: Job[], filter: JobFilter): Job[] {
  if (filter === 'all') return jobs;
  return jobs.filter((j) => j.status === filter);
}

/**
 * Mock jobs with realistic latency. `EXPO_PUBLIC_MOCK_JOBS_STATE` forces
 * empty/error so the §10.9 states can be exercised without a backend.
 */
export const jobsMockSource: JobsDataSource = {
  async getJobs(filter: JobFilter): Promise<Job[]> {
    await delay(650);
    if (env.mockJobsState === 'error') {
      throw new Error('Failed to load jobs');
    }
    if (env.mockJobsState === 'empty') {
      return [];
    }
    return applyFilter(jobsMock, filter);
  },
};

import type { Job, JobFilter } from '../types';
import { jobsMockSource } from './jobsMockSource';

/**
 * Boundary between UI and backend. Mock now; a REST implementation swaps in
 * later (selected by env.useMocks) with no change to query hooks or components.
 */
export interface JobsDataSource {
  getJobs(filter: JobFilter): Promise<Job[]>;
}

export const jobsDataSource: JobsDataSource = jobsMockSource;

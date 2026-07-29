import { useQuery } from '@tanstack/react-query';
import { jobsDataSource } from './jobsDataSource';
import { jobsKeys } from './jobs.keys';
import type { JobFilter } from '../types';

/** Job history, optionally filtered by status (Figma driver "Jobs"). */
export function useJobs(filter: JobFilter) {
  return useQuery({
    queryKey: jobsKeys.list(filter),
    queryFn: () => jobsDataSource.getJobs(filter),
  });
}

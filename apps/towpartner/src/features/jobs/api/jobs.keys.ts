import type { JobFilter } from '../types';

export const jobsKeys = {
  all: ['jobs'] as const,
  list: (filter: JobFilter) => ['jobs', 'list', filter] as const,
  detail: (jobId: string) => ['jobs', 'detail', jobId] as const,
};

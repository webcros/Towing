import { useQuery } from '@tanstack/react-query';
import { dashboardDataSource } from './dashboardDataSource';
import { dashboardKeys } from './dashboard.keys';

/** Driver dashboard: greeting, today's summary, recent activity. */
export function useDashboard() {
  return useQuery({
    queryKey: dashboardKeys.summary(),
    queryFn: () => dashboardDataSource.getDashboard(),
  });
}

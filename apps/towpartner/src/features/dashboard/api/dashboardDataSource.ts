import type { DashboardData } from '../types';
import { dashboardMockSource } from './dashboardMockSource';

/**
 * Boundary between UI and backend. Mock now; a REST implementation swaps in
 * later (selected by env.useMocks) with no change to query hooks or components.
 */
export interface DashboardDataSource {
  getDashboard(): Promise<DashboardData>;
}

export const dashboardDataSource: DashboardDataSource = dashboardMockSource;

import { env } from '@/lib/env';
import type { DashboardDataSource } from './dashboardDataSource';
import type { DashboardData } from '../types';
import { dashboardMock } from '../mocks/dashboard.mock';

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Mock dashboard with realistic latency. `EXPO_PUBLIC_MOCK_DASHBOARD_STATE`
 * forces error so the §10.9 state can be exercised without a backend.
 */
export const dashboardMockSource: DashboardDataSource = {
  async getDashboard(): Promise<DashboardData> {
    await delay(600);
    if (env.mockDashboardState === 'error') {
      throw new Error('Failed to load dashboard');
    }
    return dashboardMock;
  },
};

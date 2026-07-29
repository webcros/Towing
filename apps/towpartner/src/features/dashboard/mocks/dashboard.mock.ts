import type { DashboardData } from '../types';

/** Driver dashboard seed (Figma driver "Home"). */
export const dashboardMock: DashboardData = {
  driverName: 'Rahul',
  summary: {
    jobsCompleted: 8,
    earnings: 6480,
    rating: 4.8,
  },
  recentActivity: [
    {
      id: 'a1',
      vehicleName: 'Maruti Swift',
      pickup: 'Palam, Delhi',
      drop: 'Dwarka, Delhi',
      fare: 850,
      status: 'completed',
    },
    {
      id: 'a2',
      vehicleName: 'Hyundai i20',
      pickup: 'Gurgaon Sector 45',
      drop: 'Sector 29, Gurgaon',
      fare: 1200,
      status: 'completed',
    },
    {
      id: 'a3',
      vehicleName: 'Tata Nexon',
      pickup: 'Janakpuri, Delhi',
      drop: 'Mukherjee Nagar, Delhi',
      fare: 950,
      status: 'cancelled',
    },
  ],
};

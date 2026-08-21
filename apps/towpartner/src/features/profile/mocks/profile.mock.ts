import type { DriverProfile } from '../types';

/** Driver profile seed (Figma driver "Profile"). */
export const profileMock: DriverProfile = {
  name: 'Rahul Sharma',
  driverId: 'DRV12345',
  verified: true,
  phone: '+91 9876543210',
  email: 'rahul.sharma@gmail.com',
  // No uploaded photo — ProfileHeaderCard renders its bundled placeholder.
  avatar: null,
  stats: {
    jobsCompleted: 128,
    rating: 4.8,
    experienceLabel: '1.5 yrs',
    completionPercent: 100,
  },
};

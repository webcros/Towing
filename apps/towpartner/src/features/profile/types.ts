import type { ImageSourcePropType } from 'react-native';

export type DriverProfileStats = {
  jobsCompleted: number;
  rating: number;
  /** e.g. "1.5 yrs". */
  experienceLabel: string;
  completionPercent: number;
};

export type DriverProfile = {
  name: string;
  /** Public partner id, e.g. "DRV12345". */
  driverId: string;
  verified: boolean;
  phone: string;
  email: string;
  avatar: ImageSourcePropType;
  stats: DriverProfileStats;
};

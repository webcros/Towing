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
  /**
   * A signed-GET URL from the server, or `null` when the driver has no photo —
   * never a bundled `require()` asset. The placeholder illustration is a
   * rendering fallback (`ProfileHeaderCard`), not a value the API can return.
   */
  avatar: string | null;
  stats: DriverProfileStats;
};

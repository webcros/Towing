/** Outcome of a job — drives the status pill (see JOB_STATUS_META). */
export type JobStatus = 'completed' | 'cancelled' | 'assigned';

/** How the customer paid. */
export type JobPayment = 'cash' | 'online';

/** Segmented filter on the Jobs screen. */
export type JobFilter = 'all' | 'assigned' | 'completed' | 'cancelled';

export type Job = {
  id: string;
  /** e.g. "Honda City". */
  vehicleName: string;
  /** Pickup area label. */
  pickup: string;
  /** Drop-off area label. */
  drop: string;
  fare: number;
  payment: JobPayment;
  status: JobStatus;
  /** Derived tow-type label, e.g. "Car Tow" / "SUV Tow". */
  towTypeLabel: string;
  distanceKm: number;
  /** Preformatted, e.g. "12 May, 10:30 AM". */
  dateTimeLabel: string;
};

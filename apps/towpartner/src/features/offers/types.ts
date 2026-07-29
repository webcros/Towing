import type { JobPayment } from '@/features/jobs/types';

/** An incoming tow request the driver can accept or decline (Figma "New Job"). */
export type JobOffer = {
  id: string;
  /** Distance to pickup, in minutes. */
  minutesAway: number;
  fare: number;
  payment: JobPayment;
  vehicleName: string;
  pickup: string;
  drop: string;
  towTypeLabel: string;
  distanceKm: number;
  /** Countdown to auto-decline, in seconds. */
  expiresInSeconds: number;
  /** Vehicle colour, e.g. "White". */
  vehicleColor: string;
  vehiclePlate: string;
  customerNote: string;
};

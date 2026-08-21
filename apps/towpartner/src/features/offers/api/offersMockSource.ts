import type { DriverJob } from '@towing/api-contracts';
import { env } from '@/lib/env';
import type { OffersDataSource } from './offersDataSource';
import type { JobOffer } from '../types';
import { buildOfferMock } from '../mocks/offer.mock';

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Survives an accept so the assigned-job screen has something to show. */
let acceptedJob: DriverJob | null = null;
let declined = false;

/**
 * Mock offer lifecycle. `EXPO_PUBLIC_MOCK_OFFER_STATE=none` returns no request
 * so the empty state can be previewed without a backend.
 */
export const offersMockSource: OffersDataSource = {
  async getCurrentOffer(): Promise<JobOffer | null> {
    await delay(500);
    if (env.mockOfferState === 'none' || declined || acceptedJob) return null;
    // Rebuilt per call so `expiresAt` is always ~20s out — a fixed instant would
    // hand the takeover screen an offer that expired at build time.
    return buildOfferMock();
  },

  async getCurrentJob(): Promise<DriverJob | null> {
    await delay(300);
    return acceptedJob;
  },

  async accept(bookingId: string): Promise<DriverJob> {
    await delay(500);
    const offer = buildOfferMock();
    acceptedJob = {
      bookingId,
      reference: offer.reference,
      status: 'assigned',
      serviceType: offer.serviceType,
      vehicleClass: offer.vehicleClass,
      earnings: offer.earnings,
      pickup: offer.pickup,
      pickupAddress: offer.pickupAddress,
      drop: offer.drop,
      dropAddress: offer.dropAddress,
      distanceKm: offer.distanceKm,
      customerName: offer.customerName,
      customerMobile: '+919845020100',
      customerRating: offer.customerRating,
      note: offer.note,
      otpPending: true,
      assignedAt: new Date().toISOString(),
    };
    return acceptedJob;
  },

  async reject(): Promise<void> {
    await delay(250);
    declined = true;
  },
};

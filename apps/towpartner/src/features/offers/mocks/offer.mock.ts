import type { JobOffer } from '../types';

/** The incoming request shown on the New Job screen (Figma driver "New Job"). */
export const offerMock: JobOffer = {
  id: 'o1',
  minutesAway: 12,
  fare: 850,
  payment: 'cash',
  vehicleName: 'Maruti Swift',
  pickup: 'Palam, Delhi',
  drop: 'Dwarka, Delhi',
  towTypeLabel: 'Car Tow',
  distanceKm: 12.4,
  expiresInSeconds: 165,
  vehicleColor: 'White',
  vehiclePlate: 'DL 4C AB 1234',
  customerNote: 'Car not starting. Need towing to Dwarka workshop.',
};

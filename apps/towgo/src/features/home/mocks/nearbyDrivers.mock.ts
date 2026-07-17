import type { NearbyDriver } from '../types';

// Featured driver (index 0) mirrors the Figma design.
export const nearbyDriversMock: NearbyDriver[] = [
  {
    id: 'd1',
    name: 'Rajesh Kumar',
    vehiclePlate: 'KA 01 AB 1234',
    rating: 4.8,
    etaMinutes: 10,
    vehicleClass: 'flatbed',
    coords: { latitude: 12.9752, longitude: 77.605 },
  },
  {
    id: 'd2',
    name: 'Imran Sheikh',
    vehiclePlate: 'KA 05 CJ 8890',
    rating: 4.7,
    etaMinutes: 12,
    vehicleClass: 'wheel_lift',
    coords: { latitude: 12.9718, longitude: 77.6412 },
  },
  {
    id: 'd3',
    name: 'Suresh Patil',
    vehiclePlate: 'KA 03 MN 4521',
    rating: 4.9,
    etaMinutes: 8,
    vehicleClass: 'flatbed',
    coords: { latitude: 12.9806, longitude: 77.5996 },
  },
];

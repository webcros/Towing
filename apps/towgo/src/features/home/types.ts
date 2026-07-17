import type { LatLng } from '@/types/geo';

export type VehicleClass = 'wheel_lift' | 'flatbed';

export type NearbyDriver = {
  id: string;
  name: string;
  vehiclePlate: string;
  rating: number;
  etaMinutes: number;
  vehicleClass: VehicleClass;
  coords: LatLng;
};

export type QuickActionId = 'book' | 'schedule' | 'roadside' | 'support';

import type { LatLng } from '@/types/geo';

export type LocationStatus = 'idle' | 'locating' | 'ready' | 'denied';

export type PickupLocation = {
  label: string;
  coords?: LatLng;
};

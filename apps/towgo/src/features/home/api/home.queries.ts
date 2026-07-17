import { useQuery } from '@tanstack/react-query';
import type { LatLng } from '@/types/geo';
import { homeDataSource } from './homeDataSource';
import { homeKeys } from './home.keys';

/** Nearby tow trucks around the pickup point (spec §9.1.4). */
export function useNearbyDrivers(near: LatLng | undefined) {
  return useQuery({
    queryKey: homeKeys.nearbyDrivers(near?.latitude, near?.longitude),
    queryFn: () => homeDataSource.getNearbyDrivers(near!),
    enabled: !!near,
  });
}

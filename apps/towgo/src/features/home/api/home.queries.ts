import { useQuery } from '@tanstack/react-query';
import type { LatLng } from '@/types/geo';
import { homeDataSource } from './homeDataSource';
import { homeKeys } from './home.keys';

/**
 * §11.9's nearby supply, for the home screen's map.
 *
 * WRITTEN IN PHASE 12 AND NEVER CALLED until now — `HomeScreen` rendered a
 * placeholder map and no markers, so this hook sat unused for four phases. Phase
 * 16 gives it both halves it was missing: a real backend to ask, and a real map
 * to draw on.
 */
export function useNearbyDrivers(near: LatLng | undefined, radiusKm = 5) {
  return useQuery({
    queryKey: homeKeys.nearbyDrivers(near?.latitude, near?.longitude, radiusKm),
    queryFn: () => homeDataSource.getNearbyDrivers(near!, radiusKm),
    enabled: !!near,
    /**
     * 15s, matching the §6.1 stale-ping default: refreshing faster than supply
     * itself can change costs requests and moves nothing, and refreshing slower
     * would show the customer drivers the matcher has already excluded.
     */
    refetchInterval: 15_000,
    staleTime: 10_000,
    // Keeps the markers on screen while a pan's new query loads, so the map does
    // not empty and refill on every small movement.
    placeholderData: (previous) => previous,
  });
}

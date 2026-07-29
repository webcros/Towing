import { useCallback, useEffect, useRef, useState } from 'react';
import { env } from '@/lib/env';
import { nearbyDriversMock } from '@/features/home/mocks/nearbyDrivers.mock';
import type { NearbyDriver } from '@/features/home/types';

export type SearchPhase = 'searching' | 'widening' | 'matched' | 'no_drivers';

export type SearchState = {
  phase: SearchPhase;
  driversContacted: number;
  matchedDriver: NearbyDriver | null;
  retry: () => void;
};

/**
 * Simulates the progressive-radius dispatch (spec §6) until the backend exists:
 * pulse → widen → match (or no-drivers). Timers are cleared on unmount / retry.
 */
export function useSearchSimulation(): SearchState {
  const [phase, setPhase] = useState<SearchPhase>('searching');
  const [driversContacted, setDriversContacted] = useState(0);
  const [matchedDriver, setMatchedDriver] = useState<NearbyDriver | null>(null);
  const [runId, setRunId] = useState(0);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const retry = useCallback(() => {
    setPhase('searching');
    setDriversContacted(0);
    setMatchedDriver(null);
    setRunId((n) => n + 1);
  }, []);

  useEffect(() => {
    const noDrivers = env.mockSearchState === 'no_drivers';
    const t = timers.current;

    const contactAt = [900, 2100, 3600, 5200];
    contactAt.forEach((ms, i) => {
      t.push(setTimeout(() => setDriversContacted(i + 1), ms));
    });

    t.push(setTimeout(() => setPhase('widening'), 3000));
    t.push(
      setTimeout(() => {
        if (noDrivers) {
          setPhase('no_drivers');
        } else {
          setMatchedDriver(nearbyDriversMock[0] ?? null);
          setPhase('matched');
        }
      }, 6500),
    );

    return () => {
      t.forEach(clearTimeout);
      timers.current = [];
    };
  }, [runId]);

  return { phase, driversContacted, matchedDriver, retry };
}

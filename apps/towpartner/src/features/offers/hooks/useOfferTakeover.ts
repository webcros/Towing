import { useEffect, useRef } from 'react';
import { track } from '@/lib/analytics/analytics';
import { navigationRef } from '@/navigation/navigationRef';
import { useCurrentOffer } from '../api/offers.queries';

/**
 * Puts §6.3's offer on screen, wherever the driver happens to be.
 *
 * IT WATCHES THE CACHE, NOT THE SOCKET. There are three ways an offer reaches
 * this handset — a `job:offer` frame, the §19.2 poll, and a push tap — and each
 * of them writes the same query key. Driving the takeover from one of those
 * three would mean the other two silently did not take over; driving it from
 * what they all write means every rung produces the same screen, and the
 * `shownFor` guard means two rungs delivering the same offer produce it once.
 *
 * Mounted above the navigator so it survives every tab change. An offer is worth
 * about ₹700 to a driver and lasts twenty seconds — it does not wait for them to
 * navigate somewhere receptive.
 */
export function useOfferTakeover(enabled: boolean): void {
  const { data: offer } = useCurrentOffer({ enabled });
  const shownFor = useRef<string | null>(null);

  useEffect(() => {
    if (!offer) {
      // Cleared, so the same booking could legitimately be offered again in a
      // later wave — the exclusion set makes that unlikely, not impossible.
      shownFor.current = null;
      return;
    }
    if (shownFor.current === offer.bookingId) return;

    /**
     * AN ALREADY-DEAD OFFER MUST NOT TAKE OVER. The poll can return an offer
     * with a second left on it, and a push tap can cold-start the app minutes
     * after the window closed. Taking over the screen to show a countdown at
     * zero would be worse than showing nothing.
     */
    const msLeft = new Date(offer.expiresAt).getTime() - Date.now();
    if (!Number.isFinite(msLeft) || msLeft <= 0) return;

    if (!navigationRef.isReady()) return;

    shownFor.current = offer.bookingId;
    track('offer_shown', { wave: offer.wave, secondsLeft: Math.ceil(msLeft / 1_000) });
    navigationRef.navigate('OfferTakeover');
  }, [offer]);
}

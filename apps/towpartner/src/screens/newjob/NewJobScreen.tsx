import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen, Text, ErrorState, EmptyState, OfflineBanner } from '@towing/ui';
import { MapPin, LocateFixed, Truck, RefreshCw } from '@/icons';
import { DriverHeader } from '@/components/DriverHeader';
import { IconChip } from '@/components/IconChip';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { hasForegroundPermission, requestPermissions } from '@/lib/location/driverLocationService';
import { useTabBarSpace } from '@/navigation/DriverTabBar';
import { useCurrentOffer, useRejectOffer } from '@/features/offers/api/offers.queries';
import { OfferCard, OfferCardSkeleton } from '@/features/offers/components/OfferCard';
import { useOfferCountdown } from '@/features/offers/hooks/useOfferCountdown';
import { track } from '@/lib/analytics/analytics';
import { driverColors } from '@/theme/driverColors';
import type { RootStackParamList } from '@/navigation/types';
import { Pressable } from '@/motion';

const INK = '#111827';

/**
 * The New Job tab — the offer, in its calm form.
 *
 * NOT THE PRIMARY SURFACE ANY MORE, and that is the Phase 17 change worth
 * knowing. An offer lasts twenty seconds, so it cannot wait for a driver to
 * choose a tab: `OfferTakeoverScreen` covers the whole app the moment one
 * arrives. This screen stays because the tab exists, because a driver who
 * dismissed the takeover by scrolling away still needs somewhere to go back to,
 * and because the location-permission prompt below belongs on a tab a driver
 * opens deliberately rather than on a screen that interrupts them.
 *
 * Both read the SAME query key, so this and the takeover can never disagree
 * about which offer is live.
 */
export function NewJobScreen() {
  const online = useOnlineStatus();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const tabBarSpace = useTabBarSpace();
  const { data, isPending, isError, refetch } = useCurrentOffer();
  const reject = useRejectOffer();

  /**
   * REAL PERMISSION STATE (Phase 16).
   *
   * Until now this was a `useState(false)` that the "Enable Location" button
   * flipped to `true` — it requested no OS permission at all, so the banner
   * disappeared and nothing whatsoever changed. `undefined` while the check is
   * in flight, so the banner does not flash for a driver who granted it months
   * ago.
   */
  const [locationEnabled, setLocationEnabled] = useState<boolean | undefined>(undefined);
  const [declined, setDeclined] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void hasForegroundPermission().then((granted) => {
      if (!cancelled) setLocationEnabled(granted);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const onEnableLocation = useCallback(async () => {
    // The same prominent disclosure the home toggle shows is NOT repeated here:
    // this screen only asks for FOREGROUND permission (jobs near you, while you
    // are looking at this list), and the Play disclosure requirement attaches to
    // background collection, which only going online starts.
    const outcome = await requestPermissions();
    setLocationEnabled(outcome !== 'denied');
  }, []);
  /**
   * Driven by the server's ABSOLUTE `expiresAt`, not by a local timer seeded
   * once. The old code copied `expiresInSeconds` into state on arrival and
   * decremented it every second — so every second of latency, every dropped
   * frame and any clock the handset felt like keeping made the driver's window
   * longer than the server's, and two drivers could believe they held the same
   * booking.
   */
  const { secondsLeft, expired } = useOfferCountdown(data?.expiresAt);

  const offer = declined || expired ? null : data;

  const onDecline = () => {
    if (!data) return;
    setDeclined(true);
    track('offer_declined', { wave: data.wave, secondsLeft });
    // TELLS THE SERVER, rather than only hiding the card. The old handler set a
    // local flag, so the offer sat there occupying the driver's offer lock for
    // its full twenty seconds and the booking waited out a wave for a decision
    // that had already been made.
    reject.mutate({ bookingId: data.bookingId });
  };

  return (
    <Screen
      scroll
      edges={['top']}
      banner={<OfflineBanner visible={!online} />}
      contentContainerStyle={{ paddingBottom: tabBarSpace }}
    >
      <DriverHeader
        leading="back"
        title="New Job"
        subtitle="New towing request near you"
        subtitleSize={14}
        bellBadge
        onLeading={() => navigation.navigate('Tabs', { screen: 'Home' })}
        onBell={() => navigation.navigate('Notifications')}
      />

      <View style={{ paddingHorizontal: 20, paddingTop: 3, gap: 12 }}>
        {locationEnabled === false ? (
          <>
            {/* Location banner (Figma 78:221) */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                backgroundColor: driverColors.noticeBg,
                borderRadius: 15,
                padding: 14,
              }}
            >
              <IconChip icon={MapPin} bg="#FFFFFF" fg={driverColors.amber} size={44} iconSize={20} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontSize: 14, lineHeight: 20 }}>
                  Enable location to find nearby jobs
                </Text>
                <Text color="secondary" style={{ fontSize: 13, lineHeight: 17 }}>
                  We'll show the best jobs near your location.
                </Text>
              </View>
            </View>

            {/* Enable Location CTA (Figma 78:230) */}
            <Pressable
              onPress={() => void onEnableLocation()}
              accessibilityRole="button"
              accessibilityLabel="Enable location"
              style={() => ({
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                backgroundColor: driverColors.amber,
                borderRadius: 11,
                paddingVertical: 11,
              })}
            >
              <LocateFixed size={15} color={INK} strokeWidth={2.2} />
              <Text style={{ fontSize: 14, lineHeight: 22, color: INK }}>Enable Location</Text>
            </Pressable>
          </>
        ) : null}

        {isPending ? (
          <OfferCardSkeleton />
        ) : isError ? (
          <ErrorState title="Couldn't load new requests" onRetry={() => refetch()} icon={RefreshCw} />
        ) : !offer ? (
          <EmptyState
            icon={Truck}
            title="No new requests"
            body="New tow requests will appear here when you're online."
          />
        ) : (
          <OfferCard
            offer={offer}
            expiresLabel={`${secondsLeft}s`}
            // Deciding happens on the takeover, which owns the accept mutation
            // and the money copy. Two screens both able to POST an accept is two
            // places for a 409 to be handled differently.
            onAccept={() => navigation.navigate('OfferTakeover')}
            onDecline={onDecline}
          />
        )}
      </View>
    </Screen>
  );
}

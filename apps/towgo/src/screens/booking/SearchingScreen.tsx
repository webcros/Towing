import React, { useCallback, useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '@towing/theme';
import { Text, Button, MapPreview } from '@towing/ui';
import { Clock, Check, RefreshCw, Headphones, Truck } from '@/icons';
import { BackButton } from '@/components/BackButton';
import { useBooking, useCancelBooking, useRetrySearch } from '@/features/bookings/api/bookings.queries';
import { useSearchProgress, type SearchProgress } from '@/features/booking/hooks/useSearchProgress';
import { RadarPulse } from '@/features/booking/components/RadarPulse';
import { StatusBanner } from '@/features/booking/components/StatusBanner';
import { RequestDetailsCard } from '@/features/booking/components/RequestDetailsCard';
import { TrustBanner } from '@/features/booking/components/TrustBanner';
import type { RootStackParamList } from '@/navigation/types';

const HEADINGS = {
  searching: { title: 'Searching for Tow', subtitle: "We're finding the best driver for you.\nThis may take a few moments." },
  widening: { title: 'Searching for Tow', subtitle: 'Expanding your search to reach more drivers…' },
  matched: { title: 'Driver found!', subtitle: 'Connecting you to your driver…' },
  no_drivers: { title: 'No drivers found', subtitle: "We couldn't find a driver nearby right now." },
} as const;

type SearchPhase = keyof typeof HEADINGS;

/**
 * §9.1.6's AC: "wave transitions reflect the actual engine state (no fake
 * progress)".
 *
 * THIS SCREEN USED TO LIE. `useSearchSimulation` was a `setTimeout` ladder that
 * pretended to contact drivers and produced a match after 6.5 seconds, for a
 * booking that had never been created. Phase 15 deleted it and left the screen
 * honestly saying "searching" forever, because there was no engine behind it.
 *
 * PHASE 17 GAVE IT ONE. Every number below is now read from the dispatch engine
 * at the moment it advances a wave — the rung, the radius, and how many drivers
 * have actually been contacted — over the `/customer` socket, with the
 * ten-second poll carrying the same facts when the socket is unavailable. The
 * `widening` phase, unreachable since the screen was built, is finally real.
 */
function phaseFor(status: string | undefined, progress: SearchProgress | null): SearchPhase {
  switch (status) {
    case 'no_drivers_found':
      return 'no_drivers';
    case 'assigned':
    case 'en_route':
    case 'arrived':
    case 'in_progress':
      return 'matched';
    default:
      // Past the first rung the search has genuinely widened, and saying so is
      // the difference between a customer waiting and a customer cancelling.
      return progress && progress.wave > 1 ? 'widening' : 'searching';
  }
}

export function SearchingScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { bookingId } = useRoute<RouteProp<RootStackParamList, 'Searching'>>().params;

  const { data: booking } = useBooking(bookingId, { poll: true });
  const cancelBooking = useCancelBooking();
  const retrySearch = useRetrySearch();
  /**
   * §9.1.6's real wave state — the socket when it is connected, the ten-second
   * poll when it is not, and whichever is further along when both are.
   */
  const progress = useSearchProgress(bookingId, booking?.search);
  const phase = phaseFor(booking?.status, progress);

  /**
   * §9.1.6: "Cancel — free" during search, and §3.5 agrees ("during SEARCHING
   * cancellation is always free"). This used to be `navigation.popToTop()` and
   * nothing else, which left a real booking running server-side while the
   * customer believed they had cancelled it.
   */
  const goHome = useCallback(() => {
    cancelBooking.mutate(
      { bookingId, reason: 'Cancelled during search' },
      { onSettled: () => navigation.popToTop() },
    );
  }, [cancelBooking, bookingId, navigation]);

  const notReady = useCallback(() => {}, []);
  const goBack = useCallback(() => navigation.goBack(), [navigation]);
  // §9.1.6's "retry / widen", real as of Phase 17. Re-searching the SAME booking
  // preserves the fare locked at confirm; a new booking would re-quote the
  // customer for the platform's failure to find anyone.
  const retry = useCallback(() => retrySearch.mutate(bookingId), [retrySearch, bookingId]);
  const driversContacted = progress?.driversContacted ?? 0;

  // On match: brief celebration, then hand off to the tracking screen.
  const advanced = useRef(false);
  useEffect(() => {
    if (phase !== 'matched' || advanced.current) return;
    advanced.current = true;
    const t = setTimeout(() => {
      navigation.reset({
        index: 1,
        routes: [{ name: 'Tabs' }, { name: 'Tracking', params: { bookingId } }],
      });
    }, 1400);
    return () => clearTimeout(t);
  }, [phase, navigation, bookingId]);

  const heading = HEADINGS[phase];
  const isSearching = phase === 'searching' || phase === 'widening';

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface0 }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 28, gap: 18 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={{ gap: 12 }}>
            <BackButton onPress={goBack} />

            <View style={{ gap: 6 }}>
              <Text weight="bold" style={{ fontSize: 28, lineHeight: 34, letterSpacing: -0.5 }}>
                {heading.title}
              </Text>
              <Text color="secondary" style={{ fontSize: 15, lineHeight: 21 }}>
                {heading.subtitle}
              </Text>
            </View>
          </View>

          {/* Hero region */}
          {isSearching ? (
            <View
              style={{ height: 316, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
            >
              <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: 0.32 }]}>
                <MapPreview style={StyleSheet.absoluteFill} showRecenter={false} />
              </View>
              <RadarPulse expanded={phase === 'widening'} driversContacted={driversContacted} />
            </View>
          ) : null}

          {phase === 'matched' ? (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <View
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 48,
                  backgroundColor: theme.colors.success,
                  alignItems: 'center',
                  justifyContent: 'center',
                  ...theme.shadows.raised,
                }}
              >
                <Check size={48} color={theme.colors.textInverse} strokeWidth={3} />
              </View>
            </View>
          ) : null}

          {phase === 'no_drivers' ? (
            <>
              <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                <View
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: 48,
                    backgroundColor: theme.colors.surface1,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Truck size={44} color={theme.colors.textTertiary} strokeWidth={1.8} />
                </View>
              </View>
              <StatusBanner
                icon={RefreshCw}
                tone="error"
                title="No drivers available"
                subtitle="Please try again in a moment."
              />
              <View style={{ gap: 10 }}>
                <Button label="Try again" fullWidth leftIcon={RefreshCw} onPress={retry} />
                <Button label="Get help" variant="ghost" fullWidth leftIcon={Headphones} onPress={notReady} />
              </View>
              <TrustBanner />
            </>
          ) : null}

          {isSearching ? (
            <>
              <StatusBanner
                icon={Clock}
                title="Hang tight!"
                subtitle={
                  phase === 'widening' && progress
                    ? // The RADIUS, not "still looking". A customer watching a
                      // spinner needs evidence that something is happening, and
                      // "now searching 7 km" is the difference between patience
                      // and cancelling. Every number here comes from the engine.
                      `Now searching ${progress.radiusKm} km — ${progress.driversContacted} driver${
                        progress.driversContacted === 1 ? '' : 's'
                      } contacted so far.`
                    : "We'll notify you as soon as a driver accepts your request."
                }
              />
              <RequestDetailsCard onCancel={goHome} />
              <TrustBanner />
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

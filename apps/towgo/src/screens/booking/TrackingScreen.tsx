import React, { useCallback, useMemo } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '@towing/theme';
import { StatusBadge } from '@towing/ui';
import { BackButton } from '@/components/BackButton';
import { useBookingStore } from '@/features/booking/store/bookingStore';
import { towTypes } from '@/features/booking/data/towTypes.data';
import { assignedDriverMock } from '@/features/booking/data/assignedDriver.mock';
import { TrackingMapCard } from '@/features/booking/components/TrackingMapCard';
import { DriverInfoCard } from '@/features/booking/components/DriverInfoCard';
import { EtaStatusCard } from '@/features/booking/components/EtaStatusCard';
import { RequestDetailsCard } from '@/features/booking/components/RequestDetailsCard';
import { TrustBanner } from '@/features/booking/components/TrustBanner';
import type { RootStackParamList } from '@/navigation/types';
import { useBooking } from '@/features/bookings/api/bookings.queries';
import { STATUS_META } from '@/features/bookings/statusMeta';
import { BottomSheet } from '@/motion';

/**
 * Three snaps here, unlike BookTow. There is no permanent CTA to protect, so a
 * peek detent that hands almost the whole screen back to the map is genuinely
 * useful while you watch the truck approach.
 */
const PEEK_RATIO = 0.28;
const DEFAULT_RATIO = 0.55;
const FULL_RATIO = 0.85;

export function TrackingScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { height: screenHeight } = useWindowDimensions();

  /**
   * The booking being tracked. Phase 15 gives this screen a real id so a live
   * trip is recoverable — the active-trip card in My Bookings routes back here.
   * The driver card is still the Phase 12 mock: real driver identity arrives
   * with assignment in Phase 17 and live position in Phase 18.
   */
  const { bookingId } = useRoute<RouteProp<RootStackParamList, 'Tracking'>>().params;
  const { data: booking } = useBooking(bookingId, { poll: true });

  const towTypeId = useBookingStore((s) => s.towTypeId);
  const towName = towTypes.find((t) => t.id === towTypeId)?.name ?? 'Tow';
  const vehicleLabel = `${towName} Tow Truck`;

  const goHome = useCallback(() => navigation.popToTop(), [navigation]);
  const notReady = useCallback(() => {}, []);

  const snapPoints = useMemo(
    () => [screenHeight * PEEK_RATIO, screenHeight * DEFAULT_RATIO, screenHeight * FULL_RATIO],
    [screenHeight],
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface0 }}>
      {/* The map is the backdrop now rather than a card in the scroller, so the
          sheet can be dragged down to reveal it. */}
      <TrackingMapCard fullBleed />

      <SafeAreaView edges={['top']} style={{ flex: 1 }} pointerEvents="box-none">
        <View style={{ paddingHorizontal: 20, paddingTop: 4, alignSelf: 'flex-start' }}>
          <BackButton onPress={goHome} />
        </View>
      </SafeAreaView>

      <BottomSheet
        snapPoints={snapPoints}
        initialIndex={1}
        // No footer: cancelling lives inside RequestDetailsCard, so there is no
        // persistent action that has to stay pinned.
      >
        <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28, gap: 16 }}>
          {/*
            The REAL §5.1 status, polled. Everything below it is still the
            Phase 12 mock — driver identity arrives with assignment (Phase 17)
            and live position with the location pipeline (Phase 18) — so this
            line is currently the only thing on the screen telling the truth,
            and it will read "Searching" until dispatch exists.
          */}
          {booking ? (
            <View style={{ flexDirection: 'row' }}>
              <StatusBadge
                label={STATUS_META[booking.status].label}
                tone={STATUS_META[booking.status].tone}
                icon={STATUS_META[booking.status].icon}
                pill
              />
            </View>
          ) : null}

          <DriverInfoCard
            driver={assignedDriverMock}
            vehicleLabel={vehicleLabel}
            onCall={notReady}
            onMessage={notReady}
          />

          <EtaStatusCard etaMinutes={assignedDriverMock.etaMinutes} />

          <RequestDetailsCard onCancel={goHome} />

          <TrustBanner />
        </View>
      </BottomSheet>
    </View>
  );
}

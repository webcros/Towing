import React, { useCallback, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useTheme } from '@towing/theme';
import { Text, MapPreview } from '@towing/ui';
import { LocateFixed, StickyNote, ChevronRight } from '@/icons';
import { BackButton } from '@/components/BackButton';
import { useLocationStore } from '@/features/location/locationStore';
import { useBookingStore } from '@/features/booking/store/bookingStore';
import { towTypes } from '@/features/booking/data/towTypes.data';
import { LocationSummaryBar } from '@/features/booking/components/LocationSummaryBar';
import { MapRouteOverlay } from '@/features/booking/components/MapRouteOverlay';
import { TowTypeCarousel } from '@/features/booking/components/TowTypeCarousel';
import { BookingOptionRow } from '@/features/booking/components/BookingOptionRow';
import { BookingBottomBar } from '@/features/booking/components/BookingBottomBar';
import { TrustBanner } from '@/features/booking/components/TrustBanner';
import type { RootStackParamList } from '@/navigation/types';
import { Pressable, BottomSheet } from '@/motion';

/**
 * Two snaps, not three. Collapsed shows the heading, one row of tow types and
 * the CTA; expanded matches the 72% the static sheet used, so the first paint
 * is unchanged. A third "peek" detent buys nothing on a screen with a permanent
 * CTA and doubles the gesture tuning.
 */
const COLLAPSED_RATIO = 0.42;
const EXPANDED_RATIO = 0.72;

/** Clearance between the recenter FAB and the sheet's top edge. */
const FAB_GAP = 16;

export function BookTowScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { height: screenHeight } = useWindowDimensions();

  const useCurrentLocation = useLocationStore((s) => s.useCurrentLocation);
  const towTypeId = useBookingStore((s) => s.towTypeId);
  const fare = towTypes.find((t) => t.id === towTypeId)?.price ?? 0;

  // Note sheet / View All are later; Confirm starts the driver search.
  const notReady = useCallback(() => {}, []);
  const confirmBooking = useCallback(() => navigation.navigate('Searching'), [navigation]);

  const snapPoints = useMemo(
    () => [screenHeight * COLLAPSED_RATIO, screenHeight * EXPANDED_RATIO],
    [screenHeight],
  );

  // The FAB used to sit in a flex spacer whose height tracked the sheet's flow
  // height. The sheet is absolutely positioned now, so that link is gone and
  // the FAB is pinned to the sheet's live height instead — which is what makes
  // it ride up and down with the drag.
  const sheetHeight = useSharedValue(screenHeight * EXPANDED_RATIO);
  const fabStyle = useAnimatedStyle(() => ({ bottom: sheetHeight.value + FAB_GAP }));

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface0 }}>
      {/* Placeholder map + stylized route & drivers */}
      <MapPreview style={StyleSheet.absoluteFill} showRecenter={false} />
      <MapRouteOverlay />

      <SafeAreaView edges={['top']} style={{ flex: 1 }} pointerEvents="box-none">
        {/* Back + read-only route summary */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingHorizontal: 20,
            paddingTop: 4,
          }}
        >
          <BackButton onPress={() => navigation.goBack()} />

          <LocationSummaryBar onEdit={() => navigation.goBack()} />
        </View>
      </SafeAreaView>

      <Animated.View style={[{ position: 'absolute', right: 16 }, fabStyle]}>
        <Pressable
          onPress={useCurrentLocation}
          accessibilityRole="button"
          accessibilityLabel="Use current location"
          pressScale={theme.motion.pressScale.chip}
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            backgroundColor: theme.colors.card,
            borderWidth: 1,
            borderColor: theme.colors.border,
            alignItems: 'center',
            justifyContent: 'center',
            ...theme.shadows.fab,
          }}
        >
          <LocateFixed size={22} color={theme.colors.textPrimary} />
        </Pressable>
      </Animated.View>

      <BottomSheet
        snapPoints={snapPoints}
        initialIndex={1}
        height={sheetHeight}
        header={
          <>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                paddingHorizontal: 20,
                paddingTop: 12,
              }}
            >
              <Text variant="title" weight="semibold">
                Select Tow Type
              </Text>
              <Pressable
                onPress={notReady}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="View all tow types"
                style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
              >
                <Text
                  weight="medium"
                  style={{ fontSize: 13, lineHeight: 19, color: theme.colors.brand }}
                >
                  View All
                </Text>
                <ChevronRight size={13} color={theme.colors.brand} strokeWidth={2.4} />
              </Pressable>
            </View>

            <Text
              color="secondary"
              style={{ fontSize: 12, lineHeight: 18, paddingHorizontal: 20, marginTop: 2 }}
            >
              Select the vehicle that best suits your need
            </Text>
          </>
        }
        // Inside the sheet but below the scroller, so the CTA can never be
        // dragged off-screen. BookingBottomBar already carries its own bottom
        // inset and top border, so it needs no changes.
        footer={<BookingBottomBar fare={fare} onConfirm={confirmBooking} />}
      >
        <TowTypeCarousel />

        <View style={{ paddingHorizontal: 20, gap: 10, paddingBottom: 16 }}>
          <BookingOptionRow
            icon={StickyNote}
            label="Add Note (Optional)"
            value="Add"
            onPress={notReady}
          />

          <View style={{ marginTop: 3 }}>
            <TrustBanner />
          </View>
        </View>
      </BottomSheet>
    </View>
  );
}

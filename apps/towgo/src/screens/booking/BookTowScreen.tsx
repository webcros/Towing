import React, { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
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

export function BookTowScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const useCurrentLocation = useLocationStore((s) => s.useCurrentLocation);
  const towTypeId = useBookingStore((s) => s.towTypeId);
  const fare = towTypes.find((t) => t.id === towTypeId)?.price ?? 0;

  // Note sheet / View All are later; Confirm starts the driver search.
  const notReady = useCallback(() => {}, []);
  const confirmBooking = useCallback(() => navigation.navigate('Searching'), [navigation]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface0 }}>
      {/* Placeholder map + stylized route & drivers */}
      <MapPreview style={StyleSheet.absoluteFill} showRecenter={false} />
      <MapRouteOverlay />

      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Back + read-only route summary */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 11,
            paddingHorizontal: 14.5,
            paddingTop: 4,
          }}
        >
          <BackButton onPress={() => navigation.goBack()} />

          <LocationSummaryBar onEdit={() => navigation.goBack()} />
        </View>

        {/* Spacer over the map + current-location FAB */}
        <View style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'flex-end', padding: 14.5 }}>
          <Pressable
            onPress={useCurrentLocation}
            accessibilityRole="button"
            accessibilityLabel="Use current location"
            style={({ pressed }) => ({
              width: 43.5,
              height: 43.5,
              borderRadius: 13,
              backgroundColor: theme.colors.card,
              borderWidth: 1,
              borderColor: theme.colors.border,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.7 : 1,
              ...theme.shadows.fab,
            })}
          >
            <LocateFixed size={20} color={theme.colors.textPrimary} />
          </Pressable>
        </View>

        {/* Bottom sheet (static v1) */}
        <View
          style={{
            backgroundColor: theme.colors.card,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            maxHeight: '72%',
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.06,
            shadowRadius: 12,
            elevation: 16,
          }}
        >
          <View style={{ alignItems: 'center', paddingTop: 11 }}>
            <View
              style={{
                width: 36,
                height: 5.4,
                borderRadius: theme.radii.pill,
                backgroundColor: theme.colors.surface1,
              }}
            />
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              paddingHorizontal: 18,
              paddingTop: 11,
            }}
          >
            <Text weight="semibold" style={{ fontSize: 16.3, lineHeight: 24.5 }}>
              Select Tow Type
            </Text>
            <Pressable
              onPress={notReady}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="View all tow types"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
            >
              <Text weight="medium" style={{ fontSize: 11.3, lineHeight: 17, color: theme.colors.brand }}>
                View All
              </Text>
              <ChevronRight size={11} color={theme.colors.brand} strokeWidth={2.4} />
            </Pressable>
          </View>

          <Text
            color="secondary"
            style={{ fontSize: 10.9, lineHeight: 16.3, paddingHorizontal: 18, marginTop: 2 }}
          >
            Select the vehicle that best suits your need
          </Text>

          <ScrollView bounces={false} style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled">
            <TowTypeCarousel />

            <View style={{ paddingHorizontal: 18, gap: 9, paddingBottom: 14 }}>
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
          </ScrollView>

          <BookingBottomBar fare={fare} onConfirm={confirmBooking} />
        </View>
      </SafeAreaView>
    </View>
  );
}

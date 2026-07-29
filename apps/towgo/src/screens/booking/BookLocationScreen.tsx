import React, { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '@towing/theme';
import { Text, Button } from '@towing/ui';
import { ArrowLeft } from '@/icons';
import { useBookingStore } from '@/features/booking/store/bookingStore';
import { LocationFields, type LocationField } from '@/features/booking/components/LocationFields';
import { BookingPills } from '@/features/booking/components/BookingPills';
import { LocationActionButtons } from '@/features/booking/components/LocationActionButtons';
import { RecentLocationsList } from '@/features/booking/components/RecentLocationsList';
import type { RecentLocation } from '@/features/booking/data/recentLocations.data';
import type { RootStackParamList } from '@/navigation/types';

export function BookLocationScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const pickupAddress = useBookingStore((s) => s.pickupAddress);
  const dropAddress = useBookingStore((s) => s.dropAddress);
  const setPickupAddress = useBookingStore((s) => s.setPickupAddress);
  const setDropAddress = useBookingStore((s) => s.setDropAddress);

  // Which field a tapped recent should fill (defaults to the first empty one).
  const activeField = useRef<LocationField>(pickupAddress ? 'drop' : 'pickup');
  const [, force] = useState(0);
  const setActiveField = useCallback((field: LocationField) => {
    activeField.current = field;
    force((n) => n + 1);
  }, []);

  const onSelectRecent = useCallback(
    (loc: RecentLocation) => {
      const value = `${loc.name}, ${loc.address.split(',')[0]}`;
      if (activeField.current === 'pickup') {
        setPickupAddress(value);
        activeField.current = 'drop';
      } else {
        setDropAddress(value);
      }
      force((n) => n + 1);
    },
    [setPickupAddress, setDropAddress],
  );

  const notReady = useCallback(() => {}, []);
  const canContinue = pickupAddress.trim().length > 0 && dropAddress.trim().length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface0 }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingHorizontal: 16,
            paddingTop: 4,
            paddingBottom: 12,
          }}
        >
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={8}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <ArrowLeft size={24} color={theme.colors.textPrimary} />
          </Pressable>
          <Text weight="bold" style={{ fontSize: 22, lineHeight: 28 }}>
            Enter location
          </Text>
        </View>

        <View style={{ paddingHorizontal: 16, gap: 12 }}>
          <BookingPills />
          <LocationFields onFocusField={setActiveField} />
          <LocationActionButtons onSelectOnMap={notReady} onAddStops={notReady} />
        </View>

        {/* Recents */}
        <ScrollView
          style={{ flex: 1, marginTop: 6 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <RecentLocationsList onSelect={onSelectRecent} />
        </ScrollView>

        {/* Continue */}
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 10,
            paddingBottom: 12,
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
            backgroundColor: theme.colors.surface0,
          }}
        >
          <Button
            label="Continue"
            fullWidth
            height={50}
            disabled={!canContinue}
            onPress={() => navigation.navigate('BookTow')}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

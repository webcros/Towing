import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Card, Text, Button, MapPreview } from '@towing/ui';
import { MapPin, LocateFixed, Navigation } from '@/icons';
import { useLocationStore } from '@/features/location/locationStore';
import { Pressable } from '@/motion';

export type PickupMapCardProps = {
  onBook: () => void;
  onUseCurrentLocation: () => void;
  locating?: boolean;
  isOnline?: boolean;
  /** Foreground location permission was denied — pickup stays on the fallback address. */
  locationDenied?: boolean;
};

/**
 * Home pickup card (redesigned): live map with the user's current position on
 * top, pickup address + locate below, then the Book a Tow CTA — one card.
 */
export function PickupMapCard({
  onBook,
  onUseCurrentLocation,
  locating = false,
  isOnline = true,
  locationDenied = false,
}: PickupMapCardProps) {
  const theme = useTheme();
  const pickup = useLocationStore((s) => s.pickup);

  return (
    <Card radius="cardLg" padding={0} style={{ overflow: 'hidden' }}>
      <MapPreview
        height={206}
        showUserLocation
        recenterIcon={Navigation}
        onRecenter={onUseCurrentLocation}
        recenterDisabled={!isOnline || locating}
      />

      <View style={{ paddingVertical: 18, paddingHorizontal: 16, gap: 18 }}>
        <View
          style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}
        >
          <View style={{ flex: 1, gap: 7 }}>
            <Text variant="overline" color="tertiary">
              Pickup Location
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <MapPin size={18} color={theme.colors.brand} />
              <Text
                weight="semibold"
                numberOfLines={1}
                style={{ fontSize: 16, lineHeight: 22, flexShrink: 1 }}
              >
                {pickup.label}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={onUseCurrentLocation}
            disabled={locating}
            accessibilityRole="button"
            accessibilityLabel="Use current location"
            style={() => ({
              width: 36,
              height: 36,
              borderRadius: 13,
              borderWidth: 1,
              borderColor: theme.colors.border,
              alignItems: 'center',
              justifyContent: 'center',
            })}
          >
            {locating ? (
              <ActivityIndicator size="small" color={theme.colors.brand} />
            ) : (
              <LocateFixed size={16} color={theme.colors.textSecondary} />
            )}
          </Pressable>
        </View>

        {locationDenied ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <MapPin size={13} color={theme.colors.error} />
            <Text color="error" style={{ fontSize: 12, lineHeight: 16, flex: 1 }}>
              Location access denied — using your last saved pickup instead.
            </Text>
          </View>
        ) : null}

        <Button label="Book a Tow" onPress={onBook} fullWidth height={46} />
      </View>
    </Card>
  );
}

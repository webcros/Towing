import React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Card, Text, Button } from '@towing/ui';
import { MapPin, LocateFixed } from '@/icons';
import { useLocationStore } from '@/features/location/locationStore';

export type PickupLocationCardProps = {
  onBook: () => void;
  onUseCurrentLocation: () => void;
  locating?: boolean;
};

export function PickupLocationCard({
  onBook,
  onUseCurrentLocation,
  locating = false,
}: PickupLocationCardProps) {
  const theme = useTheme();
  const pickup = useLocationStore((s) => s.pickup);

  return (
    <Card radius="cardLg" padding={0}>
      <View style={{ paddingVertical: 18, paddingHorizontal: 16, gap: 18 }}>
        <View
          style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}
        >
          <View style={{ flex: 1, gap: 7 }}>
            <Text variant="label" color="tertiary" style={{ fontSize: 10 }}>
              Pickup Location
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <MapPin size={18} color={theme.colors.brand} />
              <Text
                weight="semibold"
                numberOfLines={1}
                style={{ fontSize: 14.5, lineHeight: 22, flexShrink: 1 }}
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
            style={({ pressed }) => ({
              width: 36,
              height: 36,
              borderRadius: 13,
              borderWidth: 1,
              borderColor: theme.colors.border,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.6 : 1,
            })}
          >
            {locating ? (
              <ActivityIndicator size="small" color={theme.colors.brand} />
            ) : (
              <LocateFixed size={16} color={theme.colors.textSecondary} />
            )}
          </Pressable>
        </View>

        <Button label="Book a Tow" onPress={onBook} fullWidth height={46} />
      </View>
    </Card>
  );
}

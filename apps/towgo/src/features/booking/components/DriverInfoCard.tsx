import React from 'react';
import { Image, Pressable, View, type ImageSourcePropType } from 'react-native';
import { useTheme } from '@towing/theme';
import { Text, type IconComponent } from '@towing/ui';
import { Star, Truck, Phone, MessageCircle } from '@/icons';

/**
 * What the card renders — a structural subset, so both a live `AssignedDriver`
 * and a finished booking (which has no ETA) can feed it.
 */
export type DriverCardInfo = {
  name: string;
  photo: ImageSourcePropType;
  rating: number;
  trips: number;
  vehiclePlate: string;
};

function ActionCircle({
  icon: Icon,
  bg,
  color,
  label,
  onPress,
}: {
  icon: IconComponent;
  bg: string;
  color: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Icon size={20} color={color} strokeWidth={2} />
    </Pressable>
  );
}

export function DriverInfoCard({
  driver,
  vehicleLabel,
  onCall,
  onMessage,
}: {
  driver: DriverCardInfo;
  vehicleLabel: string;
  onCall: () => void;
  onMessage: () => void;
}) {
  const theme = useTheme();

  return (
    <View
      style={{
        backgroundColor: theme.colors.card,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        ...theme.shadows.card,
      }}
    >
      <Image
        source={driver.photo}
        style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: theme.colors.surface1 }}
        accessibilityLabel={`${driver.name}'s photo`}
      />

      <View style={{ flex: 1, gap: 5 }}>
        <Text weight="semibold" numberOfLines={1} style={{ fontSize: 17, lineHeight: 22 }}>
          {driver.name}
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 3,
              backgroundColor: theme.colors.brandTint,
              borderRadius: 6,
              paddingHorizontal: 6,
              paddingVertical: 2,
            }}
          >
            <Star size={12} color={theme.colors.star} fill={theme.colors.star} />
            <Text weight="medium" tabular style={{ fontSize: 12, lineHeight: 16 }}>
              {driver.rating.toFixed(1)}
            </Text>
          </View>
          <Text color="secondary" style={{ fontSize: 12.5, lineHeight: 16 }}>
            ({driver.trips} trips)
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Truck size={14} color={theme.colors.textSecondary} strokeWidth={2} />
          <Text weight="medium" numberOfLines={1} style={{ fontSize: 13.5, lineHeight: 18 }}>
            {driver.vehiclePlate}
          </Text>
        </View>
        <Text color="secondary" numberOfLines={1} style={{ fontSize: 12.5, lineHeight: 16 }}>
          {vehicleLabel}
        </Text>
      </View>

      <View style={{ gap: 10 }}>
        <ActionCircle
          icon={Phone}
          bg={theme.colors.successSoftBg}
          color={theme.colors.success}
          label="Call driver"
          onPress={onCall}
        />
        <ActionCircle
          icon={MessageCircle}
          bg={theme.colors.infoSoftBg}
          color={theme.colors.info}
          label="Message driver"
          onPress={onMessage}
        />
      </View>
    </View>
  );
}

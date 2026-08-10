import React from 'react';
import { Image, View, type ImageSourcePropType } from 'react-native';
import { useTheme } from '@towing/theme';
import { Text, type IconComponent } from '@towing/ui';
import { Star, Truck, Phone, MessageCircle } from '@/icons';
import { Pressable } from '@/motion';

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
  caption,
  onPress,
}: {
  icon: IconComponent;
  bg: string;
  color: string;
  /** Screen-reader label — stays explicit so VoiceOver doesn't read "Call, Call". */
  label: string;
  /** Visible text under the circle. */
  caption: string;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={() => ({
        alignItems: 'center',
        gap: theme.spacing.xs,
      })}
    >
      <View
        style={{
          width: theme.sizes.control.tapTarget,
          height: theme.sizes.control.tapTarget,
          borderRadius: theme.sizes.control.tapTarget / 2,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={theme.sizes.icon.md + 2} color={color} strokeWidth={2} />
      </View>
      <Text variant="micro" color="secondary">
        {caption}
      </Text>
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
        borderRadius: theme.radii.sheet,
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: theme.spacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.lg,
        ...theme.shadows.card,
      }}
    >
      <Image
        source={driver.photo}
        style={{
          width: theme.sizes.avatar.lg,
          height: theme.sizes.avatar.lg,
          borderRadius: theme.sizes.avatar.lg / 2,
          backgroundColor: theme.colors.brandTint,
        }}
        accessibilityLabel={`${driver.name}'s photo`}
      />

      <View style={{ flex: 1, gap: 6 }}>
        <Text variant="subtitle" weight="bold" numberOfLines={1}>
          {driver.name}
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View
            accessible
            accessibilityLabel={`Rated ${driver.rating.toFixed(1)} out of 5`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.xs,
              backgroundColor: theme.colors.brandTint,
              borderRadius: theme.radii.pill,
              paddingHorizontal: theme.spacing.sm,
              paddingVertical: 3,
            }}
          >
            <Star size={theme.sizes.icon.xs} color={theme.colors.star} fill={theme.colors.star} />
            <Text variant="caption" weight="bold" tabular>
              {driver.rating.toFixed(1)}
            </Text>
          </View>
          <Text variant="caption" color="secondary">
            ({driver.trips} trips)
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Truck size={theme.sizes.icon.sm} color={theme.colors.textSecondary} strokeWidth={2} />
          <Text variant="body" weight="semibold" numberOfLines={1}>
            {driver.vehiclePlate}
          </Text>
        </View>
        <Text variant="caption" color="secondary" numberOfLines={1}>
          {vehicleLabel}
        </Text>
      </View>

      <View style={{ gap: theme.spacing.lg }}>
        <ActionCircle
          icon={Phone}
          bg={theme.colors.successSoftBg}
          color={theme.colors.success}
          label="Call driver"
          caption="Call"
          onPress={onCall}
        />
        <ActionCircle
          icon={MessageCircle}
          bg={theme.colors.infoSoftBg}
          color={theme.colors.info}
          label="Message driver"
          caption="Message"
          onPress={onMessage}
        />
      </View>
    </View>
  );
}

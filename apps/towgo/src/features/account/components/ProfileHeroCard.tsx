import React from 'react';
import { Image, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '@towing/theme';
import { Text } from '@towing/ui';
import { ChevronRight } from '@/icons';
import { Pressable } from '@/motion';

const avatar = require('@/assets/illustrations/avatar-placeholder.png');

export type ProfileHeroCardProps = {
  name: string;
  email: string;
  /** Real counts. Rendered as-is — nothing here is a placeholder. */
  trips: number;
  vehicles: number;
  places: number;
  onEditProfile: () => void;
  onViewBookings: () => void;
};

/**
 * Dark hero at the top of Account: identity above, activity band below.
 *
 * Two separate targets rather than one, so the band can carry its own chevron:
 * tapping the identity block edits your profile, tapping the band opens your
 * bookings. Stacking two `Pressable`s inside one would make the inner target
 * unreliable on Android.
 *
 * `heroBg`/`heroBand` are real tokens rather than a borrowed `textPrimary`,
 * because this is a surface and it stays dark in both themes deliberately.
 */
export function ProfileHeroCard({
  name,
  email,
  trips,
  vehicles,
  places,
  onEditProfile,
  onViewBookings,
}: ProfileHeroCardProps) {
  const theme = useTheme();
  const size = theme.sizes.avatar.lg;

  return (
    <View
      style={{
        borderRadius: theme.radii.sheet,
        backgroundColor: theme.colors.heroBg,
        // Clips the decorative rings to the card's rounded corners.
        overflow: 'hidden',
      }}
    >
      {/* Decoration only. pointerEvents none so it never eats a tap. */}
      <View
        pointerEvents="none"
        style={{ position: 'absolute', top: -70, right: -60, opacity: 0.16 }}
      >
        <Svg width={220} height={220}>
          <Circle cx={110} cy={110} r={104} stroke={theme.colors.brand} strokeWidth={1} fill="none" />
          <Circle cx={110} cy={110} r={74} stroke={theme.colors.brand} strokeWidth={1} fill="none" />
          <Circle cx={110} cy={110} r={44} stroke={theme.colors.brand} strokeWidth={1} fill="none" />
        </Svg>
      </View>

      <Pressable
        onPress={onEditProfile}
        pressScale={theme.motion.pressScale.row}
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${email}. Edit your profile`}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.lg,
          padding: theme.spacing.xl,
        }}
      >
        <View
          style={{
            width: size + 6,
            height: size + 6,
            borderRadius: (size + 6) / 2,
            borderWidth: 2,
            borderColor: theme.colors.brand,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Image
            source={avatar}
            style={{ width: size, height: size, borderRadius: size / 2 }}
            accessibilityIgnoresInvertColors
          />
        </View>

        {/* minWidth 0 lets this shrink so a long name ellipsises instead of
            pushing the chevron off the card. */}
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text variant="h2" color="inverse" numberOfLines={1}>
            {name}
          </Text>
          <Text
            variant="caption"
            numberOfLines={1}
            style={{ color: theme.colors.textTertiary }}
          >
            {email}
          </Text>
        </View>

        <ChevronRight
          size={theme.sizes.icon.lg}
          color={theme.colors.textTertiary}
          strokeWidth={2}
        />
      </Pressable>

      <Pressable
        onPress={onViewBookings}
        pressScale={theme.motion.pressScale.row}
        accessibilityRole="button"
        accessibilityLabel={`${trips} trips, ${vehicles} vehicles, ${places} saved places. View your bookings`}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: theme.colors.heroBand,
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.xl,
          gap: theme.spacing.md,
        }}
      >
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
          <Stat value={trips} label={trips === 1 ? 'trip' : 'trips'} />
          <Dot />
          <Stat value={vehicles} label={vehicles === 1 ? 'vehicle' : 'vehicles'} />
          <Dot />
          <Stat value={places} label={places === 1 ? 'place' : 'places'} />
        </View>

        <ChevronRight size={theme.sizes.icon.md} color={theme.colors.brand} strokeWidth={2.2} />
      </Pressable>
    </View>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
      <Text variant="bodyMedium" tabular style={{ color: theme.colors.brand }}>
        {value}
      </Text>
      <Text variant="caption" style={{ color: theme.colors.textTertiary }}>
        {label}
      </Text>
    </View>
  );
}

function Dot() {
  const theme = useTheme();
  return (
    <View
      style={{
        width: 3,
        height: 3,
        borderRadius: 1.5,
        marginHorizontal: theme.spacing.sm,
        backgroundColor: theme.colors.textTertiary,
      }}
    />
  );
}

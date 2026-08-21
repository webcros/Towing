import React from 'react';
import { Image, View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Text, StatusBadge, type IconComponent } from '@towing/ui';
import { Phone, MessageCircle, Star } from '@/icons';
import { formatBookingDate, formatBookingTime, formatPaise } from '@/utils/format';
import { STATUS_META } from '../statusMeta';
import type { BookingDetail } from '../types';
import { Pressable } from '@/motion';

/** Full-width neutral pill. Replaces the two clipped circles the old card had. */
function ActionPill({
  icon: Icon,
  label,
  onPress,
}: {
  icon: IconComponent;
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={() => ({
        flex: 1,
        height: theme.sizes.control.tapTarget,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.sm,
        borderRadius: theme.radii.pill,
        backgroundColor: theme.colors.surface1,
      })}
    >
      <Icon size={theme.sizes.icon.md} color={theme.colors.textPrimary} strokeWidth={2} />
      <Text variant="body" weight="medium">
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * The screen's one large statement: what the trip was, who drove it, when, and
 * what it cost — then the two actions.
 *
 * Everything here is plain text on the page background. A single 24pt heading
 * carries the hierarchy, so the rest of the screen can sit at 13–14 without any
 * of it competing.
 */
export function BookingHero({
  booking,
  towName,
  onCall,
  onMessage,
}: {
  booking: BookingDetail;
  towName: string;
  onCall: () => void;
  onMessage: () => void;
}) {
  const theme = useTheme();
  const status = STATUS_META[booking.status];

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.lg }}>
        <View style={{ flex: 1, gap: theme.spacing.sm }}>
          <Text variant="h2">
            {towName} tow{booking.driverName ? ` with ${booking.driverName}` : ''}
          </Text>

          <Text variant="body" color="secondary">
            {formatBookingDate(booking.createdAt)} · {formatBookingTime(booking.createdAt)}
          </Text>

          <Text variant="h3" tabular>
            {formatPaise(booking.farePaise)}
          </Text>
        </View>

        {/* No driver until assignment (§11.9) — the whole block is absent, not empty. */}
        {booking.driverName ? (
          <View style={{ alignItems: 'center', gap: 6 }}>
            <Image
              source={booking.driverPhoto ? { uri: booking.driverPhoto } : undefined}
              accessibilityLabel={`${booking.driverName}'s photo`}
              style={{
                width: theme.sizes.avatar.md,
                height: theme.sizes.avatar.md,
                borderRadius: theme.sizes.avatar.md / 2,
                backgroundColor: theme.colors.brandTint,
              }}
            />
            {booking.driverRating !== null ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Star
                  size={theme.sizes.icon.xs}
                  color={theme.colors.star}
                  fill={theme.colors.star}
                />
                <Text variant="caption" weight="medium" tabular>
                  {booking.driverRating.toFixed(1)}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row' }}>
        <StatusBadge label={status.label} tone={status.tone} icon={status.icon} iconFilled pill />
      </View>

      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        <ActionPill icon={Phone} label="Call" onPress={onCall} />
        <ActionPill icon={MessageCircle} label="Message" onPress={onMessage} />
      </View>
    </View>
  );
}

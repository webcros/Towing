import React from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Text, type IconComponent } from '@towing/ui';
import { Clock, User, ChevronDown } from '@/icons';
import { useBookingStore } from '../store/bookingStore';

function Pill({
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
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: theme.colors.card,
        borderRadius: theme.radii.pill,
        borderWidth: 1,
        borderColor: theme.colors.border,
        paddingHorizontal: 12,
        paddingVertical: 8,
        opacity: pressed ? 0.7 : 1,
        ...theme.shadows.card,
      })}
    >
      <Icon size={15} color={theme.colors.textPrimary} strokeWidth={2} />
      <Text weight="medium" style={{ fontSize: 13, lineHeight: 17 }}>
        {label}
      </Text>
      <ChevronDown size={13} color={theme.colors.textSecondary} strokeWidth={2.2} />
    </Pressable>
  );
}

export function BookingPills() {
  const scheduleMode = useBookingStore((s) => s.scheduleMode);
  const bookingFor = useBookingStore((s) => s.bookingFor);
  const toggleBookingFor = useBookingStore((s) => s.toggleBookingFor);

  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <Pill
        icon={Clock}
        label={scheduleMode === 'now' ? 'Pickup now' : 'Scheduled'}
        onPress={() => {}}
      />
      <Pill
        icon={User}
        label={bookingFor === 'me' ? 'For me' : 'For someone else'}
        onPress={toggleBookingFor}
      />
    </View>
  );
}

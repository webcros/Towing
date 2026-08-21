import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Text, type IconComponent } from '@towing/ui';
import { MapPin, Plus } from '@/icons';
import { Pressable } from '@/motion';

function ActionButton({
  icon: Icon,
  label,
  onPress,
  disabled = false,
}: {
  icon: IconComponent;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={() => ({
        opacity: disabled ? 0.45 : 1,
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: theme.colors.card,
        borderRadius: theme.radii.pill,
        borderWidth: 1,
        borderColor: theme.colors.border,
        paddingVertical: 11,
      })}
    >
      <Icon size={16} color={theme.colors.textPrimary} strokeWidth={2} />
      <Text weight="medium" style={{ fontSize: 13, lineHeight: 17 }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function LocationActionButtons({
  onSelectOnMap,
  onAddStops,
  /**
   * No rendered map to drop a pin on — Android without a Maps key
   * (SETUP-CHECKLIST item 7). Disabled rather than hidden: the affordance is in
   * the design and a button that vanishes reads as a bug, while a dimmed one
   * reads as "not yet". Opening a picker over the themed placeholder would let
   * the customer confirm a pickup they cannot see.
   */
  selectOnMapDisabled = false,
}: {
  onSelectOnMap: () => void;
  onAddStops: () => void;
  selectOnMapDisabled?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <ActionButton
        icon={MapPin}
        label="Select on map"
        onPress={onSelectOnMap}
        disabled={selectOnMapDisabled}
      />
      <ActionButton icon={Plus} label="Add stops" onPress={onAddStops} />
    </View>
  );
}

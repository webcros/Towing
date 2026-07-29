import React from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Text, type IconComponent } from '@towing/ui';
import { MapPin, Plus } from '@/icons';

function ActionButton({
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
        opacity: pressed ? 0.7 : 1,
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
}: {
  onSelectOnMap: () => void;
  onAddStops: () => void;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <ActionButton icon={MapPin} label="Select on map" onPress={onSelectOnMap} />
      <ActionButton icon={Plus} label="Add stops" onPress={onAddStops} />
    </View>
  );
}

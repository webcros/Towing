import React, { useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Text } from '@towing/ui';
import { History, Heart } from '@/icons';
import type { RecentLocation } from '../data/recentLocations.data';
import { Pressable } from '@/motion';

export function RecentLocationRow({
  location,
  onPress,
  divider,
}: {
  location: RecentLocation;
  onPress: () => void;
  divider?: boolean;
}) {
  const theme = useTheme();
  const [favorite, setFavorite] = useState(false);

  return (
    <View>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${location.name}, ${location.address}`}
        style={() => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          paddingVertical: 14,
        })}
      >
        <History size={20} color={theme.colors.textTertiary} strokeWidth={1.8} />

        <View style={{ flex: 1 }}>
          <Text weight="semibold" numberOfLines={1} style={{ fontSize: 15, lineHeight: 21 }}>
            {location.name}
          </Text>
          <Text color="secondary" numberOfLines={1} style={{ fontSize: 13, lineHeight: 18 }}>
            {location.address}
          </Text>
        </View>

        <Pressable
          onPress={() => setFavorite((v) => !v)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={favorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Heart
            size={20}
            color={favorite ? theme.colors.error : theme.colors.textTertiary}
            fill={favorite ? theme.colors.error : 'transparent'}
            strokeWidth={1.8}
          />
        </Pressable>
      </Pressable>

      {divider ? <View style={{ height: 1, backgroundColor: theme.colors.border }} /> : null}
    </View>
  );
}

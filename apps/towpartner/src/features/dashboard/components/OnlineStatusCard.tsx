import React from 'react';
import { Image, Pressable, View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Text } from '@towing/ui';
import { Power } from '@/icons';
import { HeroCard } from '@/components/HeroCard';
import { driverColors } from '@/theme/driverColors';

const heroTruck = require('@/assets/illustrations/tow-truck-hero.png');

/**
 * Dashboard hero: online/offline status + one-tap availability toggle.
 * Two-column flow layout (text column + truck image) so nothing can
 * overlap or overflow on narrow screens or large font settings.
 */
export function OnlineStatusCard({
  isOnline,
  onToggle,
}: {
  isOnline: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();

  return (
    <HeroCard style={{ paddingVertical: 18, paddingHorizontal: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: 8 }}>
        {/* Status copy + toggle */}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, lineHeight: 22, color: '#4B5563' }}>You are</Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
            <Text
              weight="medium"
              numberOfLines={1}
              style={{
                fontSize: 34,
                lineHeight: 44,
                flexShrink: 1,
                color: isOnline ? driverColors.online : theme.colors.textSecondary,
              }}
            >
              {isOnline ? 'Online' : 'Offline'}
            </Text>
            <View
              style={{
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: isOnline ? driverColors.onlineDot : theme.colors.textTertiary,
              }}
            />
          </View>

          <Text style={{ fontSize: 13, lineHeight: 18, color: '#4B5563', marginTop: 6 }}>
            {isOnline
              ? 'You will receive new tow requests'
              : "You're offline. Go online to receive requests"}
          </Text>

          <Pressable
            onPress={onToggle}
            accessibilityRole="button"
            accessibilityLabel={isOnline ? 'Go offline' : 'Go online'}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              alignSelf: 'flex-start',
              backgroundColor: theme.colors.card,
              borderRadius: 9999,
              paddingRight: 20,
              marginTop: 18,
              opacity: pressed ? 0.9 : 1,
              ...theme.shadows.card,
            })}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: driverColors.gold,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Power size={16} color="#FFFFFF" strokeWidth={2.6} />
            </View>
            <Text weight="medium" numberOfLines={1} style={{ fontSize: 13, marginLeft: 10 }}>
              {isOnline ? 'Go Offline' : 'Go Online'}
            </Text>
          </Pressable>
        </View>

        {/* Truck illustration — in normal flow, never overlaps the copy. */}
        <Image
          source={heroTruck}
          resizeMode="contain"
          style={{ width: '42%', aspectRatio: 414 / 228, alignSelf: 'center' }}
        />
      </View>
    </HeroCard>
  );
}

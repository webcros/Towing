import React from 'react';
import { Image, View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Text, Divider, Skeleton } from '@towing/ui';
import { Star } from '@/icons';
import { formatEta } from '@/utils/format';
import type { NearbyDriver } from '../types';

const driverTruck = require('@/assets/illustrations/driver-truck.png');

export function FeaturedDriverRow({ driver }: { driver: NearbyDriver }) {
  const theme = useTheme();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13 }}>
      <View
        style={{
          width: 63,
          height: 74,
          borderRadius: 11,
          backgroundColor: theme.colors.surface1,
          borderWidth: 1,
          borderColor: theme.colors.borderSubtle,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <Image source={driverTruck} resizeMode="contain" style={{ width: 52, height: 62 }} />
      </View>

      <View style={{ flex: 1, gap: 3 }}>
        <Text weight="semibold" numberOfLines={1} style={{ fontSize: 12.7, lineHeight: 16 }}>
          {driver.vehiclePlate}
        </Text>
        <Text color="secondary" numberOfLines={1} style={{ fontSize: 10.9, lineHeight: 16 }}>
          {driver.name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Star size={12.7} color={theme.colors.star} fill={theme.colors.star} />
          <Text weight="medium" tabular style={{ fontSize: 10.4 }}>
            {driver.rating.toFixed(1)}
          </Text>
        </View>
      </View>

      <Divider vertical inset={6} />

      <View style={{ alignItems: 'center', paddingLeft: 13, gap: 3 }}>
        <Text color="tertiary" uppercase style={{ fontSize: 9, letterSpacing: 0.3 }}>
          ETA
        </Text>
        <Text weight="semibold" tabular style={{ fontSize: 12.7 }}>
          {formatEta(driver.etaMinutes)}
        </Text>
      </View>
    </View>
  );
}

export function FeaturedDriverRowSkeleton() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13 }}>
      <Skeleton width={63} height={74} radius={11} />
      <View style={{ flex: 1, gap: 8 }}>
        <Skeleton width="55%" height={13} />
        <Skeleton width="40%" height={11} />
        <Skeleton width={44} height={11} />
      </View>
      <Skeleton width={46} height={30} radius={8} />
    </View>
  );
}

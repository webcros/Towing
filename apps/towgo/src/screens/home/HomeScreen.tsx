import React, { useCallback } from 'react';
import { View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Screen, OfflineBanner } from '@towing/ui';
import { AppHeader } from '@/components/AppHeader';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useLocationStore } from '@/features/location/locationStore';
import { HomeHero } from '@/features/home/components/HomeHero';
import { PickupLocationCard } from '@/features/home/components/PickupLocationCard';
import { NearbyTrucksSection } from '@/features/home/components/NearbyTrucksSection';
import { QuickActionsGrid } from '@/features/home/components/QuickActionsGrid';
import { SafetyPromiseBanner } from '@/features/home/components/SafetyPromiseBanner';
import type { QuickActionId } from '@/features/home/types';

export function HomeScreen() {
  const theme = useTheme();
  const online = useOnlineStatus();

  const status = useLocationStore((s) => s.status);
  const useCurrentLocation = useLocationStore((s) => s.useCurrentLocation);

  // Booking, notifications and quick actions land on screens not built yet.
  const notReady = useCallback(() => {}, []);
  const onQuickAction = useCallback((_id: QuickActionId) => {}, []);

  return (
    <Screen
      scroll
      edges={['top']}
      banner={<OfflineBanner visible={!online} />}
      contentContainerStyle={{ paddingBottom: theme.spacing.xxxl }}
    >
      <AppHeader />

      <HomeHero />

      <View style={{ paddingHorizontal: theme.spacing.xl, gap: theme.spacing.xl }}>
        <PickupLocationCard
          onBook={notReady}
          onUseCurrentLocation={useCurrentLocation}
          locating={status === 'locating'}
        />
        <NearbyTrucksSection isOnline={online} onViewAll={notReady} onRecenter={notReady} />
        <QuickActionsGrid onAction={onQuickAction} />
        <SafetyPromiseBanner onPress={notReady} />
      </View>
    </Screen>
  );
}

import React, { useCallback } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '@towing/theme';
import { Screen, OfflineBanner } from '@towing/ui';
import { AppHeader } from '@/components/AppHeader';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useLocationStore } from '@/features/location/locationStore';
import { HomeHero } from '@/features/home/components/HomeHero';
import { PickupMapCard } from '@/features/home/components/PickupMapCard';
import { QuickActionsGrid } from '@/features/home/components/QuickActionsGrid';
import { SafetyPromiseBanner } from '@/features/home/components/SafetyPromiseBanner';
import type { QuickActionId } from '@/features/home/types';
import type { RootStackParamList } from '@/navigation/types';

export function HomeScreen() {
  const theme = useTheme();
  const online = useOnlineStatus();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const status = useLocationStore((s) => s.status);
  const useCurrentLocation = useLocationStore((s) => s.useCurrentLocation);

  // Notifications / schedule / roadside / support land on screens not built yet.
  const notReady = useCallback(() => {}, []);
  const openBooking = useCallback(() => navigation.navigate('BookLocation'), [navigation]);
  const onQuickAction = useCallback(
    (id: QuickActionId) => {
      if (id === 'book') navigation.navigate('BookLocation');
    },
    [navigation],
  );

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
        <PickupMapCard
          onBook={openBooking}
          onUseCurrentLocation={useCurrentLocation}
          locating={status === 'locating'}
          isOnline={online}
        />
        <QuickActionsGrid onAction={onQuickAction} />
        <SafetyPromiseBanner onPress={notReady} />
      </View>
    </Screen>
  );
}

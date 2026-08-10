import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen, Text, ErrorState, EmptyState, OfflineBanner } from '@towing/ui';
import { MapPin, LocateFixed, Truck, RefreshCw } from '@/icons';
import { DriverHeader } from '@/components/DriverHeader';
import { IconChip } from '@/components/IconChip';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useTabBarSpace } from '@/navigation/DriverTabBar';
import { useCurrentOffer } from '@/features/offers/api/offers.queries';
import { OfferCard, OfferCardSkeleton } from '@/features/offers/components/OfferCard';
import { driverColors } from '@/theme/driverColors';
import { formatCountdown } from '@/utils/format';
import type { RootStackParamList } from '@/navigation/types';
import { Pressable } from '@/motion';

const INK = '#111827';

export function NewJobScreen() {
  const online = useOnlineStatus();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const tabBarSpace = useTabBarSpace();
  const { data, isPending, isError, refetch } = useCurrentOffer();

  const [locationEnabled, setLocationEnabled] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (data) setSecondsLeft(data.expiresInSeconds);
  }, [data]);

  useEffect(() => {
    const id = setInterval(() => {
      setSecondsLeft((s) => (s != null && s > 0 ? s - 1 : s));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const offer = declined ? null : data;

  return (
    <Screen
      scroll
      edges={['top']}
      banner={<OfflineBanner visible={!online} />}
      contentContainerStyle={{ paddingBottom: tabBarSpace }}
    >
      <DriverHeader
        leading="back"
        title="New Job"
        subtitle="New towing request near you"
        subtitleSize={14}
        bellBadge
        onLeading={() => navigation.navigate('Tabs', { screen: 'Home' })}
        onBell={() => navigation.navigate('Notifications')}
      />

      <View style={{ paddingHorizontal: 20, paddingTop: 3, gap: 12 }}>
        {!locationEnabled ? (
          <>
            {/* Location banner (Figma 78:221) */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                backgroundColor: driverColors.noticeBg,
                borderRadius: 15,
                padding: 14,
              }}
            >
              <IconChip icon={MapPin} bg="#FFFFFF" fg={driverColors.amber} size={44} iconSize={20} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontSize: 14, lineHeight: 20 }}>
                  Enable location to find nearby jobs
                </Text>
                <Text color="secondary" style={{ fontSize: 13, lineHeight: 17 }}>
                  We'll show the best jobs near your location.
                </Text>
              </View>
            </View>

            {/* Enable Location CTA (Figma 78:230) */}
            <Pressable
              onPress={() => setLocationEnabled(true)}
              accessibilityRole="button"
              accessibilityLabel="Enable location"
              style={() => ({
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                backgroundColor: driverColors.amber,
                borderRadius: 11,
                paddingVertical: 11,
              })}
            >
              <LocateFixed size={15} color={INK} strokeWidth={2.2} />
              <Text style={{ fontSize: 14, lineHeight: 22, color: INK }}>Enable Location</Text>
            </Pressable>
          </>
        ) : null}

        {isPending ? (
          <OfferCardSkeleton />
        ) : isError ? (
          <ErrorState title="Couldn't load new requests" onRetry={() => refetch()} icon={RefreshCw} />
        ) : !offer ? (
          <EmptyState
            icon={Truck}
            title="No new requests"
            body="New tow requests will appear here when you're online."
          />
        ) : (
          <OfferCard
            offer={offer}
            expiresLabel={formatCountdown(secondsLeft ?? offer.expiresInSeconds)}
            onAccept={() => navigation.navigate('ActiveJob', { offerId: offer.id })}
            onDecline={() => setDeclined(true)}
          />
        )}
      </View>
    </Screen>
  );
}

import React, { useCallback } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '@towing/theme';
import { Screen, Text, OfflineBanner, EmptyState, ErrorState } from '@towing/ui';
import { ClipboardList } from '@/icons';
import { AppHeader } from '@/components/AppHeader';
import { useCollapsingHeader } from '@/motion';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useTabBarSpace } from '@/navigation/TabBar';
import { useBookings } from '@/features/bookings/api/bookings.queries';
import { BookingCard, BookingCardSkeleton } from '@/features/bookings/components/BookingCard';
import type { BookingsStackParamList } from '@/navigation/types';

export function BookingsScreen() {
  const theme = useTheme();
  const tabBarSpace = useTabBarSpace();
  const { scrollY, screenProps } = useCollapsingHeader();
  const online = useOnlineStatus();
  const navigation = useNavigation<NativeStackNavigationProp<BookingsStackParamList>>();
  const { data, isPending, isError, refetch } = useBookings();

  const openBooking = useCallback(
    (bookingId: string) => navigation.navigate('BookingDetails', { bookingId }),
    [navigation],
  );

  let content: React.ReactNode;
  if (isPending) {
    content = (
      <View style={{ gap: theme.spacing.xxl }}>
        <BookingCardSkeleton />
        <BookingCardSkeleton />
        <BookingCardSkeleton />
      </View>
    );
  } else if (isError) {
    content = (
      <View style={{ paddingTop: theme.spacing.xl }}>
        <ErrorState
          title="Couldn't load your bookings"
          body="Check your connection and try again."
          onRetry={() => refetch()}
        />
      </View>
    );
  } else if (!data || data.length === 0) {
    content = (
      <View style={{ paddingTop: theme.spacing.xl }}>
        <EmptyState
          icon={ClipboardList}
          title="No bookings yet"
          body="Your trips will show up here — help is one tap away."
        />
      </View>
    );
  } else {
    // 24 clears the status badge (10px overhang) and keeps the gap between cards
    // larger than the 16 inside them -- equal or tighter reads as one mushy block.
    content = (
      <View style={{ gap: theme.spacing.xxl }}>
        {data.map((booking) => (
          <BookingCard
            key={booking.id}
            booking={booking}
            onPress={() => openBooking(booking.id)}
          />
        ))}
      </View>
    );
  }

  return (
    <Screen
      scroll
      edges={['top']}
      banner={<OfflineBanner visible={!online} />}
      header={<AppHeader scrollY={scrollY} title="My Bookings" />}
      contentContainerStyle={{ paddingBottom: tabBarSpace }}
      {...screenProps}
    >
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 }}>
        <Text variant="h1" weight="semibold">
          My Bookings
        </Text>
        <Text variant="body" color="secondary" style={{ marginTop: 2 }}>
          Your past booking history
        </Text>
      </View>

      <View style={{ paddingHorizontal: 20 }}>
        {content}
      </View>
    </Screen>
  );
}

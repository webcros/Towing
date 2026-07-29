import React, { useCallback } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '@towing/theme';
import { Screen, Text, OfflineBanner, EmptyState, ErrorState } from '@towing/ui';
import { ClipboardList } from '@/icons';
import { AppHeader } from '@/components/AppHeader';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useBookings } from '@/features/bookings/api/bookings.queries';
import { BookingCard, BookingCardSkeleton } from '@/features/bookings/components/BookingCard';
import type { BookingsStackParamList } from '@/navigation/types';

export function BookingsScreen() {
  const theme = useTheme();
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
      <View style={{ gap: 16 }}>
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
    content = (
      <View style={{ gap: 16 }}>
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
      contentContainerStyle={{ paddingBottom: theme.spacing.xxxl }}
    >
      <AppHeader />

      <View style={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16 }}>
        <Text weight="semibold" style={{ fontSize: 28, lineHeight: 32, letterSpacing: -0.6 }}>
          My Bookings
        </Text>
        <Text color="secondary" style={{ fontSize: 15, lineHeight: 22, marginTop: 4 }}>
          Your past booking history
        </Text>
      </View>

      <View style={{ paddingHorizontal: 16 }}>{content}</View>
    </Screen>
  );
}

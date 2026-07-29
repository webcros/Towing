import React, { useCallback } from 'react';
import { View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '@towing/theme';
import { Screen, Text, OfflineBanner, EmptyState, ErrorState, Skeleton } from '@towing/ui';
import { Headphones, ClipboardList } from '@/icons';
import { BackButton } from '@/components/BackButton';
import { SectionHeading } from '@/components/SectionHeading';
import { SettingsList } from '@/components/SettingsList';
import { SettingsRow } from '@/components/SettingsRow';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useBooking } from '@/features/bookings/api/bookings.queries';
import { BookingTripCard } from '@/features/bookings/components/BookingTripCard';
import { BookingSummaryCard } from '@/features/bookings/components/BookingSummaryCard';
import { BookingDetailSkeleton } from '@/features/bookings/components/BookingDetailSkeleton';
import { DriverInfoCard } from '@/features/booking/components/DriverInfoCard';
import { towTypes } from '@/features/booking/data/towTypes.data';
import type { BookingsStackParamList, RootStackParamList } from '@/navigation/types';

export function BookingDetailsScreen() {
  const theme = useTheme();
  const online = useOnlineStatus();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<BookingsStackParamList, 'BookingDetails'>>();
  const { bookingId } = route.params;

  const { data, isPending, isError, refetch } = useBooking(bookingId);

  const goBack = useCallback(() => navigation.goBack(), [navigation]);
  const openSupport = useCallback(() => navigation.navigate('ContactUs'), [navigation]);
  const notReady = useCallback(() => {}, []);

  const towName = data ? (towTypes.find((t) => t.id === data.towTypeId)?.name ?? 'Tow') : '';

  let content: React.ReactNode;
  if (isPending) {
    content = <BookingDetailSkeleton />;
  } else if (isError) {
    content = (
      <View style={{ paddingTop: theme.spacing.xl }}>
        <ErrorState
          title="Couldn't load this booking"
          body="Check your connection and try again."
          onRetry={() => refetch()}
        />
      </View>
    );
  } else if (!data) {
    content = (
      <View style={{ paddingTop: theme.spacing.xl }}>
        <EmptyState
          icon={ClipboardList}
          title="Booking not found"
          body="This booking may have been removed."
          actionLabel="Back to bookings"
          onAction={goBack}
        />
      </View>
    );
  } else {
    content = (
      <>
        <BookingTripCard booking={data} towName={towName} />

        <View style={{ gap: 12 }}>
          <SectionHeading title="Driver Details" />
          <DriverInfoCard
            driver={{
              name: data.driverName,
              photo: data.driverPhoto,
              rating: data.driverRating,
              trips: data.driverTrips,
              vehiclePlate: data.vehiclePlate,
            }}
            vehicleLabel={`${towName} Tow Truck`}
            onCall={notReady}
            onMessage={notReady}
          />
        </View>

        <View style={{ gap: 12 }}>
          <SectionHeading title="Booking Summary" />
          <BookingSummaryCard booking={data} />
        </View>

        <View style={{ gap: 12 }}>
          <SectionHeading title="Help & Support" />
          <SettingsList>
            <SettingsRow
              icon={Headphones}
              title="Need Help?"
              subtitle="Get support for this booking"
              trailing="chevron"
              onPress={openSupport}
            />
          </SettingsList>
        </View>
      </>
    );
  }

  return (
    <Screen
      scroll
      edges={['top']}
      banner={<OfflineBanner visible={!online} />}
      contentContainerStyle={{ paddingBottom: theme.spacing.xxxl }}
    >
      <View style={{ paddingHorizontal: 20, paddingTop: 4, gap: 16 }}>
        {/* Boxed back button overlaid on a centred two-line title. */}
        <View style={{ position: 'relative', minHeight: 48, justifyContent: 'center' }}>
          <BackButton onPress={goBack} style={{ position: 'absolute', left: 0, top: 0 }} />
          <View style={{ alignItems: 'center', gap: 2, paddingHorizontal: 54 }}>
            <Text weight="bold" align="center" numberOfLines={1} style={{ fontSize: 20, lineHeight: 26 }}>
              Booking Details
            </Text>
            {data ? (
              <Text color="secondary" align="center" style={{ fontSize: 13, lineHeight: 18 }}>
                Booking ID: {data.reference}
              </Text>
            ) : isPending ? (
              <Skeleton width={140} height={13} />
            ) : null}
          </View>
        </View>

        {content}
      </View>
    </Screen>
  );
}

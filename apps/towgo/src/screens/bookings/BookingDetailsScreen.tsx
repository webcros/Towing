import React, { useCallback } from 'react';
import { View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '@towing/theme';
import {
  Screen,
  Text,
  OfflineBanner,
  EmptyState,
  ErrorState,
  IconButton,
} from '@towing/ui';
import {
  Headphones,
  ClipboardList,
  Truck,
  Clock,
  Route,
  IndianRupee,
  Receipt,
  ShieldCheck,
  ArrowLeft,
} from '@/icons';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useTabBarSpace } from '@/navigation/TabBar';
import { useBooking } from '@/features/bookings/api/bookings.queries';
import { BookingHero } from '@/features/bookings/components/BookingHero';
import { RouteRows } from '@/features/bookings/components/RouteRows';
import { DetailRow, RowDivider } from '@/components/DetailRow';
import { BookingDetailSkeleton } from '@/features/bookings/components/BookingDetailSkeleton';
import { PAYMENT_LABEL } from '@/features/bookings/labels';
import { towTypes } from '@/features/booking/data/towTypes.data';
import { formatEta, formatPaise } from '@/utils/format';
import type { BookingsStackParamList, RootStackParamList } from '@/navigation/types';

/**
 * Booking details.
 *
 * Structured as one flat list rather than a stack of cards. Nesting bordered,
 * shadowed cards inside a bordered page is what made this screen read as
 * cluttered: every card boundary is a line the eye has to parse before it gets
 * to the content. Here a single 24pt heading carries the hierarchy, every row
 * shares one icon column, and hairlines do the grouping.
 */
export function BookingDetailsScreen() {
  const theme = useTheme();
  const tabBarSpace = useTabBarSpace();
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
        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="h1">Booking details</Text>
          <Text variant="caption" color="secondary">
            {data.reference}
          </Text>
        </View>

        <BookingHero
          booking={data}
          towName={towName}
          onCall={notReady}
          onMessage={notReady}
        />

        <View>
          <RowDivider />
          <RouteRows booking={data} />

          <RowDivider />
          <DetailRow icon={Truck} label="Tow type" value={`${towName} tow truck`} />
          {/*
            Duration, distance and payment are unknown until the trip has run —
            a searching booking legitimately has none of them. An omitted row
            reads better than "null km", and §10.9's feedback states are about
            not pretending to know things.
          */}
          {data.durationMinutes !== null ? (
            <>
              <RowDivider />
              <DetailRow
                icon={Clock}
                label="Duration"
                value={formatEta(data.durationMinutes)}
                tabular
              />
            </>
          ) : null}
          {data.distanceKm !== null ? (
            <>
              <RowDivider />
              <DetailRow icon={Route} label="Distance" value={`${data.distanceKm} km`} tabular />
            </>
          ) : null}
          {data.paymentMethod ? (
            <>
              <RowDivider />
              <DetailRow
                icon={IndianRupee}
                label="Payment"
                value={PAYMENT_LABEL[data.paymentMethod]}
              />
            </>
          ) : null}
          <RowDivider />
          <DetailRow
            icon={Receipt}
            label={data.status === 'paid' ? 'Total paid' : 'Total'}
            value={formatPaise(data.farePaise)}
            strong
            tabular
          />
          <RowDivider />
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="h2">Help &amp; support</Text>
          <View>
            <DetailRow
              icon={Headphones}
              label="Need help?"
              description="Get support for this booking"
              chevron
              onPress={openSupport}
            />
            <RowDivider />
            <DetailRow
              icon={ShieldCheck}
              label="Report an issue"
              description="Tell us what went wrong on this trip"
              chevron
              onPress={openSupport}
            />
          </View>
        </View>
      </>
    );
  }

  return (
    <Screen
      scroll
      edges={['top']}
      banner={<OfflineBanner visible={!online} />}
      contentContainerStyle={{ paddingBottom: tabBarSpace }}
    >
      {/* Sections sit 28 apart — comfortably more than the 14 of padding inside a
          row, so each group reads as its own block without needing a border. */}
      <View style={{ paddingHorizontal: 20, paddingTop: theme.spacing.xs, gap: 28 }}>
        {/* Back sits on its own line, left-aligned. A centred title with a floating
            action over it read as an accident rather than a layout. */}
        <View style={{ flexDirection: 'row' }}>
          <IconButton icon={ArrowLeft} label="Go back" onPress={goBack} variant="surface" />
        </View>

        {content}
      </View>
    </Screen>
  );
}

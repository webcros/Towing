import React, { useCallback } from 'react';
import { View } from 'react-native';
import { Screen, Text, OfflineBanner, EmptyState, ErrorState } from '@towing/ui';
import { AppHeader } from '@/components/AppHeader';
import { useCollapsingHeader } from '@/motion';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useTabBarSpace } from '@/navigation/TabBar';
import { useServices } from '@/features/services/api/services.queries';
import { ServiceCardSkeleton } from '@/features/services/components/ServiceCardSkeleton';
import { useBookingStore } from '@/features/booking/store/bookingStore';
import { track } from '@/lib/analytics/analytics';
import { ServicesHero } from '@/features/services/components/ServicesHero';
import { ServiceCard } from '@/features/services/components/ServiceCard';
import { SupportBanner } from '@/features/services/components/SupportBanner';

export function ServicesScreen() {
  const tabBarSpace = useTabBarSpace();
  const { scrollY, screenProps } = useCollapsingHeader();
  const online = useOnlineStatus();

  const { data: services, isPending, isError, refetch } = useServices();
  const setServiceSlug = useBookingStore((s) => s.setServiceSlug);

  /**
   * §22.1 `service_selected`, and the first thing in the app that actually
   * chooses a service: the handler was `(_id) => {}` — an empty function on
   * every card. Choosing now writes the slug the booking flow prices against.
   * Navigation into the booking flow from here is Phase 15's job; this makes the
   * selection real and measurable, which is what the funnel needs at launch.
   */
  const openService = useCallback(
    (slug: string) => {
      setServiceSlug(slug);
      track('service_selected', { slug });
    },
    [setServiceSlug],
  );
  const contactSupport = useCallback(() => {}, []);

  return (
    <Screen
      scroll
      edges={['top']}
      banner={<OfflineBanner visible={!online} />}
      header={<AppHeader scrollY={scrollY} />}
      contentContainerStyle={{ paddingBottom: tabBarSpace }}
      {...screenProps}
    >
      <ServicesHero />

      {/* Figma 21:2 rhythm — heading 20/30, 16 to first card, 12 between cards, 22 to banner */}
      <View style={{ paddingHorizontal: 20, gap: 12 }}>
        <Text
          weight="semibold"
          style={{ fontSize: 20, lineHeight: 30, letterSpacing: -0.2, marginBottom: 4 }}
        >
          Our Services
        </Text>

        {isPending ? (
          // §10.8 — skeletons, never spinners. Three, matching the count above
          // the fold.
          <>
            <ServiceCardSkeleton />
            <ServiceCardSkeleton />
            <ServiceCardSkeleton />
          </>
        ) : isError ? (
          <ErrorState onRetry={refetch} />
        ) : services.length === 0 ? (
          <EmptyState title="No services available" body="Please try again shortly." />
        ) : (
          services.map((service) => (
            <ServiceCard
              key={service.slug}
              service={service}
              onPress={() => openService(service.slug)}
            />
          ))
        )}

        <View style={{ marginTop: 10 }}>
          <SupportBanner onContact={contactSupport} />
        </View>
      </View>
    </Screen>
  );
}

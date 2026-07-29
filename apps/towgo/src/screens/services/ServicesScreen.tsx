import React, { useCallback } from 'react';
import { View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Screen, Text, OfflineBanner } from '@towing/ui';
import { AppHeader } from '@/components/AppHeader';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { services, type ServiceId } from '@/features/services/data/services.data';
import { ServicesHero } from '@/features/services/components/ServicesHero';
import { ServiceCard } from '@/features/services/components/ServiceCard';
import { SupportBanner } from '@/features/services/components/SupportBanner';

export function ServicesScreen() {
  const theme = useTheme();
  const online = useOnlineStatus();

  // Service detail / booking flow and support are future screens.
  const openService = useCallback((_id: ServiceId) => {}, []);
  const contactSupport = useCallback(() => {}, []);

  return (
    <Screen
      scroll
      edges={['top']}
      banner={<OfflineBanner visible={!online} />}
      contentContainerStyle={{ paddingBottom: theme.spacing.xxxl }}
    >
      <AppHeader />

      <ServicesHero />

      {/* Figma 21:2 rhythm — heading 20/30, 16 to first card, 12 between cards, 22 to banner */}
      <View style={{ paddingHorizontal: 20, gap: 12 }}>
        <Text
          weight="semibold"
          style={{ fontSize: 20, lineHeight: 30, letterSpacing: -0.2, marginBottom: 4 }}
        >
          Our Services
        </Text>

        {services.map((service) => (
          <ServiceCard
            key={service.id}
            service={service}
            onPress={() => openService(service.id)}
          />
        ))}

        <View style={{ marginTop: 10 }}>
          <SupportBanner onContact={contactSupport} />
        </View>
      </View>
    </Screen>
  );
}

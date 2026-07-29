import React, { useCallback } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '@towing/theme';
import { BackButton } from '@/components/BackButton';
import { useBookingStore } from '@/features/booking/store/bookingStore';
import { towTypes } from '@/features/booking/data/towTypes.data';
import { assignedDriverMock } from '@/features/booking/data/assignedDriver.mock';
import { TrackingMapCard } from '@/features/booking/components/TrackingMapCard';
import { DriverInfoCard } from '@/features/booking/components/DriverInfoCard';
import { EtaStatusCard } from '@/features/booking/components/EtaStatusCard';
import { RequestDetailsCard } from '@/features/booking/components/RequestDetailsCard';
import { TrustBanner } from '@/features/booking/components/TrustBanner';
import type { RootStackParamList } from '@/navigation/types';

export function TrackingScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const towTypeId = useBookingStore((s) => s.towTypeId);
  const towName = towTypes.find((t) => t.id === towTypeId)?.name ?? 'Tow';
  const vehicleLabel = `${towName} Tow Truck`;

  const goHome = useCallback(() => navigation.popToTop(), [navigation]);
  const notReady = useCallback(() => {}, []);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface0 }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 28, gap: 16 }}
          showsVerticalScrollIndicator={false}
        >
          <BackButton onPress={goHome} />

          <TrackingMapCard />

          <DriverInfoCard
            driver={assignedDriverMock}
            vehicleLabel={vehicleLabel}
            onCall={notReady}
            onMessage={notReady}
          />

          <EtaStatusCard etaMinutes={assignedDriverMock.etaMinutes} />

          <RequestDetailsCard onCancel={goHome} />

          <TrustBanner />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

import React from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { VehicleCategory } from '@towing/api-contracts';
import { Button, EmptyState, Skeleton, ErrorState } from '@towing/ui';
import { CarFront, Plus, RefreshCw } from '@/icons';
import { SubScreen } from '@/components/SubScreen';
import { SettingsList } from '@/components/SettingsList';
import { SettingsRow } from '@/components/SettingsRow';
import { useVehicles } from '@/features/account/api/vehicles.queries';
import type { RootStackParamList } from '@/navigation/types';

const typeLabel: Record<VehicleCategory, string> = {
  hatchback: 'Hatchback',
  sedan: 'Sedan',
  suv: 'SUV',
  muv: 'MUV',
  luxury: 'Luxury',
  bike: 'Bike',
  other: 'Other',
};

export function MyVehiclesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { data: vehicles, isPending, isError, refetch } = useVehicles();

  return (
    <SubScreen
      title="My Vehicles"
      footer={
        <Button
          label="Add Vehicle"
          leftIcon={Plus}
          fullWidth
          onPress={() => navigation.navigate('AddVehicle')}
        />
      }
    >
      {isError ? (
        <ErrorState title="Couldn't load your vehicles" onRetry={() => refetch()} icon={RefreshCw} />
      ) : isPending || !vehicles ? (
        <>
          <Skeleton width="100%" height={72} radius={12} />
          <Skeleton width="100%" height={72} radius={12} />
        </>
      ) : vehicles.length === 0 ? (
        <EmptyState icon={CarFront} title="No vehicles yet" body="Add a vehicle to book a tow faster." />
      ) : (
        <SettingsList>
          {vehicles.map((v) => (
            <SettingsRow
              key={v.id}
              icon={CarFront}
              title={v.makeModel ?? typeLabel[v.type]}
              subtitle={[v.plate, typeLabel[v.type]].filter(Boolean).join(' · ')}
              trailing="chevron"
              onPress={() => navigation.navigate('AddVehicle', { vehicleId: v.id })}
            />
          ))}
        </SettingsList>
      )}
    </SubScreen>
  );
}

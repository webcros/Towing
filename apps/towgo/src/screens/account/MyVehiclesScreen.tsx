import React from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, EmptyState } from '@towing/ui';
import { CarFront, Plus } from '@/icons';
import { SubScreen } from '@/components/SubScreen';
import { SettingsList } from '@/components/SettingsList';
import { SettingsRow } from '@/components/SettingsRow';
import { useVehiclesStore } from '@/features/account/store/vehiclesStore';
import type { VehicleType } from '@/features/account/types';
import type { RootStackParamList } from '@/navigation/types';

const typeLabel: Record<VehicleType, string> = { wheel_lift: 'Wheel-lift', flatbed: 'Flatbed' };

export function MyVehiclesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const vehicles = useVehiclesStore((s) => s.vehicles);

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
      {vehicles.length === 0 ? (
        <EmptyState icon={CarFront} title="No vehicles yet" body="Add a vehicle to book a tow faster." />
      ) : (
        <SettingsList>
          {vehicles.map((v) => (
            <SettingsRow
              key={v.id}
              icon={CarFront}
              title={v.makeModel}
              subtitle={`${v.plate} · ${typeLabel[v.type]}`}
              trailing="chevron"
              onPress={() => navigation.navigate('AddVehicle', { vehicleId: v.id })}
            />
          ))}
        </SettingsList>
      )}
    </SubScreen>
  );
}

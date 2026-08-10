import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '@towing/theme';
import { Screen, Text, Button, Card, ListRow } from '@towing/ui';
import { ApiClientError } from '@/lib/api/errors';
import { DriverHeader } from '@/components/DriverHeader';
import { Toggle } from '@/components/Toggle';
import { Route } from '@/icons';
import { useTabBarSpace } from '@/navigation/DriverTabBar';
import { useUpdateCapabilities } from '@/features/capabilities/api/capabilities.queries';
import { VEHICLE_CLASS_OPTIONS, type VehicleClass } from '@/features/capabilities/types';
import type { RootStackParamList } from '@/navigation/types';

/**
 * Replaces the `MyVehicles` placeholder. There is no read endpoint yet (see
 * `capabilities.queries.ts`), so this starts blank rather than pretending to
 * show a saved value it cannot fetch.
 */
export function CapabilitiesScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const tabBarSpace = useTabBarSpace();
  const [vehicleClass, setVehicleClass] = useState<VehicleClass | null>(null);
  const [longDistanceEnabled, setLongDistanceEnabled] = useState(false);
  const update = useUpdateCapabilities();

  const onSave = async () => {
    if (!vehicleClass) return;
    try {
      const result = await update.mutateAsync({
        vehicleClass,
        // Only flatbeds do long-haul (spec) — never send the flag true for a
        // wheel-lift pick, even if it was left on from a prior selection.
        longDistanceEnabled: vehicleClass === 'flatbed' ? longDistanceEnabled : false,
      });
      setVehicleClass(result.vehicleClass);
      setLongDistanceEnabled(result.longDistanceEnabled);
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 403) {
        const reason = (error.details as { reason?: string } | undefined)?.reason;
        if (reason === 'kyc_not_approved') {
          Alert.alert(
            'Verification required',
            'Your KYC approval is no longer active. Please check your verification status.',
            [{ text: 'OK', onPress: () => navigation.navigate('KycStatus') }],
          );
          return;
        }
      }
      Alert.alert('Could not save', error instanceof Error ? error.message : 'Something went wrong.');
    }
  };

  return (
    <Screen scroll edges={['top']} contentContainerStyle={{ paddingBottom: tabBarSpace }}>
      <DriverHeader leading="back" title="Capabilities" titleSize={22} showBell={false} onLeading={() => navigation.goBack()} />

      <View style={{ paddingHorizontal: 20, gap: 20 }}>
        <View style={{ gap: 10 }}>
          <Text weight="semibold" style={{ fontSize: 15 }}>
            Vehicle class
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {VEHICLE_CLASS_OPTIONS.map((option) => {
              const selected = vehicleClass === option.value;
              return (
                <Card
                  key={option.value}
                  onPress={() => setVehicleClass(option.value)}
                  style={{
                    flex: 1,
                    borderColor: selected ? theme.colors.brand : theme.colors.borderSubtle,
                    borderWidth: selected ? 2 : 1,
                  }}
                  accessibilityLabel={option.label}
                >
                  <Text weight={selected ? 'semibold' : 'regular'} align="center">
                    {option.label}
                  </Text>
                </Card>
              );
            })}
          </View>
        </View>

        {vehicleClass === 'flatbed' ? (
          <ListRow
            leading={<Route size={20} color={theme.colors.textPrimary} />}
            title="Long-distance jobs"
            subtitle="Get offered long-haul tows outside your city"
            trailing={<Toggle value={longDistanceEnabled} onValueChange={setLongDistanceEnabled} />}
          />
        ) : null}

        {update.isError && !(update.error instanceof ApiClientError && update.error.status === 403) ? (
          <Text color="error" style={{ fontSize: 13 }}>
            {update.error instanceof Error ? update.error.message : 'Could not save — try again.'}
          </Text>
        ) : null}

        <Button
          label="Save"
          fullWidth
          disabled={!vehicleClass || update.isPending}
          loading={update.isPending}
          onPress={onSave}
        />
      </View>
    </Screen>
  );
}

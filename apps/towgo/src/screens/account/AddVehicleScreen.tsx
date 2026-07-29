import React, { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useTheme } from '@towing/theme';
import { Button, Text } from '@towing/ui';
import { Camera, Trash2 } from '@/icons';
import { SubScreen } from '@/components/SubScreen';
import { TextField } from '@/components/TextField';
import { useVehiclesStore } from '@/features/account/store/vehiclesStore';
import type { VehicleType } from '@/features/account/types';
import type { RootStackParamList } from '@/navigation/types';

const TYPES: { value: VehicleType; label: string; hint: string }[] = [
  { value: 'wheel_lift', label: 'Wheel-lift', hint: 'Cars, hatchbacks' },
  { value: 'flatbed', label: 'Flatbed', hint: 'SUVs, luxury, EVs' },
];

export function AddVehicleScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'AddVehicle'>>();
  const vehicleId = route.params?.vehicleId;

  const addVehicle = useVehiclesStore((s) => s.addVehicle);
  const updateVehicle = useVehiclesStore((s) => s.updateVehicle);
  const removeVehicle = useVehiclesStore((s) => s.removeVehicle);
  const existing = vehicleId
    ? useVehiclesStore.getState().vehicles.find((v) => v.id === vehicleId)
    : undefined;

  const [type, setType] = useState<VehicleType>(existing?.type ?? 'wheel_lift');
  const [makeModel, setMakeModel] = useState(existing?.makeModel ?? '');
  const [plate, setPlate] = useState(existing?.plate ?? '');
  const [color, setColor] = useState(existing?.color ?? '');

  const notReady = useCallback(() => {}, []);
  const canSave = makeModel.trim().length > 0 && plate.trim().length > 0;
  const save = () => {
    const data = { type, makeModel: makeModel.trim(), plate: plate.trim(), color: color.trim() };
    if (vehicleId) updateVehicle(vehicleId, data);
    else addVehicle(data);
    navigation.goBack();
  };
  const del = () => {
    if (vehicleId) removeVehicle(vehicleId);
    navigation.goBack();
  };

  return (
    <SubScreen
      title={vehicleId ? 'Edit Vehicle' : 'Add Vehicle'}
      footer={<Button label="Save Vehicle" fullWidth disabled={!canSave} onPress={save} />}
    >
      <View style={{ gap: 7 }}>
        <Text weight="medium" style={{ fontSize: 13, lineHeight: 17, color: theme.colors.textSecondary }}>
          Vehicle type
        </Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {TYPES.map((t) => {
            const selected = type === t.value;
            return (
              <Pressable
                key={t.value}
                onPress={() => setType(t.value)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={{
                  flex: 1,
                  borderRadius: 12,
                  borderWidth: 1.5,
                  borderColor: selected ? theme.colors.brand : theme.colors.border,
                  backgroundColor: selected ? theme.colors.brandTint : theme.colors.card,
                  padding: 12,
                  gap: 2,
                }}
              >
                <Text weight="semibold" style={{ fontSize: 14, lineHeight: 19 }}>
                  {t.label}
                </Text>
                <Text color="secondary" style={{ fontSize: 12, lineHeight: 16 }}>
                  {t.hint}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <TextField label="Make & Model" value={makeModel} onChangeText={setMakeModel} placeholder="e.g. Maruti Swift" autoCapitalize="words" />
      <TextField label="Number Plate" value={plate} onChangeText={setPlate} placeholder="KA 01 AB 1234" autoCapitalize="characters" />
      <TextField label="Color" value={color} onChangeText={setColor} placeholder="e.g. White" autoCapitalize="words" />

      <Pressable
        onPress={notReady}
        accessibilityRole="button"
        accessibilityLabel="Upload RC document"
        style={{
          borderRadius: 12,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: theme.colors.borderStrong,
          paddingVertical: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        <Camera size={18} color={theme.colors.textSecondary} />
        <Text color="secondary" style={{ fontSize: 13.5 }}>
          Upload RC (optional)
        </Text>
      </Pressable>

      {vehicleId ? (
        <Pressable
          onPress={del}
          accessibilityRole="button"
          accessibilityLabel="Delete vehicle"
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            height: 48,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.colors.error,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Trash2 size={17} color={theme.colors.error} />
          <Text weight="semibold" style={{ fontSize: 14.5, color: theme.colors.error }}>
            Delete Vehicle
          </Text>
        </Pressable>
      ) : null}
    </SubScreen>
  );
}

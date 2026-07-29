import type { ImageSourcePropType } from 'react-native';

export type AssignedDriver = {
  name: string;
  photo: ImageSourcePropType;
  rating: number;
  trips: number;
  vehiclePlate: string;
  etaMinutes: number;
};

// Placeholder assigned driver (real driver + photo come from the backend).
export const assignedDriverMock: AssignedDriver = {
  name: 'Ramesh Kumar',
  photo: require('@/assets/illustrations/avatar-placeholder.png'),
  rating: 4.8,
  trips: 128,
  vehiclePlate: 'KA 03 AB 1234',
  etaMinutes: 12,
};

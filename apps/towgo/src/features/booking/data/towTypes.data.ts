import type { TowType } from '../types';

// Static catalog for v1 (Figma 31:66). Prices become the estimate API later
// (spec §7.6 — fare matrix by vehicle class + distance).
export const towTypes: TowType[] = [
  {
    id: 'light',
    name: 'Light Duty',
    categories: 'Cars, Hatchbacks',
    price: 1250,
    comparePrice: 1450,
    image: require('@/assets/illustrations/tow-light.png'),
  },
  {
    id: 'medium',
    name: 'Medium Duty',
    categories: 'SUVs, MUVs',
    price: 1850,
    comparePrice: 2100,
    image: require('@/assets/illustrations/tow-medium.png'),
  },
  {
    id: 'heavy',
    name: 'Heavy Duty',
    categories: 'Trucks, Buses',
    price: 2950,
    comparePrice: 3200,
    image: require('@/assets/illustrations/tow-heavy.png'),
  },
  {
    id: 'euro',
    name: 'Euro Duty',
    categories: 'Rigs',
    price: 4500,
    image: require('@/assets/illustrations/tow-heavy.png'),
    disabled: true,
  },
];

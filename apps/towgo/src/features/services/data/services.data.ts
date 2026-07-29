import type { ImageSourcePropType } from 'react-native';
import type { IconComponent } from '@towing/ui';
import { BatteryCharging, LifeBuoy, Fuel, Lock, Cable } from '@/icons';

export type ServiceId =
  | 'towing'
  | 'jump_start'
  | 'tyre_change'
  | 'fuel_delivery'
  | 'lockout'
  | 'winch_out';

export type Service = {
  id: ServiceId;
  title: string;
  description: string;
  /** Branded illustration (preferred when available) … */
  image?: ImageSourcePropType;
  /** … or a line icon fallback, rendered in the amber tint circle. */
  icon?: IconComponent;
};

// Static UI config for the Services tab (catalog API comes later).
export const services: Service[] = [
  {
    id: 'towing',
    title: 'Towing Services',
    description: 'Professional towing for all types of vehicles. Local or long distance.',
    image: require('@/assets/icons/qa-tow.png'),
  },
  {
    id: 'jump_start',
    title: 'Jump Start',
    description: "We'll jump start your vehicle and get you back on the road.",
    icon: BatteryCharging,
  },
  {
    id: 'tyre_change',
    title: 'Tyre Change',
    description: 'Flat tyre? Our experts will change it quickly and safely.',
    icon: LifeBuoy,
  },
  {
    id: 'fuel_delivery',
    title: 'Fuel Delivery',
    description: "Out of fuel? We'll deliver fuel to get you moving.",
    icon: Fuel,
  },
  {
    id: 'lockout',
    title: 'Lockout Assistance',
    description: "Locked out of your vehicle? We'll help you get back in.",
    icon: Lock,
  },
  {
    id: 'winch_out',
    title: 'Winch Out',
    description: "Stuck in a ditch or mud? We'll winch you out safely.",
    icon: Cable,
  },
];

import type { ImageSourcePropType } from 'react-native';
import type { QuickActionId } from '../types';

export type QuickAction = {
  id: QuickActionId;
  label: string;
  image: ImageSourcePropType;
};

// Static UI config (spec §9.1.4). Icons are the branded Figma illustrations.
export const quickActions: QuickAction[] = [
  { id: 'book', label: 'Book a Tow', image: require('@/assets/icons/qa-tow.png') },
  { id: 'schedule', label: 'Schedule a Tow', image: require('@/assets/icons/qa-schedule.png') },
  { id: 'roadside', label: 'Roadside Assistance', image: require('@/assets/icons/qa-roadside.png') },
  { id: 'support', label: '24/7 Support', image: require('@/assets/icons/qa-support.png') },
];

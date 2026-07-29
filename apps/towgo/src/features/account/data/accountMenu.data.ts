import {
  User,
  CarFront,
  MapPin,
  CreditCard,
  Bell,
  CircleHelp,
  Headphones,
  Settings,
} from '@/icons';
import type { AccountMenuItem } from '../types';

// Static menu config (Figma 21:283). Targets are future screens.
export const accountItems: AccountMenuItem[] = [
  {
    id: 'personal_info',
    title: 'Personal Information',
    subtitle: 'Manage your personal details',
    icon: User,
  },
  {
    id: 'vehicles',
    title: 'My Vehicles',
    subtitle: 'Add or manage your vehicles',
    icon: CarFront,
  },
  {
    id: 'saved_locations',
    title: 'Saved Locations',
    subtitle: 'Home, Work and other locations',
    icon: MapPin,
  },
  {
    id: 'payment_methods',
    title: 'Payment Methods',
    subtitle: 'Manage cards and wallets',
    icon: CreditCard,
  },
];

export const supportItems: AccountMenuItem[] = [
  {
    id: 'notifications',
    title: 'Notifications',
    subtitle: 'Manage your notification preferences',
    icon: Bell,
  },
  {
    id: 'help_center',
    title: 'Help Center',
    subtitle: 'FAQs and support',
    icon: CircleHelp,
  },
  {
    id: 'contact_us',
    title: 'Contact Us',
    subtitle: 'Get in touch with our support team',
    icon: Headphones,
  },
  {
    id: 'settings',
    title: 'Settings',
    subtitle: 'App preferences and settings',
    icon: Settings,
  },
];

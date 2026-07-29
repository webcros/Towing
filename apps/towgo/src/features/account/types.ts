import type { IconComponent } from '@towing/ui';

export type UserProfile = {
  name: string;
  phone: string;
  email: string;
};

export type AccountMenuItemId =
  | 'personal_info'
  | 'vehicles'
  | 'saved_locations'
  | 'payment_methods'
  | 'notifications'
  | 'help_center'
  | 'contact_us'
  | 'settings';

export type AccountMenuItem = {
  id: AccountMenuItemId;
  title: string;
  subtitle: string;
  icon: IconComponent;
};

export type VehicleType = 'wheel_lift' | 'flatbed';
export type Vehicle = {
  id: string;
  type: VehicleType;
  makeModel: string;
  plate: string;
  color: string;
};

export type LocationKind = 'home' | 'work' | 'other';
export type SavedLocation = {
  id: string;
  kind: LocationKind;
  label: string;
  address: string;
};

export type PaymentKind = 'card' | 'upi' | 'wallet';
export type PaymentMethod = {
  id: string;
  kind: PaymentKind;
  label: string;
  detail: string;
  isDefault?: boolean;
};

export type Faq = { id: string; question: string; answer: string };

export type NotificationPrefKey = 'bookingUpdates' | 'driverArrival' | 'promotions' | 'receipts';

/**
 * Profile, vehicle and saved-address shapes now come from `@towing/api-contracts`
 * (`CustomerProfile`, `SavedVehicle`/`VehicleCategory`, `SavedAddress`) — the
 * backend's `/me` API is the single source of truth for them as of Phase 12.
 */

export type PaymentKind = 'card' | 'upi' | 'wallet';
export type PaymentMethod = {
  id: string;
  kind: PaymentKind;
  label: string;
  detail: string;
  isDefault?: boolean;
};

export type Faq = { id: string; question: string; answer: string };


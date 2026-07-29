import type { PaymentMethod } from '../types';

// Placeholder saved methods (real cards/wallets via Razorpay later).
export const paymentMethodsMock: PaymentMethod[] = [
  { id: 'p1', kind: 'card', label: 'HDFC Visa', detail: '•••• 4321', isDefault: true },
  { id: 'p2', kind: 'upi', label: 'UPI', detail: 'rahul@okhdfcbank' },
];

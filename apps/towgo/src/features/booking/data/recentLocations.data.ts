export type RecentLocation = {
  id: string;
  name: string;
  address: string;
};

// Mocked recent / saved locations (real history + Places search come later).
export const recentLocations: RecentLocation[] = [
  { id: 'r1', name: 'MG Road', address: 'Bengaluru, Karnataka, India' },
  { id: 'r2', name: 'Koramangala', address: '5th Block, Bengaluru, Karnataka' },
  { id: 'r3', name: 'Kempegowda Intl. Airport', address: 'Devanahalli, Bengaluru' },
  { id: 'r4', name: 'HSR Layout', address: 'Sector 2, Bengaluru, Karnataka' },
  { id: 'r5', name: 'Indiranagar', address: '100 Feet Road, Bengaluru' },
  { id: 'r6', name: 'Whitefield', address: 'ITPL Main Road, Bengaluru' },
  { id: 'r7', name: 'Majestic Bus Stand', address: 'Kempegowda, Bengaluru' },
];

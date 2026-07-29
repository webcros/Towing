import { create } from 'zustand';
import type { SavedLocation } from '../types';

let idCounter = 100;
const nextId = () => `l${(idCounter += 1)}`;

type SavedLocationsState = {
  locations: SavedLocation[];
  addLocation: (location: Omit<SavedLocation, 'id'>) => void;
  updateLocation: (id: string, location: Omit<SavedLocation, 'id'>) => void;
  removeLocation: (id: string) => void;
};

export const useSavedLocationsStore = create<SavedLocationsState>((set) => ({
  locations: [
    { id: 'l1', kind: 'home', label: 'Home', address: 'MG Road, Bengaluru, Karnataka' },
    { id: 'l2', kind: 'work', label: 'Work', address: 'Koramangala, Bengaluru, Karnataka' },
  ],
  addLocation: (location) => set((s) => ({ locations: [...s.locations, { ...location, id: nextId() }] })),
  updateLocation: (id, location) =>
    set((s) => ({ locations: s.locations.map((l) => (l.id === id ? { ...location, id } : l)) })),
  removeLocation: (id) => set((s) => ({ locations: s.locations.filter((l) => l.id !== id) })),
}));

import { create } from 'zustand';
import type { Vehicle } from '../types';

let idCounter = 100;
const nextId = () => `v${(idCounter += 1)}`;

type VehiclesState = {
  vehicles: Vehicle[];
  addVehicle: (vehicle: Omit<Vehicle, 'id'>) => void;
  updateVehicle: (id: string, vehicle: Omit<Vehicle, 'id'>) => void;
  removeVehicle: (id: string) => void;
};

export const useVehiclesStore = create<VehiclesState>((set) => ({
  vehicles: [
    { id: 'v1', type: 'wheel_lift', makeModel: 'Maruti Swift', plate: 'KA 01 AB 1234', color: 'White' },
    { id: 'v2', type: 'flatbed', makeModel: 'Hyundai Creta', plate: 'KA 05 CJ 8890', color: 'Grey' },
  ],
  addVehicle: (vehicle) => set((s) => ({ vehicles: [...s.vehicles, { ...vehicle, id: nextId() }] })),
  updateVehicle: (id, vehicle) =>
    set((s) => ({ vehicles: s.vehicles.map((v) => (v.id === id ? { ...vehicle, id } : v)) })),
  removeVehicle: (id) => set((s) => ({ vehicles: s.vehicles.filter((v) => v.id !== id) })),
}));

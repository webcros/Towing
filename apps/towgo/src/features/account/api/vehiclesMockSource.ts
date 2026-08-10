import type { SavedVehicle } from '@towing/api-contracts';
import { env } from '@/lib/env';
import type { VehiclesDataSource } from './vehiclesDataSource';

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

let idCounter = 100;
const nextId = () => `mock-vehicle-${(idCounter += 1)}`;

let vehicles: SavedVehicle[] = [
  { id: 'v1', type: 'hatchback', makeModel: 'Maruti Swift', plate: 'KA 01 AB 1234', rcUrl: null, isDefault: true },
  { id: 'v2', type: 'suv', makeModel: 'Hyundai Creta', plate: 'KA 05 CJ 8890', rcUrl: null, isDefault: false },
];

export const vehiclesMockSource: VehiclesDataSource = {
  async list() {
    await delay(500);
    if (env.mockAccountState === 'error') {
      throw new Error('Failed to load vehicles');
    }
    if (env.mockAccountState === 'empty') {
      return [];
    }
    return vehicles;
  },

  async create(input) {
    await delay(400);
    const created: SavedVehicle = {
      id: nextId(),
      type: input.type,
      makeModel: input.makeModel ?? null,
      plate: input.plate ?? null,
      rcUrl: null,
      isDefault: input.isDefault ?? false,
    };
    vehicles = [...vehicles, created];
    return created;
  },

  async update(vehicleId, patch) {
    await delay(400);
    const existing = vehicles.find((v) => v.id === vehicleId);
    if (!existing) throw new Error('Vehicle not found');
    const updated: SavedVehicle = { ...existing, ...patch };
    vehicles = vehicles.map((v) => (v.id === vehicleId ? updated : v));
    return updated;
  },

  async remove(vehicleId) {
    await delay(300);
    vehicles = vehicles.filter((v) => v.id !== vehicleId);
  },

  async presignRc(vehicleId) {
    await delay(300);
    return {
      uploadUrl: `mock://uploads/vehicles/${vehicleId}/rc.jpg`,
      key: `mock-vehicles/${vehicleId}/rc-${Date.now()}.jpg`,
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    };
  },

  async confirmRc(vehicleId, key) {
    await delay(300);
    vehicles = vehicles.map((v) => (v.id === vehicleId ? { ...v, rcUrl: `mock://${key}` } : v));
  },
};

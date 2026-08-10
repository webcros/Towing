import type {
  SavedVehicle,
  SavedVehicleCreate,
  SavedVehicleUpdate,
  VehicleRcPresignResponse,
} from '@towing/api-contracts';
import { env } from '@/lib/env';
import { vehiclesMockSource } from './vehiclesMockSource';
import { vehiclesRestSource } from './vehiclesRestSource';

export interface VehiclesDataSource {
  list(): Promise<SavedVehicle[]>;
  create(input: SavedVehicleCreate): Promise<SavedVehicle>;
  update(vehicleId: string, patch: SavedVehicleUpdate): Promise<SavedVehicle>;
  remove(vehicleId: string): Promise<void>;
  /** RC-photo upload step 1 — a short-lived URL the caller PUTs the image bytes to directly. */
  presignRc(vehicleId: string): Promise<VehicleRcPresignResponse>;
  /** RC-photo upload step 2 — tells the backend the PUT to `key` landed. */
  confirmRc(vehicleId: string, key: string): Promise<void>;
}

export const vehiclesDataSource: VehiclesDataSource = env.useMocks
  ? vehiclesMockSource
  : vehiclesRestSource;

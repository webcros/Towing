import { truckPositionSchema, type TruckPositionDto } from '@towing/api-contracts';

/**
 * Coalesces the raw ping stream into at most one frame per truck per flush
 * window, grouped by tenant.
 *
 * Deliberately a plain class: no Nest, no Redis, no timers. All the fiddly
 * logic — which ping wins, which tenant it belongs to, what a malformed payload
 * does — is then testable without a container or a socket.
 */

/** What a publisher puts on `LOCATION_CHANNEL`. Carries the tenant; the DTO does not. */
export interface LocationPing extends TruckPositionDto {
  fleetId: string;
}

export class LocationBatcher {
  /** fleetId → truckId → newest position seen this window. */
  private pending = new Map<string, Map<string, TruckPositionDto>>();
  private dropped = 0;

  /**
   * Returns false for anything that is not a well-formed ping, so the caller can
   * count it rather than crashing the subscriber. `JSON.parse` is `any` and the
   * wire is the one place a shape change is silent.
   */
  accept(raw: unknown): boolean {
    if (typeof raw !== 'object' || raw === null) return false;
    const fleetId = (raw as { fleetId?: unknown }).fleetId;
    if (typeof fleetId !== 'string' || fleetId.length === 0) return false;

    const parsed = truckPositionSchema.safeParse(raw);
    if (!parsed.success) return false;
    const position = parsed.data;

    let byTruck = this.pending.get(fleetId);
    if (!byTruck) {
      byTruck = new Map();
      this.pending.set(fleetId, byTruck);
    }

    const existing = byTruck.get(position.truckId);
    // Out-of-order packets are discarded server-side (§11.3). Without this a
    // delayed ping arriving after a newer one drags the marker backwards, which
    // reads to the operator as the truck reversing.
    if (existing && Date.parse(existing.at) > Date.parse(position.at)) {
      this.dropped += 1;
      return true;
    }

    byTruck.set(position.truckId, position);
    return true;
  }

  /** Number of pings discarded as out-of-order since the last read. */
  takeDroppedCount(): number {
    const value = this.dropped;
    this.dropped = 0;
    return value;
  }

  /** Empties the buffer and returns what was in it, grouped by tenant. */
  drain(): Map<string, TruckPositionDto[]> {
    const out = new Map<string, TruckPositionDto[]>();
    for (const [fleetId, byTruck] of this.pending) {
      if (byTruck.size > 0) out.set(fleetId, [...byTruck.values()]);
    }
    this.pending = new Map();
    return out;
  }

  get size(): number {
    let total = 0;
    for (const byTruck of this.pending.values()) total += byTruck.size;
    return total;
  }
}

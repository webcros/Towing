import { describe, expect, it } from 'vitest';
import { LocationBatcher } from './location-batcher';

const TRUCK_A = '11111111-1111-4111-8111-111111111111';
const TRUCK_B = '22222222-2222-4222-8222-222222222222';
const FLEET_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const FLEET_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function ping(overrides: Record<string, unknown> = {}) {
  return {
    fleetId: FLEET_A,
    truckId: TRUCK_A,
    lat: 12.9716,
    lng: 77.5946,
    heading: 90,
    speedKph: 34.5,
    at: '2026-08-05T10:00:00.000Z',
    ...overrides,
  };
}

describe('LocationBatcher', () => {
  it('coalesces repeated pings for one truck down to the newest', () => {
    const batcher = new LocationBatcher();

    batcher.accept(ping({ at: '2026-08-05T10:00:00.000Z', lat: 12.1 }));
    batcher.accept(ping({ at: '2026-08-05T10:00:00.500Z', lat: 12.2 }));
    batcher.accept(ping({ at: '2026-08-05T10:00:00.900Z', lat: 12.3 }));

    const drained = batcher.drain().get(FLEET_A);
    // This is the "<=1/s/truck" of the plan: three pings in one window cost one
    // frame, not three.
    expect(drained).toHaveLength(1);
    expect(drained?.[0]?.lat).toBe(12.3);
  });

  it('drops out-of-order pings instead of dragging the marker backwards', () => {
    const batcher = new LocationBatcher();

    batcher.accept(ping({ at: '2026-08-05T10:00:05.000Z', lat: 12.5 }));
    batcher.accept(ping({ at: '2026-08-05T10:00:01.000Z', lat: 12.1 }));

    const drained = batcher.drain().get(FLEET_A);
    expect(drained?.[0]?.lat).toBe(12.5);
    expect(batcher.takeDroppedCount()).toBe(1);
  });

  it('keeps tenants apart', () => {
    const batcher = new LocationBatcher();

    batcher.accept(ping({ fleetId: FLEET_A, truckId: TRUCK_A }));
    batcher.accept(ping({ fleetId: FLEET_B, truckId: TRUCK_B }));

    const drained = batcher.drain();
    expect(drained.get(FLEET_A)?.map((p) => p.truckId)).toEqual([TRUCK_A]);
    expect(drained.get(FLEET_B)?.map((p) => p.truckId)).toEqual([TRUCK_B]);
  });

  it('keeps distinct trucks in the same fleet', () => {
    const batcher = new LocationBatcher();

    batcher.accept(ping({ truckId: TRUCK_A }));
    batcher.accept(ping({ truckId: TRUCK_B }));

    expect(batcher.drain().get(FLEET_A)).toHaveLength(2);
  });

  it('drain empties the buffer', () => {
    const batcher = new LocationBatcher();
    batcher.accept(ping());

    expect(batcher.size).toBe(1);
    expect(batcher.drain().size).toBe(1);
    expect(batcher.size).toBe(0);
    expect(batcher.drain().size).toBe(0);
  });

  it('rejects malformed payloads rather than throwing', () => {
    const batcher = new LocationBatcher();

    expect(batcher.accept(null)).toBe(false);
    expect(batcher.accept('a string')).toBe(false);
    expect(batcher.accept({})).toBe(false);
    // A ping with no tenant cannot be routed to a room — silently accepting it
    // would be a cross-tenant leak waiting to happen.
    expect(batcher.accept(ping({ fleetId: undefined }))).toBe(false);
    expect(batcher.accept(ping({ truckId: 'not-a-uuid' }))).toBe(false);
    expect(batcher.accept(ping({ lat: 'north' }))).toBe(false);
    expect(batcher.accept(ping({ lat: 991 }))).toBe(false);
    expect(batcher.accept(ping({ at: 'yesterday' }))).toBe(false);
    expect(batcher.size).toBe(0);
  });

  it('accepts a ping with no heading or speed', () => {
    const batcher = new LocationBatcher();
    expect(batcher.accept(ping({ heading: null, speedKph: null }))).toBe(true);
    expect(batcher.size).toBe(1);
  });
});

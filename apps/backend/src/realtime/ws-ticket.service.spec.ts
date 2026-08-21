import type { FleetId } from '@towing/api-contracts';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closeTestRedis, flushTestRedis, testRedis } from '../test/redis';
import { WsTicketService } from './ws-ticket.service';

const FLEET = '11111111-1111-4111-8111-111111111111' as FleetId;
const USER = '22222222-2222-4222-8222-222222222222';
const DRIVER = '33333333-3333-4333-8333-333333333333';

const FLEET_CLAIMS = { realm: 'fleet', fleetId: FLEET, subjectId: USER } as const;

function service(ttlSeconds = 60): WsTicketService {
  return new WsTicketService(testRedis(), { REALTIME_TICKET_TTL_SECONDS: ttlSeconds } as never);
}

describe('WsTicketService', () => {
  beforeEach(async () => {
    await flushTestRedis();
  });

  afterAll(async () => {
    await closeTestRedis();
  });

  it('issues a ticket that redeems to the claims it was minted with', async () => {
    const tickets = service();
    const ticket = await tickets.issue(FLEET_CLAIMS);

    expect(ticket.length).toBeGreaterThanOrEqual(32);
    await expect(tickets.consume(ticket)).resolves.toEqual(FLEET_CLAIMS);
  });

  it('is single-use — a replayed ticket is rejected', async () => {
    const tickets = service();
    const ticket = await tickets.issue(FLEET_CLAIMS);

    await expect(tickets.consume(ticket)).resolves.not.toBeNull();
    // This is the whole point of GETDEL: two sockets racing a stolen ticket
    // must not both connect.
    await expect(tickets.consume(ticket)).resolves.toBeNull();
  });

  it('expires', async () => {
    const tickets = service(1);
    const ticket = await tickets.issue(FLEET_CLAIMS);

    await new Promise((resolve) => setTimeout(resolve, 1_200));
    await expect(tickets.consume(ticket)).resolves.toBeNull();
  });

  it('rejects garbage without touching Redis', async () => {
    const tickets = service();
    for (const bad of ['', 'not-a-ticket', 'x'.repeat(500), undefined, null, 42, {}]) {
      await expect(tickets.consume(bad)).resolves.toBeNull();
    }
  });

  it('rejects a key whose payload is not well-formed claims', async () => {
    const tickets = service();
    // Simulates a partially-written or tampered value rather than trusting that
    // whatever is at the key must be ours.
    await testRedis().set('ws:ticket:handmade', JSON.stringify({ fleetId: FLEET }), 'EX', 60);
    await expect(tickets.consume('handmade')).resolves.toBeNull();
  });

  // --- Phase 16: the second realm -----------------------------------------

  it('round-trips a driver ticket, which carries a subject and no tenant', async () => {
    const tickets = service();
    const ticket = await tickets.issue({ realm: 'driver', subjectId: DRIVER });

    await expect(tickets.consume(ticket)).resolves.toEqual({
      realm: 'driver',
      subjectId: DRIVER,
    });
  });

  it('rejects a realm-less ticket left over from before Phase 16', async () => {
    const tickets = service();
    // The exact shape Phase 5 wrote. A deploy that rolled forward while these
    // were still in flight must log those holders out rather than guess a realm
    // for them — guessing is how a fleet ticket ends up opening a driver socket.
    await testRedis().set(
      'ws:ticket:legacy',
      JSON.stringify({ fleetId: FLEET, userId: USER }),
      'EX',
      60,
    );
    await expect(tickets.consume('legacy')).resolves.toBeNull();
  });

  it('rejects a fleet ticket that lost its tenant', async () => {
    const tickets = service();
    await testRedis().set(
      'ws:ticket:tenantless',
      JSON.stringify({ realm: 'fleet', subjectId: USER }),
      'EX',
      60,
    );
    await expect(tickets.consume('tenantless')).resolves.toBeNull();
  });
});

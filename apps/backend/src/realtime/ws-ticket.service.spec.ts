import type { FleetId } from '@towing/api-contracts';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closeTestRedis, flushTestRedis, testRedis } from '../test/redis';
import { WsTicketService } from './ws-ticket.service';

const FLEET = '11111111-1111-4111-8111-111111111111' as FleetId;
const USER = '22222222-2222-4222-8222-222222222222';

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
    const ticket = await tickets.issue({ fleetId: FLEET, userId: USER });

    expect(ticket.length).toBeGreaterThanOrEqual(32);
    await expect(tickets.consume(ticket)).resolves.toEqual({ fleetId: FLEET, userId: USER });
  });

  it('is single-use — a replayed ticket is rejected', async () => {
    const tickets = service();
    const ticket = await tickets.issue({ fleetId: FLEET, userId: USER });

    await expect(tickets.consume(ticket)).resolves.not.toBeNull();
    // This is the whole point of GETDEL: two sockets racing a stolen ticket
    // must not both connect.
    await expect(tickets.consume(ticket)).resolves.toBeNull();
  });

  it('expires', async () => {
    const tickets = service(1);
    const ticket = await tickets.issue({ fleetId: FLEET, userId: USER });

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
});

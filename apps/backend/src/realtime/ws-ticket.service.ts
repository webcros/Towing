import { randomBytes } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { FleetId } from '@towing/api-contracts';
import type { Redis } from 'ioredis';
import { ENV, type Env } from '../config/env';
import { REDIS, wsTicketKey } from '../redis/redis.constants';

export interface WsTicketClaims {
  fleetId: FleetId;
  userId: string;
}

/**
 * Single-use handshake tickets for the WebSocket connection.
 *
 * WHY NOT A SHORT-TTL JWT: `JwtAuthGuard` accepts any token signed with
 * `JWT_ACCESS_SECRET` that carries `role: 'fleet_owner'`. A ticket minted that
 * way would be a fully-privileged access token in disguise, and the only fixes
 * are a `typ` claim the guard must remember to reject, or a second secret. An
 * opaque random string in Redis has neither problem, and gains single-use
 * semantics and instant revocability for free.
 *
 * The browser is why this exists at all: it holds only httpOnly cookies, so it
 * physically cannot put a bearer on the handshake.
 */
@Injectable()
export class WsTicketService {
  private readonly logger = new Logger(WsTicketService.name);

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(ENV) private readonly env: Env,
  ) {}

  get ttlSeconds(): number {
    return this.env.REALTIME_TICKET_TTL_SECONDS;
  }

  async issue(claims: WsTicketClaims): Promise<string> {
    // 32 bytes: the ticket is a bearer credential for its whole (short) life, so
    // it gets the same entropy as a refresh token rather than a session id.
    const ticket = randomBytes(32).toString('base64url');
    await this.redis.set(wsTicketKey(ticket), JSON.stringify(claims), 'EX', this.ttlSeconds);
    return ticket;
  }

  /**
   * Redeems a ticket, returning null for anything that is not a live,
   * unredeemed one. GETDEL makes redemption atomic: two sockets racing the same
   * stolen ticket cannot both connect. (Redis >= 6.2; both compose profiles and
   * ElastiCache run 7.)
   */
  async consume(ticket: unknown): Promise<WsTicketClaims | null> {
    if (typeof ticket !== 'string' || ticket.length === 0 || ticket.length > 256) return null;

    let raw: string | null;
    try {
      raw = await this.redis.getdel(wsTicketKey(ticket));
    } catch (err) {
      // Availability-first would be wrong here: failing open on an auth check
      // is how tenants leak into each other's rooms.
      this.logger.error(`ticket lookup failed: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
    if (raw === null) return null;

    try {
      const parsed: unknown = JSON.parse(raw);
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        typeof (parsed as WsTicketClaims).fleetId !== 'string' ||
        typeof (parsed as WsTicketClaims).userId !== 'string'
      ) {
        return null;
      }
      return parsed as WsTicketClaims;
    } catch {
      return null;
    }
  }
}

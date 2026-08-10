import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { ENV, type Env } from '../../config/env';
import { REDIS } from '../../redis/redis.constants';
import type { Realm } from './auth.types';
import type { FleetTokenPair } from './token.service';

/** What is actually stored: the pair plus the realm that minted it. */
interface ParkedPair extends FleetTokenPair {
  realm: Realm;
}

/**
 * Rotation leeway (§16.4) — the second half of the Phase 8 deploy gate.
 *
 * THE PROBLEM. The console fires several queries at once. When the access token
 * expires they all 401 together, and every one of them refreshes with the SAME
 * refresh token. `rotate()` claims the row with a conditional UPDATE so exactly
 * one wins; the losers fall through to `explainFailedClaim`, which sees a token
 * presented twice, cannot tell a racing tab from a thief, and revokes the whole
 * family — logging the user out for doing nothing wrong.
 *
 * The BFF papers over this with a per-process in-flight map. That works for one
 * Next process and stops working the moment there are two, which is precisely
 * the state this phase is trying to reach. It also does nothing for Track B's
 * mobile apps, which call `/auth/refresh` directly with no BFF at all.
 *
 * THE FIX. The winner parks its successor pair under the digest of the token
 * that was presented, for a few seconds. A loser arriving inside that window
 * replays it instead of tripping reuse detection. This is the standard OAuth
 * rotation-leeway pattern, it needs no schema change, and it is correct across
 * N clients, N Next processes and N backend tasks at once.
 *
 * WHY REDIS AND NOT A COLUMN. The parked value is a usable token pair in
 * plaintext. Redis already holds equivalently sensitive short-lived material
 * (WebSocket tickets, idempotent response bodies) and expires it without being
 * asked. A column would put live refresh tokens in every nightly database
 * backup, for a value whose whole life is ten seconds.
 *
 * WHAT IT COSTS. A stolen refresh token replayed within the window is not
 * detected on that request. It is not undetectable: thief and victim receive the
 * SAME pair rather than two members of the family, so at the next rotation —
 * within the access-token TTL, 15 minutes — exactly one of them wins and the
 * other trips detection outside any window. Detection is deferred by one cycle,
 * not removed. `REFRESH_GRACE_SECONDS=0` disables the window entirely and
 * restores the pre-Phase-8 behaviour exactly.
 */
@Injectable()
export class RefreshGraceService {
  private readonly logger = new Logger(RefreshGraceService.name);

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(ENV) private readonly env: Env,
  ) {}

  get enabled(): boolean {
    return this.env.REFRESH_GRACE_SECONDS > 0;
  }

  /**
   * Parks the successor pair against the token that bought it.
   *
   * Best-effort: a Redis failure here means a concurrent refresh will revoke the
   * family and the user logs in again. Annoying, never unsafe, and strictly
   * better than failing a refresh that has already succeeded — the row is
   * claimed and the new pair is already in the caller's hands.
   */
  async remember(presentedHash: string, realm: Realm, pair: FleetTokenPair): Promise<void> {
    if (!this.enabled) return;

    try {
      await this.redis.set(
        key(presentedHash),
        JSON.stringify({ realm, ...pair } satisfies ParkedPair),
        'EX',
        this.env.REFRESH_GRACE_SECONDS,
      );
    } catch (error) {
      this.logger.warn(`Could not record refresh grace: ${String(error)}`);
    }
  }

  /**
   * The pair a concurrent refresh should replay, or null.
   *
   * WHY THIS WAITS. The loser of the conditional UPDATE learns it lost the
   * instant the winner's transaction commits — but the winner has not parked
   * anything yet, because it still has to mint the successor pair (a round trip
   * to insert the new row). A single lookup therefore finds nothing and
   * concludes theft, which is exactly the false positive this service exists to
   * remove. It is not a rare interleaving; it is the normal ordering, and it is
   * why two parallel refreshes failed while six happened to pass.
   *
   * So a miss is retried for a bounded moment before giving up. Waiting costs
   * nothing on the path that matters: the winner never calls this, so only a
   * concurrent caller (which finds its answer in a few milliseconds) or a
   * genuine replay (which is about to be rejected anyway) ever pays it.
   *
   * FAILS CLOSED, the opposite polarity to `CacheService`. A Redis error returns
   * null, sending the caller into reuse detection and revoking the family.
   * Availability-first is right for a dashboard KPI and wrong for something
   * deciding whether a replayed credential is a thief: an unreachable Redis must
   * never be a way to make token theft look ordinary.
   *
   * REALM-SCOPED (Phase 10). The key is the token digest alone, and `rotate()`
   * consults this BEFORE it knows the realm — so without the stored realm, a
   * customer refresh token replayed at `/v1/fleet/auth/refresh` inside the
   * window would be handed the customer's own parked pair by the fleet route.
   * Not an escalation, since the caller already held that token, but it defeats
   * the cross-realm rejection outright and would write customer tokens into
   * fleet cookies. An entry parked before this field existed has no `realm` and
   * is ignored, which is the safe direction on a rolling deploy.
   */
  async get(presentedHash: string, allowed: readonly Realm[]): Promise<FleetTokenPair | null> {
    if (!this.enabled) return null;

    // Never wait longer than the window itself — past it there is nothing to
    // find, and a replay outside the window is meant to be rejected.
    const deadline = Date.now() + Math.min(WAIT_MS, this.env.REFRESH_GRACE_SECONDS * 1_000);

    for (;;) {
      let raw: string | null;
      try {
        raw = await this.redis.get(key(presentedHash));
      } catch (error) {
        this.logger.warn(
          `Refresh grace lookup failed, falling through to reuse detection: ${String(error)}`,
        );
        return null;
      }

      if (raw) {
        const parsed = JSON.parse(raw) as Partial<ParkedPair>;
        if (
          typeof parsed.accessToken !== 'string' ||
          typeof parsed.refreshToken !== 'string' ||
          typeof parsed.realm !== 'string' ||
          !allowed.includes(parsed.realm as Realm)
        ) {
          return null;
        }
        return { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken };
      }

      if (Date.now() >= deadline) return null;
      await sleep(POLL_MS);
    }
  }

  /** Hashes a raw token the same way `TokenService` does, for callers holding one. */
  static digest(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}

/**
 * How long a loser waits for the winner to finish minting. Generous next to the
 * single INSERT it is waiting on, and bounded so a genuine replay is still
 * rejected promptly — that request ends in a 401 either way, so half a second
 * of patience there buys a great deal of correctness on the concurrent path.
 */
const WAIT_MS = 750;
const POLL_MS = 25;

function key(presentedHash: string): string {
  return `auth:refresh:grace:${presentedHash}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

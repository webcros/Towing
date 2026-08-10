import { createHash, randomUUID } from 'node:crypto';
import {
  type CallHandler,
  type ExecutionContext,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import { ErrorCodes } from '@towing/api-contracts';
import type { Response } from 'express';
import type { Redis } from 'ioredis';
import { type Observable, catchError, concatMap, from, mergeMap, of, throwError } from 'rxjs';
import { ApiException } from '../errors/api-exception';
import type { AuthedRequest } from '../../modules/auth/auth.types';
import { REDIS } from '../../redis/redis.constants';

/** Only these can create or move money; a GET is idempotent by definition. */
const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

const REPLAY_HEADER = 'Idempotency-Replayed';

/**
 * Must comfortably exceed p99 handler latency including the slowest vendor call
 * (§19.3 caps outbound calls at 2–5s). Too short and a slow capture loses its
 * marker mid-flight; too long and a genuinely crashed request blocks its own
 * retry for that whole window.
 */
const IN_FLIGHT_TTL_SECONDS = 90;

/** §19.4: a retry hours later must return the original result, not charge again. */
const COMPLETED_TTL_SECONDS = 60 * 60 * 24;

type IdempotencyRecord =
  | { state: 'in_flight'; requestHash: string; holder: string }
  | { state: 'completed'; requestHash: string; status: number; body: unknown };

/**
 * Release only what we still own. Our marker can expire under a pathologically
 * slow handler and be re-acquired by the client's retry; deleting blindly would
 * hand a third caller the lock while two are already running.
 */
const RELEASE_SCRIPT = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
end
return 0
`;

/**
 * Same ownership check on the way out, plus the empty case: if the marker simply
 * expired and nobody took it, storing the response is still correct and lets the
 * retry replay. If someone else holds it, we must not clobber their in-flight
 * marker with our result.
 */
const COMPLETE_SCRIPT = `
local current = redis.call('get', KEYS[1])
if current == false or current == ARGV[1] then
  redis.call('set', KEYS[1], ARGV[2], 'EX', ARGV[3])
  return 1
end
return 0
`;

const sha256 = (input: string): string => createHash('sha256').update(input).digest('hex');

/**
 * Key order is a serialization detail, not a difference in intent — a client
 * that re-serializes its retry body must not trip the mismatch guard.
 */
function canonicalize(value: unknown): unknown {
  if (Buffer.isBuffer(value)) return value.toString('base64');
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    return Object.keys(source)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = canonicalize(source[key]);
        return acc;
      }, {});
  }
  return value;
}

function parseRecord(raw: string): IdempotencyRecord | null {
  try {
    return JSON.parse(raw) as IdempotencyRecord;
  } catch {
    return null;
  }
}

/**
 * §19.4 — mutating booking/money endpoints carry an `Idempotency-Key`; the server
 * stores request-hash + response so a double-tap, a network replay or a queue
 * redelivery returns the original result instead of a second charge.
 *
 * Races this DOES cover:
 *  - Two concurrent requests with the same key: exactly one wins SET NX, the
 *    loser gets 409 (in flight) or the stored response once the winner lands.
 *  - A retry after the response was lost in transit: replayed verbatim.
 *  - The same key reused for a different payload: rejected, never replayed.
 *
 * Races this does NOT cover — by design:
 *  - Exactly-once is not guaranteed here. Redis is not in the DB transaction, so
 *    a crash between COMMIT and the store leaves the marker to expire and the
 *    retry re-executes. The unique constraints on payments/payouts/wallet
 *    idempotency_key (§17) are the real backstop; this is the fast path.
 *  - The loser is not parked waiting for the winner — it gets 409 and retries.
 *  - A handler outliving IN_FLIGHT_TTL_SECONDS loses its marker and can run
 *    concurrently with a retry; the CAS scripts keep the two from corrupting
 *    each other's state, but only the DB constraint stops the duplicate write.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    if (context.getType() !== 'http') return next.handle();

    const http = context.switchToHttp();
    const req = http.getRequest<AuthedRequest>();
    const res = http.getResponse<Response>();

    const header = req.headers['idempotency-key'];
    const clientKey = (Array.isArray(header) ? header[0] : header)?.trim();

    // Header-driven rather than route-driven: money routes require the key at
    // the DTO layer, everything else stays untouched.
    if (!clientKey || !MUTATING_METHODS.has(req.method)) return next.handle();

    const key = this.buildKey(req, clientKey);
    const requestHash = fingerprint(req);
    // Serialized once and reused: the CAS scripts compare the marker byte for
    // byte, so acquire and release must not risk differing key order.
    const inFlight: IdempotencyRecord = { state: 'in_flight', requestHash, holder: randomUUID() };
    const marker = JSON.stringify(inFlight);

    const existing = await this.acquire(key, marker, inFlight);

    if (existing) {
      // Checked before state: reusing a key for different content is a client
      // bug whether or not the first attempt has finished, and answering it with
      // someone else's response would be worse than any 409.
      if (existing.requestHash !== requestHash) {
        throw new ApiException(
          HttpStatus.CONFLICT,
          ErrorCodes.IDEMPOTENCY_REPLAY_MISMATCH,
          'This Idempotency-Key was already used with a different request.',
        );
      }

      if (existing.state === 'in_flight') {
        throw ApiException.conflict(
          'A request with this Idempotency-Key is still being processed. Retry shortly.',
        );
      }

      // Nest applies the handler's declared status to the response before
      // interceptors run, so overriding it here is what makes the replay
      // verbatim — a replayed create still answers 201, not 200.
      res.status(existing.status);
      res.setHeader(REPLAY_HEADER, 'true');
      return of(existing.body);
    }

    return next.handle().pipe(
      concatMap(async (body: unknown) => {
        await this.complete(key, marker, requestHash, res.statusCode, body);
        return body;
      }),
      catchError((err: unknown) =>
        // Release, never store: a 502 from a payment gateway must leave the key
        // reusable, otherwise the client's honest retry is refused for 24 hours.
        from(this.release(key, marker)).pipe(mergeMap(() => throwError(() => err))),
      ),
    );
  }

  private buildKey(req: AuthedRequest, clientKey: string): string {
    // The tenant is part of the namespace so two fleets replaying the same
    // client-generated key can never read each other's stored response (§14).
    // Keys are client-chosen: uuid collisions are unlikely, "1" is not.
    const tenant = req.auth?.fleetId ?? req.auth?.sub ?? 'anon';
    // The concrete path, not the handler, so `/bookings/A/accept` and
    // `/bookings/B/accept` are distinct operations under one key rather than a
    // mismatch — the booking id lives in the path, not in the hashed body.
    const path = req.originalUrl.split('?', 1)[0] ?? req.originalUrl;
    // Hashing the client key bounds its length and removes delimiter injection:
    // a key containing ':' must not be able to address another route's slot.
    return `idem:${tenant}:${req.method}:${path}:${sha256(clientKey)}`;
  }

  /** Returns null when the marker was won, or the record already holding the slot. */
  private async acquire(
    key: string,
    marker: string,
    inFlight: IdempotencyRecord,
  ): Promise<IdempotencyRecord | null> {
    // SET NX and the follow-up GET are not atomic. A record that expires in that
    // gap would read as a phantom conflict, so try once more before reporting
    // one; anything still contested on the second pass is genuinely concurrent.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const won = await this.redis.set(key, marker, 'EX', IN_FLIGHT_TTL_SECONDS, 'NX');
      if (won === 'OK') return null;

      const raw = await this.redis.get(key);
      if (raw === null) continue;

      const record = parseRecord(raw);
      if (record) return record;

      this.logger.warn(`Unreadable idempotency record at ${key}; treating as in flight`);
      break;
    }

    // Someone holds the slot and we could not read what they stored. Reporting
    // in-flight (hash matched by construction) turns this into a retryable 409
    // rather than a replay of a response we cannot verify.
    return inFlight;
  }

  private async complete(
    key: string,
    marker: string,
    requestHash: string,
    status: number,
    body: unknown,
  ): Promise<void> {
    const record = JSON.stringify({
      state: 'completed',
      requestHash,
      status,
      body: body ?? null,
    } satisfies IdempotencyRecord);

    try {
      await this.redis.eval(COMPLETE_SCRIPT, 1, key, marker, record, COMPLETED_TTL_SECONDS);
    } catch (err) {
      // The write already committed. Failing the response now would tell the
      // client the operation did not happen, which is the one lie that provokes
      // a duplicate. Cost of swallowing: a retry inside the marker's remaining
      // TTL gets a 409 instead of a replay.
      this.logger.warn(
        `Failed to store idempotent response for ${key}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async release(key: string, marker: string): Promise<void> {
    try {
      await this.redis.eval(RELEASE_SCRIPT, 1, key, marker);
    } catch (err) {
      // Worst case the marker sits until its TTL and the retry gets a 409 —
      // annoying, but the alternative (swallowing the handler's real error to
      // report a Redis one) hides why the request failed.
      this.logger.warn(
        `Failed to release idempotency marker ${key}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

/**
 * Query is folded in with the body: the route already namespaces the key, so
 * whatever else varies the request has to be inside the fingerprint or a filter
 * change could silently replay the wrong answer.
 */
function fingerprint(req: AuthedRequest): string {
  return sha256(
    JSON.stringify({
      query: canonicalize(req.query ?? {}),
      body: canonicalize(req.body ?? null),
    }),
  );
}

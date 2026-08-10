import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { Redis } from 'ioredis';
import { lastValueFrom, of, throwError } from 'rxjs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TEST_REDIS_URL } from '../../test/db';
import { IdempotencyInterceptor } from './idempotency.interceptor';

interface FakeResponse {
  statusCode: number;
  headers: Record<string, unknown>;
  status(code: number): FakeResponse;
  setHeader(key: string, value: unknown): void;
}

function fakeResponse(statusCode = 201): FakeResponse {
  return {
    statusCode,
    headers: {},
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    setHeader(key: string, value: unknown) {
      this.headers[key] = value;
    },
  };
}

function fakeRequest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    method: 'POST',
    originalUrl: '/v1/fleet/payouts',
    headers: { 'idempotency-key': 'client-key-1' },
    auth: { fleetId: 'fleet-a', sub: 'user-1' },
    query: {},
    body: { amount: '100.00' },
    ...overrides,
  };
}

function httpContext(request: Record<string, unknown>, response: FakeResponse): ExecutionContext {
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as unknown as ExecutionContext;
}

function handlerOf(body: unknown): CallHandler {
  return { handle: () => of(body) };
}

describe('IdempotencyInterceptor (§19.4)', () => {
  let redis: Redis;
  let interceptor: IdempotencyInterceptor;

  beforeAll(async () => {
    redis = new Redis(TEST_REDIS_URL, { maxRetriesPerRequest: 2, connectTimeout: 5_000 });
    redis.on('error', () => {});
    try {
      await redis.ping();
    } catch (cause) {
      throw new Error(
        `Cannot reach the test Redis at ${TEST_REDIS_URL}. Start it with:\n\n` +
          '  cd apps/backend && docker compose --profile test up -d --wait\n',
        { cause },
      );
    }
    interceptor = new IdempotencyInterceptor(redis);
  });

  beforeEach(async () => {
    await redis.flushdb();
  });

  afterAll(async () => {
    await redis.quit();
  });

  it('ignores requests without an Idempotency-Key', async () => {
    const request = fakeRequest({ headers: {} });
    const result = await interceptor.intercept(
      httpContext(request, fakeResponse()),
      handlerOf({ ok: 1 }),
    );
    await expect(lastValueFrom(result)).resolves.toEqual({ ok: 1 });
    await expect(redis.dbsize()).resolves.toBe(0);
  });

  it('ignores non-mutating methods even with a key', async () => {
    const request = fakeRequest({ method: 'GET' });
    const result = await interceptor.intercept(
      httpContext(request, fakeResponse()),
      handlerOf({ ok: 1 }),
    );
    await expect(lastValueFrom(result)).resolves.toEqual({ ok: 1 });
    await expect(redis.dbsize()).resolves.toBe(0);
  });

  it('replays the stored response verbatim on a same-key retry', async () => {
    const first = await interceptor.intercept(
      httpContext(fakeRequest(), fakeResponse(201)),
      handlerOf({ payoutId: 'p-1' }),
    );
    await expect(lastValueFrom(first)).resolves.toEqual({ payoutId: 'p-1' });

    const retryResponse = fakeResponse(200);
    const second = await interceptor.intercept(
      httpContext(fakeRequest(), retryResponse),
      // Different handler result proves the value comes from the store.
      handlerOf({ payoutId: 'SHOULD-NOT-RUN' }),
    );
    await expect(lastValueFrom(second)).resolves.toEqual({ payoutId: 'p-1' });
    expect(retryResponse.headers['Idempotency-Replayed']).toBe('true');
    // Replay carries the original status, not the handler default.
    expect(retryResponse.statusCode).toBe(201);
  });

  it('rejects the same key reused with a different payload', async () => {
    const first = await interceptor.intercept(
      httpContext(fakeRequest(), fakeResponse()),
      handlerOf({ ok: 1 }),
    );
    await lastValueFrom(first);

    await expect(
      interceptor.intercept(
        httpContext(fakeRequest({ body: { amount: '999.00' } }), fakeResponse()),
        handlerOf({ ok: 2 }),
      ),
    ).rejects.toMatchObject({ code: 'idempotency_replay_mismatch' });
  });

  it('answers 409 while the first request is still in flight', async () => {
    // Acquire the marker but never consume the observable — the handler has
    // "not finished" from the interceptor's point of view.
    await interceptor.intercept(httpContext(fakeRequest(), fakeResponse()), handlerOf({ ok: 1 }));

    await expect(
      interceptor.intercept(httpContext(fakeRequest(), fakeResponse()), handlerOf({ ok: 2 })),
    ).rejects.toMatchObject({ code: 'conflict' });
  });

  it('releases the marker on handler failure so an honest retry re-executes', async () => {
    const failing: CallHandler = { handle: () => throwError(() => new Error('gateway 502')) };

    const first = await interceptor.intercept(httpContext(fakeRequest(), fakeResponse()), failing);
    await expect(lastValueFrom(first)).rejects.toThrow('gateway 502');

    // Marker released → the retry runs the handler for real, no stored replay.
    const retry = await interceptor.intercept(
      httpContext(fakeRequest(), fakeResponse()),
      handlerOf({ ok: 'second-attempt' }),
    );
    await expect(lastValueFrom(retry)).resolves.toEqual({ ok: 'second-attempt' });
  });

  it('namespaces keys per tenant — two fleets sharing a key never share a response (§14)', async () => {
    const first = await interceptor.intercept(
      httpContext(fakeRequest(), fakeResponse()),
      handlerOf({ fleet: 'a' }),
    );
    await expect(lastValueFrom(first)).resolves.toEqual({ fleet: 'a' });

    const other = await interceptor.intercept(
      httpContext(fakeRequest({ auth: { fleetId: 'fleet-b', sub: 'user-2' } }), fakeResponse()),
      handlerOf({ fleet: 'b' }),
    );
    await expect(lastValueFrom(other)).resolves.toEqual({ fleet: 'b' });
  });
});

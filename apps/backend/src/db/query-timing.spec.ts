import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  currentRequestContext,
  recordDbCall,
  requestContext,
} from '../common/logging/request-context';
import { setupTestDatabase, testSql } from '../test/db';
import * as schema from './schema';
import { formatSlowQuery, withQueryTiming } from './query-timing';

/**
 * The wrapper rides two libraries' internals — postgres.js returns a
 * `Query extends Promise` whose execution is deferred by one microtask, and
 * drizzle chains `.values()` onto it expecting the same object back. These
 * assertions are the ones that would catch a patch release changing either.
 *
 * The wider proof is the rest of the suite: every one of its ~340 tests runs its
 * SQL through this wrapper.
 */
describe('withQueryTiming', () => {
  const timings: Array<{ durationMs: number; text: string }> = [];

  const client = () =>
    withQueryTiming(testSql(), (durationMs, text) => timings.push({ durationMs, text }));

  beforeEach(async () => {
    await setupTestDatabase();
    timings.length = 0;
  });

  afterAll(async () => {
    // The pool belongs to src/test/db.ts, closed by the global afterAll.
  });

  it('reports a plausible duration for a deliberately slow statement', async () => {
    await client().unsafe('select pg_sleep(0.25)');

    expect(timings).toHaveLength(1);
    expect(timings[0]!.durationMs).toBeGreaterThan(200);
    expect(timings[0]!.durationMs).toBeLessThan(3_000);
    expect(timings[0]!.text).toContain('pg_sleep');
  });

  it('returns rows unchanged, in both the plain and .values() shapes', async () => {
    const wrapped = client();

    const plain = await wrapped.unsafe('select 1 as n');
    expect(plain[0]).toEqual({ n: 1 });

    // drizzle takes this path for every mapped select. `.values()` returns the
    // SAME Query object, so the wrapper must not hand back a different one.
    const values = await wrapped.unsafe('select 1 as n, 2 as m').values();
    expect(values[0]).toEqual([1, 2]);

    expect(timings).toHaveLength(2);
  });

  it('times statements inside a transaction, not just the ones outside', async () => {
    await client().begin(async (tx) => {
      await tx.unsafe('select 1');
      await tx.unsafe('select 2');
    });

    // Transaction bodies are most of the write path — the ledger, payouts,
    // settings. An unwrapped transaction-scoped client would leave all of it
    // invisible while looking like it worked.
    expect(timings.filter((t) => t.text.startsWith('select'))).toHaveLength(2);
  });

  it('still reports, and still rejects, when a statement fails', async () => {
    await expect(client().unsafe('select * from table_that_is_not_there')).rejects.toThrow();

    expect(timings).toHaveLength(1);
  });

  it('reports a statement once however many times it is awaited', async () => {
    // postgres.js attaches its own continuation to sequence queued statements
    // inside a transaction, so a naive shadow of `then` double-counts every
    // query in every transaction: right duration, doubled dbCalls, two log
    // lines for one slow query.
    const query = client().unsafe('select 1');

    await Promise.all([query, query, query]);

    expect(timings).toHaveLength(1);
  });

  it('accumulates db time onto the request in flight', async () => {
    const wrapped = withQueryTiming(testSql(), (durationMs) => recordDbCall(durationMs));

    await requestContext.run({ requestId: 'req-1', dbMs: 0, dbCalls: 0 }, async () => {
      await wrapped.unsafe('select 1');
      await wrapped.unsafe('select 2');

      const store = currentRequestContext();
      expect(store?.requestId).toBe('req-1');
      expect(store?.dbCalls).toBe(2);
      expect(store?.dbMs).toBeGreaterThan(0);
    });
  });

  it('drives a real drizzle query, which is the only integration that matters', async () => {
    const db = drizzle(client(), { schema });

    const rows = await db.execute(sql`select 42 as answer`);

    expect(rows[0]).toMatchObject({ answer: 42 });
    expect(timings).toHaveLength(1);
  });
});

describe('formatSlowQuery', () => {
  it('collapses whitespace so a multi-line query is one log line', () => {
    expect(formatSlowQuery('select\n  a,\n  b\nfrom t', 100)).toBe('select a, b from t');
  });

  it('truncates rather than hashing, so the line names the tables', () => {
    const formatted = formatSlowQuery('select * from a very long query indeed', 20);

    expect(formatted).toHaveLength(21); // 20 + the ellipsis
    expect(formatted.startsWith('select * from a very')).toBe(true);
  });
});

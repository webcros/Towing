import type postgres from 'postgres';

/** Called once per statement, with the wall-clock time it took. */
export type QueryTimingReporter = (durationMs: number, sql: string) => void;

/**
 * Wraps a postgres.js client so every statement is timed.
 *
 * WHY A PROXY AND NOT A LOGGER HOOK. Both obvious seams fire *before* execution:
 * drizzle's `logger.logQuery(query, params)` and postgres.js's `debug(...)` are
 * both called on the way in, so neither can produce a duration. There is no
 * after-hook to use. Wrapping the client is the only place a start and an end
 * are both visible.
 *
 * WHY THESE THREE PROPERTIES ARE ENOUGH. Verified against
 * `drizzle-orm/postgres-js/session.cjs`: every statement drizzle issues goes
 * through `client.unsafe(query, params)` (the prepared-query path, the `all`
 * path and `db.execute` alike), transactions run inside `client.begin(cb)`, and
 * nested transactions inside `client.savepoint(cb)`. Wrapping the client handed
 * to those callbacks is what keeps statements *inside* a transaction timed.
 *
 * NOT TIMED, deliberately: the `BEGIN`/`COMMIT` statements themselves, which
 * postgres.js issues through a closure over the unwrapped client. They are
 * constant-time and uninteresting.
 */
export function withQueryTiming<T extends postgres.Sql>(sql: T, report: QueryTimingReporter): T {
  return new Proxy(sql, {
    get(target, property, receiver) {
      if (property === 'unsafe') {
        return (text: string, params?: unknown[], options?: unknown) =>
          time(
            (target.unsafe as (...args: unknown[]) => PendingQuery)(text, params, options),
            text,
            report,
          );
      }

      if (property === 'begin' || property === 'savepoint') {
        // `savepoint` only exists on the transaction-scoped client, which is a
        // narrower type than `Sql` — hence the indexed lookup rather than a
        // property access.
        const original = (target as unknown as Record<string, AnyFunction | undefined>)[property];
        // `savepoint` is genuinely absent on a top-level client; fall through to
        // the default lookup so the caller sees the same TypeError it would
        // without the proxy.
        if (typeof original !== 'function') return Reflect.get(target, property, receiver);

        return (...args: unknown[]) => {
          const callback = args.at(-1);
          if (typeof callback !== 'function') return original.call(target, ...args);

          // Re-wrap the transaction-scoped client, or every statement in every
          // transaction — which is most of the write path — goes untimed.
          const wrapped = (inner: postgres.Sql) =>
            (callback as (c: postgres.Sql) => unknown)(withQueryTiming(inner, report));

          return original.call(target, ...args.slice(0, -1), wrapped);
        };
      }

      const value = Reflect.get(target, property, receiver) as unknown;
      // Bound to the target, not the proxy: postgres.js's own methods must see
      // the real client as `this`.
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as T;
}

/**
 * postgres.js returns `class Query extends Promise`, and drizzle chains
 * `.values()` on it — which returns `this`. So the SAME OBJECT has to come back
 * from here; handing over a wrapper (or a `.then(...)` result) loses the flag
 * drizzle is about to set and the rows come back in the wrong shape.
 *
 * `then` is therefore shadowed as an own property rather than replaced. It is
 * also why nothing here calls `.then()` itself: `Query#then` invokes `handle()`,
 * which SENDS the statement, and doing that before drizzle has called
 * `.values()` would execute the query in the wrong mode. `catch` and `finally`
 * both route through `then`, so one shadow covers every settlement path.
 */
function time(query: PendingQuery, text: string, report: QueryTimingReporter): PendingQuery {
  const startedAt = process.hrtime.bigint();
  const inner = query.then;

  /**
   * A statement executes once (postgres.js guards `handle()` with an `executed`
   * flag) so it must be reported once — but `then` can legitimately be called
   * more than once on the same Query. Inside a transaction postgres.js attaches
   * its own continuation to sequence the queued statements, so every query in a
   * transaction was being counted twice: right duration, doubled `dbCalls`, and
   * two log lines for one slow query.
   */
  let reported = false;

  query.then = function patchedThen(
    this: PendingQuery,
    onFulfilled?: OnFulfilled,
    onRejected?: OnRejected,
  ) {
    const settle = () => {
      if (reported) return;
      reported = true;
      report(Number(process.hrtime.bigint() - startedAt) / 1e6, text);
    };

    return inner.call(
      this,
      (rows: unknown) => {
        settle();
        return onFulfilled ? onFulfilled(rows) : rows;
      },
      (error: unknown) => {
        // A failing statement is still a statement, and a slow one that times
        // out is exactly what you want to see in the log.
        settle();
        if (onRejected) return onRejected(error);
        throw error;
      },
    );
  };

  return query;
}

type AnyFunction = (...args: unknown[]) => unknown;
type OnFulfilled = (value: unknown) => unknown;
type OnRejected = (reason: unknown) => unknown;

interface PendingQuery {
  then: (onFulfilled?: OnFulfilled, onRejected?: OnRejected) => unknown;
}

/**
 * Collapses a statement to one log-friendly line.
 *
 * NEVER the parameters. They carry names, phone numbers, addresses and money —
 * a slow-query log is read by more people, and retained longer, than anything
 * that should hold those. Truncated rather than hashed so the line is
 * actionable: the first 300 characters of a query name the tables and the shape
 * of the join, which is the whole reason for logging it.
 */
export function formatSlowQuery(sql: string, maxLength: number): string {
  const collapsed = sql.replace(/\s+/g, ' ').trim();
  return collapsed.length <= maxLength ? collapsed : `${collapsed.slice(0, maxLength)}…`;
}

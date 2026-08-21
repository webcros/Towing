import { Global, Inject, Logger, Module, type OnApplicationShutdown } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import {
  currentRequestContext,
  recordDbCall,
} from '../common/logging/request-context';
import { ENV, type Env } from '../config/env';
import { formatSlowQuery, withQueryTiming } from './query-timing';
import * as schema from './schema';

export type Database = ReturnType<typeof drizzle<typeof schema>>;

/** The handle drizzle hands a `db.transaction(async (tx) => …)` callback. */
export type DatabaseTransaction = Parameters<Parameters<Database['transaction']>[0]>[0];

/**
 * Anything queries can run on — the pool or a transaction.
 *
 * Services that must work BOTH inside a caller's transaction and standalone
 * take this. `BookingStateMachineService.transition` is the case that forced
 * it: a transition is never the only thing happening (Phase 17 assigns a driver
 * and locks a truck alongside it), so it has to accept the caller's `tx` — but
 * `Database` is the pool type and a transaction handle is not assignable to it.
 */
export type DatabaseExecutor = Database | DatabaseTransaction;

/**
 * The read handle is deliberately the SAME TYPE as the write handle. A brand
 * would infect every helper signature for no runtime safety; the enforcement
 * that matters is (a) a replica that rejects writes at the server once one
 * exists, and (b) `sole-writer.spec.ts`, which fails any file that injects
 * `DB_READER` and also calls `.insert(`/`.update(`/`.delete(`.
 */
export type DatabaseReader = Database;

/** DI token for the Drizzle client. */
export const DB = Symbol('DB');
/** DI token for the raw postgres.js connection (needed to close the pool). */
export const PG = Symbol('PG');

/**
 * Read-only Drizzle client (§9.3.8 AC). Take this in any repo or service that
 * never writes — earnings, reports, statements, the jobs feed, alerts, the
 * dashboard compute.
 *
 * **Rule: never split one repo across two handles.** A read that must be
 * consistent with a write it just performed (`assignTruck` returning the
 * updated row) breaks the moment the reader is a real replica.
 */
export const DB_READER = Symbol('DB_READER');
export const PG_READER = Symbol('PG_READER');

const slowQueryLogger = new Logger('SlowQuery');

/**
 * Adds statement timing to a pool, unless `DB_SLOW_QUERY_MS` is 0.
 *
 * Every statement pays one `process.hrtime.bigint()` pair and a closure; the
 * log line only appears above the threshold. The default threshold is the
 * §19.1 p95 budget for an entire request, so anything that trips it can blow
 * the SLO on its own.
 */
function instrument(env: Env, sql: postgres.Sql): postgres.Sql {
  if (env.DB_SLOW_QUERY_MS <= 0) return sql;

  return withQueryTiming(sql, (durationMs, text) => {
    recordDbCall(durationMs);
    if (durationMs < env.DB_SLOW_QUERY_MS) return;

    const requestId = currentRequestContext()?.requestId ?? '-';
    slowQueryLogger.warn(
      `[${requestId}] ${durationMs.toFixed(1)}ms ${formatSlowQuery(text, env.DB_SLOW_QUERY_SQL_MAX)}`,
    );
  });
}

@Global()
@Module({
  providers: [
    {
      provide: PG,
      inject: [ENV],
      useFactory: (env: Env) =>
        instrument(
          env,
          postgres(env.DATABASE_URL, {
            max: env.DATABASE_POOL_MAX,
            // Drizzle builds its own SQL; postgres.js template caching adds
            // nothing here and keeps prepared statements alive across pools.
            prepare: false,
            onnotice: () => {},
          }),
        ),
    },
    {
      provide: DB,
      inject: [PG],
      useFactory: (sql: postgres.Sql) => drizzle(sql, { schema }),
    },
    {
      provide: PG_READER,
      inject: [ENV, PG],
      useFactory: (env: Env, primary: postgres.Sql) =>
        env.DATABASE_READ_URL
          ? instrument(
              env,
              postgres(env.DATABASE_READ_URL, {
                max: env.DATABASE_READ_POOL_MAX,
                prepare: false,
                onnotice: () => {},
              }),
            )
          : // Literally the same object, not a second pool to the same host —
            // otherwise every developer and every CI run would silently double
            // its connection count for a seam nobody has switched on yet.
            //
            // ⚠ This is the ALREADY-INSTRUMENTED primary, which is why the
            // identity check in onApplicationShutdown still holds. Wrapping it
            // again here would produce a second Proxy over the same pool,
            // `readerSql !== sql` would be true, and shutdown would call end()
            // on one pool twice.
            primary,
    },
    {
      provide: DB_READER,
      inject: [PG_READER],
      useFactory: (sql: postgres.Sql) => drizzle(sql, { schema }),
    },
  ],
  exports: [DB, PG, DB_READER, PG_READER],
})
export class DbModule implements OnApplicationShutdown {
  private readonly logger = new Logger(DbModule.name);

  constructor(
    @Inject(PG) private readonly sql: postgres.Sql,
    @Inject(PG_READER) private readonly readerSql: postgres.Sql,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    // Order matters and so does the identity check: with DATABASE_READ_URL
    // unset the reader IS the primary, and calling end() twice on one pool
    // throws on the second call.
    if (this.readerSql !== this.sql) {
      try {
        await this.readerSql.end({ timeout: 5 });
      } catch (error) {
        this.logger.warn(`read pool did not close cleanly: ${String(error)}`);
      }
    }

    await this.sql.end({ timeout: 5 });
  }
}

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { loadEnv } from '../config/env';
import { loadDotenv } from '../config/load-dotenv';
import * as schema from '../db/schema';
import { ledgerInvariants } from '../db/ledger/invariants';
import { rebuildEarnings } from '../modules/money/earnings-projector';

/**
 * `pnpm --filter @towing/backend earnings:rebuild [--fleet <id>] [--since <days>]`
 *
 * Cold rebuild of the `earnings_daily` projection. Drives the SAME `projectCell`
 * the BullMQ worker drives — one implementation, two entry points, the
 * `runComplianceSweep` precedent — so a rebuild can never produce numbers the
 * incremental path would not have produced.
 *
 * Safe to run at any time: every cell is recomputed absolutely from the ledger,
 * and cells whose source rows are gone are deleted. It touches no money, only
 * the read projection.
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const flag = (name: string): string | undefined => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
  };

  const fleetId = flag('fleet');
  const sinceRaw = flag('since');
  const sinceDays = sinceRaw ? Number(sinceRaw) : undefined;

  if (sinceRaw !== undefined && (!Number.isFinite(sinceDays) || sinceDays! <= 0)) {
    throw new Error(`--since expects a positive number of days, got "${sinceRaw}"`);
  }

  loadDotenv();
  const env = loadEnv();

  const client = postgres(env.DATABASE_URL, { max: 1, prepare: false, onnotice: () => {} });
  const db = drizzle(client, { schema });

  try {
    const started = Date.now();
    const result = await rebuildEarnings(db, {
      ...(fleetId ? { fleetId } : {}),
      ...(sinceDays ? { sinceDays } : {}),
    });

    console.log(
      `[earnings:rebuild] ${result.cells} cells rebuilt, ${result.deleted} stale removed ` +
        `in ${Date.now() - started}ms` +
        (fleetId ? ` (fleet ${fleetId})` : '') +
        (sinceDays ? ` (last ${sinceDays}d)` : ' (all time)'),
    );

    // The projection is derived from the ledger, so a rebuild is also a cheap
    // opportunity to report whether the source it derived from is sound.
    const invariants = await ledgerInvariants(db);
    console.log(
      `[earnings:rebuild] ledger invariants — wallet ${invariants.walletDrift}, ` +
        `booking ${invariants.bookingDrift}, ledger ${invariants.ledgerDrift}`,
    );
  } finally {
    await client.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  console.error('[earnings:rebuild] failed:', error);
  process.exit(1);
});

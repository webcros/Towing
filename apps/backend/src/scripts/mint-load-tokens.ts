import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { JwtService } from '@nestjs/jwt';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import { loadEnv } from '../config/env';
import { loadDotenv } from '../config/load-dotenv';
import * as schema from '../db/schema';
import { fleets, users } from '../db/schema';

/**
 * Writes access tokens for every seeded fleet, for k6 to read.
 *
 * WHY NOT JUST LOG IN. `verifyPassword` is a deliberately memory-hard scrypt
 * (~16 MiB per call) and the `auth` bucket is 5/min. Two hundred virtual users
 * logging in would measure our password hashing and our rate limiter, neither
 * of which is what the §19.1 latency SLO is about — and the run would spend its
 * first minute in 429s.
 *
 * The tokens are signed with `JwtService` and the real `JWT_ACCESS_SECRET`, so
 * they are byte-identical to what a login produces and `JwtAuthGuard` verifies
 * them the same way. No new dependency: `JwtService` is a plain constructible
 * class.
 */
async function main(): Promise<void> {
  loadDotenv();
  const env = loadEnv();

  if (env.NODE_ENV === 'production') {
    throw new Error('load:tokens refuses to run with NODE_ENV=production');
  }

  const client = postgres(env.DATABASE_URL, { max: 1, prepare: false, onnotice: () => {} });
  const db = drizzle(client, { schema });

  try {
    const rows = await db
      .select({
        fleetId: fleets.id,
        businessName: fleets.businessName,
        ownerId: fleets.ownerId,
      })
      .from(fleets)
      .innerJoin(users, eq(users.id, fleets.ownerId));

    if (rows.length === 0) {
      throw new Error('No fleets found — run `pnpm db:seed:load` first');
    }

    const jwt = new JwtService({
      secret: env.JWT_ACCESS_SECRET,
      // Two hours rather than the production 15 minutes, deliberately: a token
      // expiring mid-run would turn the measurement into a refresh storm, and
      // a load run is not the place to exercise rotation (the refresh-grace
      // spec is).
      signOptions: { expiresIn: '2h' },
    });

    const tokens = rows.map((row) => ({
      fleetId: row.fleetId,
      businessName: row.businessName,
      token: jwt.sign({ sub: row.ownerId, role: 'fleet_owner', fleet_id: row.fleetId }),
    }));

    const target = resolve(__dirname, '../../load/.tokens.json');
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, `${JSON.stringify(tokens, null, 2)}\n`);

    console.log(`[load:tokens] wrote ${tokens.length} tokens to load/.tokens.json (valid 2h)`);
    for (const entry of tokens) console.log(`  ${entry.businessName}`);
  } finally {
    await client.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  console.error('[load:tokens] failed:', error);
  process.exit(1);
});

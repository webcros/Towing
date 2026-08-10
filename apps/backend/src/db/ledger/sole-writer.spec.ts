import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Architecture conventions enforced as a test, because the alternatives are
 * worse. A code review catches a second ledger writer only if the reviewer
 * remembers the rule; a DB trigger would break the seed, the test fixtures and
 * any psql repair. This walks `src/` with `fs` in a few milliseconds, needs no
 * tooling, and fails the moment the rule is broken.
 *
 * §3.4: "Ledger-first wallets — balances are derived from an append-only
 * transaction ledger, never mutated directly." Two writers is not a survivable
 * state: the phase plan says so explicitly, and Track B Phase 19 extends this
 * ledger rather than adding a second one.
 */

const SRC = resolve(__dirname, '../..');

/**
 * Application code only.
 *
 * `*.spec.ts` files are excluded deliberately, not by oversight: a money spec's
 * whole job is to build starting states and then corrupt them — back-dating a
 * credit, deleting one to simulate a dispute reversal, adding a paisa to a
 * balance to prove drift detection works. None of that ships, and forcing it
 * through `LedgerService` would mean the service had to grow methods that exist
 * only so tests can misuse them. The rule that matters is about the runtime.
 */
function sourceFiles(): string[] {
  const out: string[] = [];

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (entry === 'node_modules' || entry === 'dist') continue;
        walk(full);
        continue;
      }
      if (entry.endsWith('.ts') && !entry.endsWith('.spec.ts')) out.push(full);
    }
  };

  walk(SRC);
  return out;
}

const rel = (file: string): string => relative(SRC, file).split(sep).join('/');

describe('LedgerService is the sole wallet_transactions writer', () => {
  /**
   * The seed writes the ledger directly and correctly — it IS the executable
   * specification for the transaction shape, and it runs outside a DI
   * container. Test fixtures must be able to build arbitrary starting states,
   * including ones the service would refuse. Everything else goes through the
   * service.
   */
  const ALLOWED = [
    'db/schema/money.ts',
    'db/ledger/ledger.service.ts',
    'db/ledger/invariants.ts',
    'db/seed/seed.ts',
    'test/fixtures.ts',
  ];

  // Drizzle form and raw-SQL form. Reads (`select … from wallet_transactions`)
  // are deliberately unrestricted: `drivers.repo.ts` and `dashboard.service.ts`
  // legitimately SUM the ledger, and so does every earnings query.
  const WRITE_PATTERNS = [
    /\.insert\(\s*walletTransactions/,
    /insert\s+into\s+wallet_transactions/i,
    /update\s+wallet_transactions/i,
    /delete\s+from\s+wallet_transactions/i,
    /\.update\(\s*walletTransactions/,
    /\.delete\(\s*walletTransactions/,
  ];

  it('no file outside the allowlist writes wallet_transactions', () => {
    const offenders = sourceFiles()
      .filter((file) => !ALLOWED.includes(rel(file)))
      .filter((file) => {
        const source = readFileSync(file, 'utf8');
        return WRITE_PATTERNS.some((pattern) => pattern.test(source));
      })
      .map(rel);

    expect(
      offenders,
      'These files write the ledger directly. Route the write through LedgerService.post() — ' +
        'two ledger writers is not a survivable state (§3.4, §14.1).',
    ).toEqual([]);
  });

  it('the allowlist has no stale entries', () => {
    const existing = new Set(sourceFiles().map(rel));
    expect(ALLOWED.filter((entry) => !existing.has(entry))).toEqual([]);
  });
});

describe('DB_READER is never used to write', () => {
  /**
   * §9.3.8 AC: "report queries hit read paths (no impact on live ops)". Once
   * `DATABASE_READ_URL` points at a real replica, a write through the reader
   * fails at the server — but only in the environment that has a replica.
   * This catches it in CI instead.
   */
  it('no file that injects DB_READER also issues a write', () => {
    const offenders = sourceFiles()
      .filter((file) => rel(file) !== 'db/db.module.ts')
      .filter((file) => {
        const source = readFileSync(file, 'utf8');
        if (!/@Inject\(\s*DB_READER\s*\)/.test(source)) return false;
        return /\.insert\(/.test(source) || /\.update\(/.test(source) || /\.delete\(/.test(source);
      })
      .map(rel);

    expect(
      offenders,
      'These files read through DB_READER but also write. Split the concern, or take DB — ' +
        'never split one repository across two handles.',
    ).toEqual([]);
  });
});

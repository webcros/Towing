import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * An architecture convention enforced as a test, in the same style (and for the
 * same reasons) as `db/ledger/sole-writer.spec.ts`.
 *
 * THE HAZARD. Phase 10 widened `verifyAccessToken` from `FleetAccessClaims` to
 * the four-realm `AccessClaims` union, so reading `claims.fleet_id` outside the
 * guard is now a compile error. The tempting fix is `claims as FleetAccessClaims`
 * — which compiles, looks harmless, and skips the realm check that makes the
 * whole four-realm design safe. The result is a route that accepts a driver or
 * customer token and reads a tenant id off it that may not be there.
 *
 * Narrowing is what this codebase wants instead: `if (claims.role !== ...)`, or
 * `'fleet_id' in claims`, both of which the compiler checks. `JwtAuthGuard` is
 * the one place allowed to bridge from an unverified payload to typed claims,
 * and it does the realm check first.
 */

const SRC = resolve(__dirname, '../..');
const AUTH_DIR = 'modules/auth/';

/** Application code only — a spec may legitimately fabricate a claim shape. */
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

describe('claims are narrowed, never cast', () => {
  it('no file outside modules/auth casts to a realm-specific claims type', () => {
    const CAST = /\bas\s+(Fleet|Driver|Customer|Admin)AccessClaims\b/;

    const offenders = sourceFiles()
      .map(rel)
      .filter((file) => !file.startsWith(AUTH_DIR))
      .filter((file) => CAST.test(readFileSync(join(SRC, file), 'utf8')));

    expect(offenders, 'narrow with a role check instead of asserting the claim type').toEqual([]);
  });

  it('JwtAuthGuard checks the realm before it reads any realm-specific claim', () => {
    // Ordering is the property: a token whose realm is wrong must fail as a 403
    // ("authenticated, wrong console") before anything reads `fleet_id` or
    // `sub_role` off it. Reversed, a missing `sub_role` on an admin token would
    // report as a malformed-token 401 — and `jwt-auth.guard.spec.ts` pins that
    // exact status.
    const guard = readFileSync(join(SRC, 'modules/auth/jwt-auth.guard.ts'), 'utf8');
    // From the class body, so the import block's mention of ROLES_KEY does not
    // count as "checked first".
    const body = guard.slice(guard.indexOf('async canActivate('));

    const realmCheck = body.indexOf('allowed.includes(realm)');
    const fleetIdRead = body.indexOf("'fleet_id' in claims");
    const rolesCheck = body.indexOf('ROLES_KEY');

    expect(realmCheck).toBeGreaterThan(-1);
    expect(fleetIdRead).toBeGreaterThan(realmCheck);
    expect(rolesCheck).toBeGreaterThan(realmCheck);
  });

  it('the realm predicate stays inside the conditional UPDATE in rotate()', () => {
    /**
     * Moved to a check AFTER the claim, probing the wrong endpoint with a valid
     * token would stamp `rotated_at` on a row the prober does not own — and the
     * victim's next legitimate refresh would trip reuse detection and burn their
     * whole family. `realm-isolation.e2e.spec.ts` asserts the behaviour; this
     * asserts the shape, because the behavioural test would still pass if the
     * check moved and the family happened not to be burned in that path.
     */
    const service = readFileSync(join(SRC, 'modules/auth/token.service.ts'), 'utf8');
    const rotate = service.slice(service.indexOf('async rotate('), service.indexOf('async logout('));

    const update = rotate.indexOf('.update(refreshTokens)');
    const realmPredicate = rotate.indexOf('inArray(refreshTokens.realm');
    const returning = rotate.indexOf('.returning()');

    expect(update).toBeGreaterThan(-1);
    expect(realmPredicate).toBeGreaterThan(update);
    expect(realmPredicate).toBeLessThan(returning);
  });
});

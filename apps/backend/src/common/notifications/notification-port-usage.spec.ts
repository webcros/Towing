import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', '..');
const ALLOWED_PREFIX = join('common', 'notifications');

/**
 * INVARIANT 69, made enforceable rather than aspirational.
 *
 * Before Phase 13, four domain services injected `NOTIFICATIONS` and built a
 * `to` by hand. Two of them passed a UUID — `compliance.service.ts` a fleet id,
 * `payouts.service.ts` an owner id — into a field the port documents as "E.164
 * phone or email address". Against `LogNotificationAdapter` that printed a UUID
 * and nobody noticed for two phases; against a real provider it is a 400 on
 * every send, or a silent accept.
 *
 * The structural fix is that producers call
 * `NotificationService.emit(event, domainIds)` and a trigger's `resolve()` is
 * the only thing in the system that produces an address. This test is what
 * stops the next person shortcutting back around it — a code review cannot be
 * relied on to catch the fifth call site in two years' time.
 */
describe('NotificationPort usage', () => {
  it('is injected only inside src/common/notifications', () => {
    const offenders = walk(SRC)
      .filter((file) => /\.ts$/.test(file) && !file.endsWith('.spec.ts'))
      .filter((file) => !relative(SRC, file).startsWith(ALLOWED_PREFIX))
      .filter((file) => {
        const source = readFileSync(file, 'utf8');
        // The token, not the type: importing `NotificationChannel` for a
        // signature is fine — injecting the port and calling `notify()` is not.
        return /\bNOTIFICATIONS\b/.test(source);
      })
      .map((file) => relative(SRC, file).split(sep).join('/'));

    expect(offenders).toEqual([]);
  });

  it('keeps the emit seam the only producer-facing API', () => {
    const offenders = walk(SRC)
      .filter((file) => /\.ts$/.test(file) && !file.endsWith('.spec.ts'))
      .filter((file) => !relative(SRC, file).startsWith(ALLOWED_PREFIX))
      .filter((file) => /\.notify\s*\(/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(SRC, file).split(sep).join('/'));

    expect(offenders).toEqual([]);
  });
});

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

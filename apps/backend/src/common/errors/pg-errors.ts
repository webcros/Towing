/**
 * Postgres error inspection. Drizzle wraps driver errors (the postgres.js
 * error may sit on `cause`), so both levels are checked.
 */
export function isUniqueViolation(err: unknown): boolean {
  return pgCode(err) === '23505';
}

function pgCode(err: unknown): string | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const direct = (err as { code?: unknown }).code;
  if (typeof direct === 'string') return direct;
  const cause = (err as { cause?: unknown }).cause;
  if (typeof cause === 'object' && cause !== null) {
    const nested = (cause as { code?: unknown }).code;
    if (typeof nested === 'string') return nested;
  }
  return undefined;
}

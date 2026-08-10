import { expect } from 'vitest';
import type { z } from 'zod';

/**
 * Asserts a response body is EXACTLY what its api-contracts schema describes.
 *
 * Two failures in one assertion, and the second is the interesting one:
 *
 *  - `parse` throws on a missing or wrongly-typed field, with the exact path.
 *  - Zod strips keys the schema does not declare, so the parsed value differs
 *    from the input whenever the server returned something undeclared — and
 *    `toEqual` catches it. That is the direction that actually bites: a handler
 *    that leaks an internal column, or a customer's phone number onto a screen
 *    the contract says has no customer data, is a defect no type ever sees
 *    because the extra field is simply invisible to TypeScript.
 *
 * Verified empirically against the installed Zod (4.4.3): `z.object()` strips
 * unknown keys at the top level, inside `z.array()`, and inside
 * `z.discriminatedUnion()`; and an absent `.optional()` key is NOT materialised
 * as `undefined`, which would otherwise have made every optional field a false
 * positive.
 *
 * ⚠ TWO PRECONDITIONS.
 *
 * 1. RESPONSE schemas only. This is unsound for any schema containing
 *    `.transform()` or `z.coerce.*`, where the parsed value differs from the
 *    input by design and `toEqual` would fail on a correct response. Those all
 *    live on the request side here (`truckImportRowSchema`, `alertsQuerySchema`,
 *    `complianceUpsertSchema`); none of the response schemas has one.
 * 2. It compares JSON to JSON. `z.iso.datetime()` is string-to-string, so
 *    nothing here ever produces a `Date`.
 *
 * A `.default()` in a response schema WILL fail when the server omits the key.
 * That is a true positive, not a quirk — `fleetSettingsSchema` embeds
 * notification prefs whose booleans have defaults, and a server that stops
 * sending one would otherwise silently start relying on the client's default.
 */
export function expectMatchesContract<T extends z.ZodType>(schema: T, body: unknown): z.output<T> {
  const parsed = schema.parse(body) as z.output<T>;
  expect(parsed).toEqual(body);
  return parsed;
}

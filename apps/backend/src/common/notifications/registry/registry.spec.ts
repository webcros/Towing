import { describe, expect, it } from 'vitest';
import { notificationCategorySchema, notificationChannelSchema } from '@towing/api-contracts';
import { TEMPLATES } from '../template-catalog';
import { MATRIX_12_2, MATRIX_12_2_ROW_COUNT } from './matrix-12-2';
import { DEFERRED_TRIGGERS, REGISTERED_TRIGGERS } from './triggers';

/**
 * THE COMPLETENESS RATCHET — the durable half of Phase 13.
 *
 * Its job is not to check that today's six triggers work; the e2e suites do
 * that. Its job is to make it IMPOSSIBLE for a later phase to ship a feature
 * and silently forget the notification the product promised for it. Phase 15
 * cannot land booking creation without claiming `booking_confirmed`, Phase 17
 * cannot land dispatch without `job_offered` and `search_widening`, and so on —
 * because deleting a `DEFERRED_TRIGGERS` entry without adding a registered one
 * fails right here.
 *
 * ⚠ IF THIS TEST FAILS, THE FIX IS ALMOST NEVER TO EDIT `matrix-12-2.ts`.
 * That file is a transcription of the spec. Editing a row to make the suite
 * green is precisely the failure this exists to prevent.
 */
describe('§12.2 trigger registry', () => {
  it('transcribes every row of the spec table', () => {
    expect(MATRIX_12_2).toHaveLength(MATRIX_12_2_ROW_COUNT);

    // Duplicated keys would let one row silently shadow another.
    const keys = MATRIX_12_2.map((row) => row.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('accounts for every §12.2 row — registered or explicitly deferred, never absent', () => {
    const registered = new Set(
      REGISTERED_TRIGGERS.map((trigger) => trigger.matrixRow).filter(Boolean),
    );
    const deferred = new Set(DEFERRED_TRIGGERS.map((row) => row.matrixRow));

    const unaccounted = MATRIX_12_2.filter(
      (row) => !registered.has(row.key) && !deferred.has(row.key),
    );

    expect(
      unaccounted.map((row) => `${row.key} — "${row.label}" (${row.recipient})`),
    ).toEqual([]);
  });

  it('reports the rows still waiting on a later phase, by name', () => {
    const pending = DEFERRED_TRIGGERS.map((row) => {
      const matrix = MATRIX_12_2.find((m) => m.key === row.matrixRow);
      return `P${row.unregisteredUntilPhase}  ${row.matrixRow.padEnd(34)} ${matrix?.label ?? '??'}`;
    }).sort();

    // Printed, not asserted against a count: the list SHRINKS as later phases
    // land, and a hard-coded expectation would just be one more thing to
    // update — while a phase that quietly re-deferred a row would still pass it.
    // eslint-disable-next-line no-console
    console.log(`\n§12.2 rows not yet wired (${pending.length}):\n${pending.join('\n')}\n`);

    for (const row of DEFERRED_TRIGGERS) {
      // A deferral must name a real row and a real phase, or it is a way to
      // make this suite green by inventing a key nothing checks.
      expect(MATRIX_12_2.some((m) => m.key === row.matrixRow)).toBe(true);
      expect(row.reason.length).toBeGreaterThan(20);
    }
  });

  it('never both registers and defers the same row', () => {
    const registered = new Set(
      REGISTERED_TRIGGERS.map((trigger) => trigger.matrixRow).filter(Boolean),
    );
    const both = DEFERRED_TRIGGERS.filter((row) => registered.has(row.matrixRow));

    expect(both.map((row) => row.matrixRow)).toEqual([]);
  });

  it('only sends a row on channels the spec table gives it', () => {
    const offenders: string[] = [];

    for (const trigger of REGISTERED_TRIGGERS) {
      if (!trigger.matrixRow) continue; // operational template, not a §12.2 row
      const matrix = MATRIX_12_2.find((row) => row.key === trigger.matrixRow);
      expect(matrix, `${trigger.event} claims unknown row ${trigger.matrixRow}`).toBeDefined();

      const extra = trigger.channels.filter((channel) => !matrix!.channels.includes(channel));
      if (extra.length > 0) offenders.push(`${trigger.event}: ${extra.join(', ')}`);
    }

    expect(offenders).toEqual([]);
  });

  it('declares a template that exists and a category the CHECK constraint permits', () => {
    for (const trigger of REGISTERED_TRIGGERS) {
      expect(Object.keys(TEMPLATES), `${trigger.event}`).toContain(trigger.template);

      // `ck_notifications_category` in migration 0010 pins the same six values.
      // A divergence here fails a test; a divergence without it would fail an
      // INSERT in production.
      expect(() => notificationCategorySchema.parse(trigger.category)).not.toThrow();

      for (const channel of trigger.channels) {
        expect(() => notificationChannelSchema.parse(channel)).not.toThrow();
      }
    }
  });

  it('gives every registered trigger a unique event key', () => {
    const events = REGISTERED_TRIGGERS.map((trigger) => trigger.event);
    expect(new Set(events).size).toBe(events.length);
  });

  it('keeps transactional and safety rows always-on (§12.3)', () => {
    const suppressible = REGISTERED_TRIGGERS.filter(
      (trigger) =>
        (trigger.category === 'transactional' || trigger.category === 'safety') &&
        !trigger.alwaysOn,
    );

    // §12.3: "channel opt-outs where legally allowed; transactional/safety
    // always on". A preference must never be able to suppress a KYC rejection.
    expect(suppressible.map((trigger) => trigger.event)).toEqual([]);
  });

  it('ships the four §12.2 email templates even where only two are wired', () => {
    // Plan L1100 asks for all four email-required rows' templates in this
    // phase; only compliance-expiring and payout have emitters today. The
    // other two exist with their variable sets agreed so Phase 19 adds a
    // trigger rather than inventing copy under deadline.
    expect(Object.keys(TEMPLATES)).toEqual(
      expect.arrayContaining([
        'fleet_compliance_expiring',
        'payout_paid',
        'payout_failed',
        'job_invoice_email',
        'payment_receipt_email',
      ]),
    );
  });
});

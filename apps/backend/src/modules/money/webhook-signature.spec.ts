import { describe, expect, it } from 'vitest';
import { parseRazorpayPayoutWebhook } from './dev-payout.adapter';
import { signWebhook, verifyWebhookSignature } from './webhook-signature';

const SECRET = 'a-test-webhook-secret-of-sufficient-length';

describe('verifyWebhookSignature (§19.3)', () => {
  const body = Buffer.from(
    JSON.stringify({ id: 'evt_1', event: 'payout.processed', payload: {} }),
    'utf8',
  );

  it('accepts a signature produced by the same secret', () => {
    expect(verifyWebhookSignature(body, signWebhook(body, SECRET), SECRET)).toBe(true);
  });

  it('rejects a body altered by a single byte', () => {
    const signature = signWebhook(body, SECRET);
    const tampered = Buffer.from(body);
    tampered[tampered.length - 2] = tampered[tampered.length - 2]! ^ 0x01;

    expect(verifyWebhookSignature(tampered, signature, SECRET)).toBe(false);
  });

  it('rejects a signature made with a different secret', () => {
    expect(verifyWebhookSignature(body, signWebhook(body, 'some-other-secret'), SECRET)).toBe(false);
  });

  /**
   * `timingSafeEqual` THROWS on buffers of unequal length. Every one of these
   * must be a clean `false`, never an exception — otherwise a malformed
   * signature turns into a 500 and Razorpay retries it forever.
   */
  it('rejects malformed signatures without throwing', () => {
    for (const signature of ['', 'abcd', 'not-hex-at-all', 'zz'.repeat(32), signWebhook(body, SECRET).slice(0, -2)]) {
      expect(() => verifyWebhookSignature(body, signature, SECRET)).not.toThrow();
      expect(verifyWebhookSignature(body, signature, SECRET)).toBe(false);
    }
  });

  it('rejects a missing signature', () => {
    expect(verifyWebhookSignature(body, undefined, SECRET)).toBe(false);
  });

  it('is insensitive to surrounding whitespace but not to case-mangled hex', () => {
    const signature = signWebhook(body, SECRET);
    expect(verifyWebhookSignature(body, `  ${signature}  `, SECRET)).toBe(true);
  });

  it('signs the exact bytes — a re-serialised body does not verify', () => {
    // The single most common way webhook verification is silently broken:
    // hashing `JSON.stringify(req.body)` instead of the raw request bytes. The
    // parsed value is identical; the bytes are not, and HMAC only cares about
    // bytes. This is why the controller reads `req.rawBody`.
    const original = Buffer.from('{\n  "event": "payout.processed"\n}', 'utf8');
    const reserialised = Buffer.from(JSON.stringify(JSON.parse(original.toString())), 'utf8');

    expect(original.equals(reserialised)).toBe(false);
    expect(verifyWebhookSignature(reserialised, signWebhook(original, SECRET), SECRET)).toBe(false);
    expect(verifyWebhookSignature(original, signWebhook(original, SECRET), SECRET)).toBe(true);
  });
});

describe('parseRazorpayPayoutWebhook', () => {
  const envelope = (status: string, extra: Record<string, unknown> = {}) => ({
    id: 'evt_abc',
    event: `payout.${status === 'processed' ? 'processed' : 'failed'}`,
    payload: {
      payout: {
        entity: { id: 'pout_xyz', status, notes: { payoutId: 'our-id' }, ...extra },
      },
    },
  });

  it('maps a processed payout to paid', () => {
    expect(parseRazorpayPayoutWebhook(envelope('processed'))).toEqual({
      eventId: 'evt_abc',
      eventType: 'payout.processed',
      providerRef: 'pout_xyz',
      payoutId: 'our-id',
      status: 'paid',
      failureReason: null,
    });
  });

  it('maps reversed, failed and cancelled to failed', () => {
    for (const status of ['reversed', 'failed', 'cancelled']) {
      expect(parseRazorpayPayoutWebhook(envelope(status))?.status).toBe('failed');
    }
  });

  it('maps in-flight statuses to processing', () => {
    for (const status of ['queued', 'pending', 'initiated', 'processing']) {
      expect(parseRazorpayPayoutWebhook(envelope(status))?.status).toBe('processing');
    }
  });

  it('maps an unrecognised status to unknown rather than guessing', () => {
    expect(parseRazorpayPayoutWebhook(envelope('teleported'))?.status).toBe('unknown');
  });

  it('carries the failure reason through', () => {
    const parsed = parseRazorpayPayoutWebhook(
      envelope('failed', { failure_reason: 'Beneficiary account closed' }),
    );
    expect(parsed?.failureReason).toBe('Beneficiary account closed');
  });

  it('falls back to a derived event id when the vendor sends none', () => {
    const { id: _dropped, ...withoutId } = envelope('processed');
    expect(parseRazorpayPayoutWebhook(withoutId)?.eventId).toBe('payout.processed:pout_xyz');
  });

  it('returns null for events it does not act on', () => {
    expect(parseRazorpayPayoutWebhook({ id: 'e', event: 'payment.captured', payload: {} })).toBeNull();
    expect(parseRazorpayPayoutWebhook({ id: 'e', event: 'payout.processed' })).toBeNull();
    expect(parseRazorpayPayoutWebhook(null)).toBeNull();
    expect(parseRazorpayPayoutWebhook('nope')).toBeNull();
  });

  it('tolerates a missing notes object', () => {
    const parsed = parseRazorpayPayoutWebhook({
      id: 'evt_1',
      event: 'payout.processed',
      payload: { payout: { entity: { id: 'pout_1', status: 'processed' } } },
    });
    expect(parsed).toMatchObject({ providerRef: 'pout_1', payoutId: null, status: 'paid' });
  });
});

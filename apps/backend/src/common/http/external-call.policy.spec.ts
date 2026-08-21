import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadEnv } from '../../config/env';
import { MetricsService } from '../observability/metrics.service';
import {
  CircuitOpenError,
  ExternalCallPolicy,
  ExternalCallTimeoutError,
} from './external-call.policy';

function policyWith(overrides: Record<string, string> = {}) {
  const env = loadEnv({
    ...process.env,
    EXTERNAL_CALL_TIMEOUT_MS: '50',
    EXTERNAL_CALL_BREAKER_THRESHOLD: '3',
    EXTERNAL_CALL_BREAKER_RESET_MS: '10000',
    ...overrides,
  } as NodeJS.ProcessEnv);

  return new ExternalCallPolicy(env, new MetricsService(env));
}

describe('ExternalCallPolicy', () => {
  let policy: ExternalCallPolicy;

  beforeEach(() => {
    policy = policyWith();
  });

  it('returns the value on a first-attempt success', async () => {
    const result = await policy.run({ vendor: 'test' }, async () => 'ok');
    expect(result).toBe('ok');
  });

  it('retries a retryable failure and succeeds', async () => {
    let calls = 0;
    const result = await policy.run({ vendor: 'test', attempts: 3, backoffMs: 1 }, async () => {
      calls += 1;
      if (calls < 3) throw new Error('flaky');
      return 'ok';
    });

    expect(result).toBe('ok');
    expect(calls).toBe(3);
  });

  it('does not retry when the caller says the failure is permanent', async () => {
    let calls = 0;

    await expect(
      policy.run(
        { vendor: 'test', attempts: 5, backoffMs: 1, isRetryable: () => false },
        async () => {
          calls += 1;
          throw new Error('bad request');
        },
      ),
    ).rejects.toThrow('bad request');

    // A 4xx from a vendor will be just as 4xx next time. Burning the budget on
    // it only delays the DLQ landing that would have told somebody.
    expect(calls).toBe(1);
  });

  it('aborts a call that exceeds the timeout, and tells the callee', async () => {
    let aborted = false;

    await expect(
      policy.run({ vendor: 'test', attempts: 1, timeoutMs: 20 }, async (signal) => {
        signal.addEventListener('abort', () => {
          aborted = true;
        });
        await new Promise((resolve) => setTimeout(resolve, 200));
        return 'never';
      }),
    ).rejects.toBeInstanceOf(ExternalCallTimeoutError);

    // The signal is what makes this real rather than cosmetic: without the
    // callee honouring it, a hung socket keeps the worker parked whatever this
    // wrapper reports.
    expect(aborted).toBe(true);
  });

  it('opens the breaker after consecutive failures and short-circuits', async () => {
    let calls = 0;
    const failing = async () => {
      calls += 1;
      throw new Error('vendor down');
    };

    for (let i = 0; i < 3; i += 1) {
      await expect(policy.run({ vendor: 'down', attempts: 1 }, failing)).rejects.toThrow(
        'vendor down',
      );
    }
    expect(calls).toBe(3);

    // The fourth call never reaches the vendor.
    await expect(policy.run({ vendor: 'down', attempts: 1 }, failing)).rejects.toBeInstanceOf(
      CircuitOpenError,
    );
    expect(calls).toBe(3);
  });

  it('keeps breakers per vendor, so one outage does not silence another', async () => {
    const failing = async () => {
      throw new Error('down');
    };

    for (let i = 0; i < 3; i += 1) {
      await expect(policy.run({ vendor: 'msg91', attempts: 1 }, failing)).rejects.toThrow();
    }

    await expect(
      policy.run({ vendor: 'msg91', attempts: 1 }, failing),
    ).rejects.toBeInstanceOf(CircuitOpenError);

    // A dead SMS provider must not stop push going out.
    await expect(policy.run({ vendor: 'expo', attempts: 1 }, async () => 'ok')).resolves.toBe('ok');
  });

  it('half-opens after the reset window and closes on a successful probe', async () => {
    // Long enough that the "still open" assertion below cannot race the window
    // expiring, short enough that the test stays fast. A 1 ms window made this
    // flaky: the breaker had already half-opened by the next line, so the call
    // went through and threw the vendor error instead of `CircuitOpenError`.
    const RESET_MS = 150;
    const fast = policyWith({ EXTERNAL_CALL_BREAKER_RESET_MS: String(RESET_MS) });
    const failing = async () => {
      throw new Error('down');
    };

    for (let i = 0; i < 3; i += 1) {
      await expect(fast.run({ vendor: 'flappy', attempts: 1 }, failing)).rejects.toThrow();
    }
    await expect(fast.run({ vendor: 'flappy', attempts: 1 }, failing)).rejects.toBeInstanceOf(
      CircuitOpenError,
    );

    await new Promise((resolve) => setTimeout(resolve, RESET_MS + 25));

    await expect(fast.run({ vendor: 'flappy', attempts: 1 }, async () => 'back')).resolves.toBe(
      'back',
    );
    // Closed again — a recovered vendor must not stay locked out.
    await expect(fast.run({ vendor: 'flappy', attempts: 1 }, async () => 'still')).resolves.toBe(
      'still',
    );
  });

  it('jitters the backoff so co-failing workers do not retry in lockstep', async () => {
    const random = vi.spyOn(Math, 'random');
    let calls = 0;

    await policy.run({ vendor: 'test', attempts: 3, backoffMs: 4 }, async () => {
      calls += 1;
      if (calls < 3) throw new Error('flaky');
      return 'ok';
    });

    // Without jitter, N workers that failed together hit the vendor's recovery
    // window as the same thundering herd that arguably caused the outage.
    expect(random).toHaveBeenCalled();
    random.mockRestore();
  });

  it('counts a success against the breaker’s failure streak', async () => {
    const failing = async () => {
      throw new Error('down');
    };

    await expect(policy.run({ vendor: 'mixed', attempts: 1 }, failing)).rejects.toThrow();
    await expect(policy.run({ vendor: 'mixed', attempts: 1 }, failing)).rejects.toThrow();
    await policy.run({ vendor: 'mixed', attempts: 1 }, async () => 'ok');

    // Two more failures would trip a breaker counting cumulatively; it counts
    // CONSECUTIVE failures, so an intermittently healthy vendor stays usable.
    await expect(policy.run({ vendor: 'mixed', attempts: 1 }, failing)).rejects.toThrow('down');
    await expect(policy.run({ vendor: 'mixed', attempts: 1 }, failing)).rejects.toThrow('down');
  });
});

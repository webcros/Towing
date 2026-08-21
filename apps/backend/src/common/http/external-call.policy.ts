import { Inject, Injectable, Logger } from '@nestjs/common';
import { ENV, type Env } from '../../config/env';
import { MetricsService } from '../observability/metrics.service';

/**
 * §19.3 — the one wrapper every outbound third-party call goes through:
 * explicit timeout, bounded retry with exponential backoff **and jitter**, a
 * per-vendor circuit breaker, and per-vendor metrics.
 *
 * BUILT HERE, NOT IN PHASE 14, because the plan says so (L1102: "or, if 14 has
 * not landed, this phase builds it and 14 reuses it — one policy, not four")
 * and 14 has not landed. Phase 14 applies it to `RoutingPort`/`GeocodingPort`,
 * Phase 19 to `PaymentGatewayPort`. Nothing here is notification-specific;
 * `razorpay-route.adapter.ts` is deliberately NOT migrated onto it in this
 * phase — that belongs with 14, where the second consumer actually appears.
 *
 * WHY THIS IS NOT REDUNDANT WITH BULLMQ. BullMQ retries the *job*; this bounds
 * the *call*. Without it a hung MSG91 socket parks a queue worker for as long
 * as the OS keeps the connection open — the retry ladder never even starts —
 * and a dead vendor burns every attempt at full timeout before the DLQ sees it.
 * The breaker is also what §19.2's degradation ladder needs a *detector* for:
 * "Maps degraded → Haversine" is a fallback with nothing to trigger it unless
 * something notices.
 *
 * Hand-rolled rather than opossum: ~60 lines against a dependency whose event
 * model, half-open semantics and metrics we would adapt anyway, in a repo that
 * adds dependencies reluctantly.
 */

export interface ExternalCallOptions {
  /** Metric label and breaker key — one breaker per vendor, not per call site. */
  vendor: string;
  /** Total attempts including the first. 1 disables retry. */
  attempts?: number;
  /** Base delay for exponential backoff. Jitter is applied on top. */
  backoffMs?: number;
  /** Overrides `EXTERNAL_CALL_TIMEOUT_MS` for a call with a different budget. */
  timeoutMs?: number;
  /**
   * Whether a thrown error is worth another attempt. Default: everything is.
   * A 4xx from a vendor is a bad request, not a blip — retrying it burns the
   * budget and delays the DLQ landing that would have told someone.
   */
  isRetryable?: (error: unknown) => boolean;
}

/** Thrown when the breaker is open, so a caller can tell it apart from a vendor failure. */
export class CircuitOpenError extends Error {
  constructor(vendor: string) {
    super(`Circuit breaker is open for ${vendor}`);
    this.name = 'CircuitOpenError';
  }
}

export class ExternalCallTimeoutError extends Error {
  constructor(vendor: string, timeoutMs: number) {
    super(`${vendor} call exceeded ${timeoutMs}ms`);
    this.name = 'ExternalCallTimeoutError';
  }
}

interface BreakerState {
  consecutiveFailures: number;
  /** Epoch ms after which one probe is allowed through. 0 = closed. */
  openUntil: number;
}

@Injectable()
export class ExternalCallPolicy {
  private readonly logger = new Logger(ExternalCallPolicy.name);
  private readonly breakers = new Map<string, BreakerState>();

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly metrics: MetricsService,
  ) {}

  async run<T>(options: ExternalCallOptions, call: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const { vendor } = options;
    const attempts = options.attempts ?? 1;
    const backoffMs = options.backoffMs ?? 250;
    const timeoutMs = options.timeoutMs ?? this.env.EXTERNAL_CALL_TIMEOUT_MS;
    const isRetryable = options.isRetryable ?? (() => true);

    if (this.isOpen(vendor)) {
      this.metrics.observeExternalCall(vendor, 'breaker_open');
      throw new CircuitOpenError(vendor);
    }

    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      // Measured per ATTEMPT, not per `run()`: a call that succeeded on its
      // second try took as long as its second try, and folding the failed first
      // attempt in would make every retried vendor look permanently slow.
      const startedAt = Date.now();
      try {
        const result = await this.withTimeout(vendor, timeoutMs, call);
        this.onSuccess(vendor);
        this.metrics.observeExternalCall(vendor, 'ok');
        this.metrics.observeExternalCallDuration(vendor, (Date.now() - startedAt) / 1_000);
        return result;
      } catch (error) {
        lastError = error;
        const timedOut = error instanceof ExternalCallTimeoutError;
        this.metrics.observeExternalCall(vendor, timedOut ? 'timeout' : 'error');
        this.metrics.observeExternalCallDuration(vendor, (Date.now() - startedAt) / 1_000);

        // A failure counts against the breaker whether or not it is retryable —
        // a vendor returning 400 to everything is just as down as one timing
        // out, and the breaker exists to stop hammering it either way.
        this.onFailure(vendor);

        if (attempt === attempts || !isRetryable(error)) break;

        // Full jitter. Without it, N workers that failed together retry
        // together, and the vendor's recovery window is hit by the same
        // thundering herd that arguably caused the outage.
        const base = backoffMs * 2 ** (attempt - 1);
        await sleep(Math.floor(Math.random() * base));
      }
    }

    throw lastError;
  }

  /** Test seam — the breaker is process-local state and must not leak between specs. */
  reset(vendor?: string): void {
    if (vendor) this.breakers.delete(vendor);
    else this.breakers.clear();
  }

  /**
   * A RACE, not merely an abort signal.
   *
   * Aborting the controller is what tears the socket down, but it only turns
   * into a rejection if the callee honours the signal. A callee that ignores it
   * — or a `fetch` whose response has already landed and is stuck reading a
   * body — would otherwise resolve normally long after the deadline, and the
   * worker stays parked for exactly as long as the timeout was supposed to
   * prevent. Racing guarantees this returns at the deadline whatever the callee
   * does; the abort is what stops the abandoned work continuing in background.
   */
  private async withTimeout<T>(
    vendor: string,
    timeoutMs: number,
    call: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    const controller = new AbortController();
    let timer: NodeJS.Timeout | undefined;

    const deadline = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new ExternalCallTimeoutError(vendor, timeoutMs));
      }, timeoutMs);
      // `.unref()` so a pending timer never keeps the process alive at
      // shutdown — the same reason `realtime-relay.service.ts` unrefs its
      // flush interval.
      timer.unref?.();
    });

    try {
      return await Promise.race([call(controller.signal), deadline]);
    } catch (error) {
      // A callee that DID honour the signal throws its own abort error; report
      // it as the timeout it actually was.
      if (controller.signal.aborted && !(error instanceof ExternalCallTimeoutError)) {
        throw new ExternalCallTimeoutError(vendor, timeoutMs);
      }
      throw error;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private state(vendor: string): BreakerState {
    let state = this.breakers.get(vendor);
    if (!state) {
      state = { consecutiveFailures: 0, openUntil: 0 };
      this.breakers.set(vendor, state);
    }
    return state;
  }

  private isOpen(vendor: string): boolean {
    const state = this.state(vendor);
    if (state.openUntil === 0) return false;

    if (Date.now() >= state.openUntil) {
      // Half-open: let exactly one call through. It either closes the breaker
      // on success or re-opens it on failure — there is no separate half-open
      // bookkeeping because a single probe is all the state we need.
      state.openUntil = 0;
      this.metrics.observeBreaker(vendor, false);
      this.logger.log(`breaker for ${vendor} half-open — probing`);
      return false;
    }
    return true;
  }

  private onSuccess(vendor: string): void {
    const state = this.state(vendor);
    if (state.consecutiveFailures > 0 || state.openUntil > 0) {
      this.metrics.observeBreaker(vendor, false);
    }
    state.consecutiveFailures = 0;
    state.openUntil = 0;
  }

  private onFailure(vendor: string): void {
    const state = this.state(vendor);
    state.consecutiveFailures += 1;

    if (state.consecutiveFailures >= this.env.EXTERNAL_CALL_BREAKER_THRESHOLD) {
      state.openUntil = Date.now() + this.env.EXTERNAL_CALL_BREAKER_RESET_MS;
      this.metrics.observeBreaker(vendor, true);
      this.logger.warn(
        `breaker for ${vendor} OPEN after ${state.consecutiveFailures} consecutive failures`,
      );
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    timer.unref?.();
  });
}

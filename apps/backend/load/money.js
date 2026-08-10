import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, assertNotThrottled, authFor, headers } from './lib/common.js';

/**
 * The money read paths under load, and — the point of the file — a proof that
 * the ledger still balances afterwards.
 *
 * Payout CREATION is deliberately not driven here. Every request would need its
 * own `Idempotency-Key` and each one debits a wallet, so a sustained run either
 * drains every seeded fleet to zero within seconds (after which it measures the
 * insufficient-balance path) or collides on `uq_payouts_one_open_per_owner`
 * (after which it measures a 409). Neither is a latency measurement.
 * `payouts.e2e.spec.ts` already proves the write path, including under
 * concurrency.
 *
 * Run: docker compose --profile load run --rm k6 run /scripts/money.js
 */
export const options = {
  scenarios: {
    money: {
      executor: 'constant-vus',
      vus: 10,
      duration: '1m',
    },
  },
  thresholds: {
    'http_req_duration{expected_response:true}': ['p(95)<200', 'p(99)<500'],
    http_req_failed: ['rate<0.001'],
    'checks{kind:throttle}': ['rate==1.00'],
  },
};

const RANGE = 'from=2026-01-01&to=2026-12-31';

export default function money() {
  const { token } = authFor(__VU);
  const auth = headers(token);

  for (const [name, path] of [
    ['GET /fleet/earnings', '/v1/fleet/earnings'],
    ['GET /fleet/earnings/split', '/v1/fleet/earnings/split?limit=50'],
    ['GET /fleet/payouts', '/v1/fleet/payouts?page=1&limit=25'],
    ['GET /fleet/reports', `/v1/fleet/reports?groupBy=driver&${RANGE}`],
  ]) {
    const res = http.get(`${BASE_URL}${path}`, { ...auth, tags: { name } });
    check(res, { [`${name} is 200`]: (r) => r.status === 200 });
    assertNotThrottled(res);
  }

  sleep(1);
}

/**
 * The assertion that matters, run once after the load: §14's three invariants,
 * straight off the unauthenticated health endpoint. A read-only profile should
 * not be able to move them — if it can, something on a read path is writing.
 */
export function teardown() {
  const res = http.get(`${BASE_URL}/v1/health/ledger`);
  const body = res.json();

  check(body, {
    'wallet balances still reconcile': (b) => b.walletDrift === 0,
    'booking money still reconciles': (b) => b.bookingDrift === 0,
    'ledger still reconciles against payouts': (b) => b.ledgerDrift === 0,
    'no wallet drifted under load': (b) => b.driftedWallets === 0,
  });
}

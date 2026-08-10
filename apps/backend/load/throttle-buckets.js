import http from 'k6/http';
import { check, fail } from 'k6';
import { BASE_URL, TOKENS, headers } from './lib/common.js';

/**
 * THE ACCEPTANCE TEST FOR THE REDIS THROTTLER STORAGE, and the reason this file
 * exists: it is the only check that runs against TWO API instances at once.
 *
 * Run WITHOUT `THROTTLE_DISABLED` (unlike every other profile here), pointed at
 * the rehearsal proxy from `docs/rehearsal.md` so requests round-robin between
 * two backends:
 *
 *   docker compose --profile load run --rm k6 run /scripts/throttle-buckets.js
 *
 * With the in-memory storage this passes the limit and keeps going, because
 * each instance is counting to 300 on its own — the "N x too permissive"
 * defect the Phase 8 deploy gate names. With the Redis storage the budget is
 * shared and the 301st request is refused no matter which instance served the
 * first 300.
 */
export const options = {
  scenarios: {
    burst: { executor: 'shared-iterations', vus: 1, iterations: 1, maxDuration: '2m' },
  },
  thresholds: {
    checks: ['rate==1.00'],
  },
};

const LIMIT = Number(__ENV.READS_LIMIT || 300);

export default function throttleBuckets() {
  const { token } = TOKENS[0];
  const auth = headers(token);

  let served = 0;
  let refused = 0;

  // One past the budget: the last request must be the one that is refused.
  for (let i = 0; i < LIMIT + 1; i += 1) {
    const res = http.get(`${BASE_URL}/v1/fleet/dashboard`, auth);
    if (res.status === 429) refused += 1;
    else if (res.status === 200) served += 1;
    else fail(`unexpected status ${res.status} on request ${i + 1}`);
  }

  check(null, {
    'the budget is shared, not per instance': () => served <= LIMIT,
    'the budget is actually spent': () => refused >= 1,
  });

  // A second tenant must be unaffected: the point of per-tenant keys is that
  // one fleet exhausting its budget cannot rate-limit anyone else.
  if (TOKENS.length > 1) {
    const other = http.get(`${BASE_URL}/v1/fleet/dashboard`, headers(TOKENS[1].token));
    check(other, { 'another tenant still has its own budget': (r) => r.status === 200 });
  }

  console.log(`served ${served}, refused ${refused} (limit ${LIMIT})`);
}

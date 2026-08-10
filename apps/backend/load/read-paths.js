import http from 'k6/http';
import { sleep } from 'k6';
import { BASE_URL, assertOk, authFor, headers } from './lib/common.js';

/**
 * §19.1's API latency SLO — p95 < 200 ms, p99 < 500 ms — across the read paths a
 * console session actually exercises, against a seed ×10 dataset
 * (`pnpm db:seed:load`).
 *
 * Run: docker compose --profile load run --rm k6 run /scripts/read-paths.js
 * The API must be started with THROTTLE_DISABLED=1 (see docs/load-testing.md).
 */
/**
 * `VUS` is tunable because the interesting question is not "does 50 pass?" but
 * "where does one instance stop meeting the SLO?" — the answer sizes the ECS
 * task count in Phase 9a. `DURATION` shortens a sweep.
 */
const VUS = Number(__ENV.VUS || 50);
const DURATION = __ENV.DURATION || '2m';

export const options = {
  scenarios: {
    console: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: VUS },
        { duration: DURATION, target: VUS },
        { duration: '15s', target: 0 },
      ],
    },
  },
  thresholds: {
    // The SLO, stated once.
    'http_req_duration{expected_response:true}': ['p(95)<200', 'p(99)<500'],
    http_req_failed: ['rate<0.001'],
    // A forgotten THROTTLE_DISABLED fails the run rather than producing a fast,
    // meaningless green.
    'checks{kind:throttle}': ['rate==1.00'],

    // PER ROUTE as well as globally. `/reports` and `/earnings` aggregate over
    // the projection and are the plausible offenders; a single global p95 would
    // hide either of them behind six fast endpoints.
    'http_req_duration{name:GET /fleet/dashboard}': ['p(95)<200'],
    'http_req_duration{name:GET /fleet/trucks}': ['p(95)<200'],
    'http_req_duration{name:GET /fleet/drivers}': ['p(95)<200'],
    'http_req_duration{name:GET /fleet/jobs}': ['p(95)<200'],
    'http_req_duration{name:GET /fleet/alerts}': ['p(95)<200'],
    'http_req_duration{name:GET /fleet/earnings}': ['p(95)<200'],
    'http_req_duration{name:GET /fleet/earnings/split}': ['p(95)<200'],
    'http_req_duration{name:GET /fleet/settings}': ['p(95)<200'],
    'http_req_duration{name:GET /fleet/reports}': ['p(95)<200'],
  },
};

const RANGE = 'from=2026-01-01&to=2026-12-31';

export default function readPaths() {
  const { token } = authFor(__VU);
  const auth = headers(token);

  // `name` tags group by route PATTERN. Without them k6 keys its metrics on the
  // full URL, so a cursor-paged feed reports a separate p95 per page.
  const requests = [
    ['GET /fleet/dashboard', '/v1/fleet/dashboard'],
    ['GET /fleet/trucks', '/v1/fleet/trucks?page=1&limit=25'],
    ['GET /fleet/drivers', '/v1/fleet/drivers?page=1&limit=25'],
    ['GET /fleet/jobs', '/v1/fleet/jobs?limit=50'],
    ['GET /fleet/alerts', '/v1/fleet/alerts?limit=25'],
    ['GET /fleet/earnings', '/v1/fleet/earnings'],
    ['GET /fleet/earnings/split', '/v1/fleet/earnings/split?limit=25'],
    ['GET /fleet/settings', '/v1/fleet/settings'],
    ['GET /fleet/reports', `/v1/fleet/reports?groupBy=truck&${RANGE}`],
  ];

  for (const [name, path] of requests) {
    const res = http.get(`${BASE_URL}${path}`, { ...auth, tags: { name } });
    assertOk(res, name);
  }

  // A console session is a person looking at a screen, not a tight loop.
  sleep(1);
}

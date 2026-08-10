# Load testing (Phase 8)

Measures the §19.1 SLOs — **API p95 < 200 ms / p99 < 500 ms**, **realtime ≤ 2 s** — against a seed
×10 dataset.

k6 is a Go binary with its own JavaScript runtime, not an npm package: the profiles in
`apps/backend/load/` are plain `.js` using only k6's built-in modules, and the container is what
makes `pnpm install` enough to run one.

---

## Setup

```powershell
cd "apps\backend"
docker compose up -d --wait
pnpm db:migrate
pnpm db:seed:load        # x10: ~5,000 bookings, ~7,600 ledger rows, invariants verified
pnpm build
pnpm load:tokens         # writes load/.tokens.json (gitignored, 2h validity)
```

`load:tokens` signs real access tokens with `JwtService` and the real secret rather than logging in
per virtual user: `verifyPassword` is a deliberately memory-hard scrypt and the `auth` bucket is
5/min, so 200 VUs logging in would measure our password hashing and our rate limiter instead of the
API.

## Running

**`THROTTLE_DISABLED=1` is mandatory** for the latency profiles, or the reads bucket caps every VU at
a few requests a second and the run measures the throttler — while still reporting a flattering p95,
because a 429 is fast. Every profile carries a `checks{kind:throttle}` threshold so a forgotten flag
fails the run instead.

```powershell
$env:THROTTLE_DISABLED='1'; pnpm --filter @towing/backend start

# other terminal
cd "apps\backend"
docker compose --profile load run --rm k6 run /scripts/read-paths.js
docker compose --profile load run --rm -e VUS=25 -e DURATION=45s k6 run /scripts/read-paths.js
docker compose --profile load run --rm k6 run /scripts/money.js
```

k6 exits **99** on a breached threshold, so it gates a release rather than merely printing numbers.

A host install (`winget install k6`) avoids the container's NAT hop and is the lower-latency option —
but every number you intend to compare must come from the same method.

### The realtime SLO is not k6's

k6's WebSocket module cannot speak socket.io's handshake without a custom xk6 build, and
`pnpm smoke:realtime` already reports client and relay percentiles and exits non-zero over budget:

```powershell
pnpm --filter @towing/backend exec tsx src/scripts/realtime-load.ts `
  --clients=100 --trucks=500 --duration=120 --reconnect-every=20 `
  --gateways=http://localhost:4001,http://localhost:4002
```

`--reconnect-every` is §19.7's reconnect storm: every client drops and re-handshakes on that cadence
(with a fresh single-use ticket each time) while the pings keep flowing. Gate on the **relay** number
— it is `emittedAt − pingAt` measured server-side and immune to clock skew.

### The throttler check is different from all of these

`throttle-buckets.js` runs **with the throttler on**, against the two-instance rehearsal proxy. It is
the acceptance test for the Redis storage, and it belongs to `docs/rehearsal.md`.

---

## Baseline (06 Aug 2026)

One laptop, Docker Postgres/Redis, one API process, `DATABASE_POOL_MAX=10`, seed ×10, k6 in Docker.

| VUs | Throughput | Global p95 | Verdict |
|---|---|---|---|
| 10 | ~66 rps | **90 ms** | passes with margin |
| 25 | ~95 rps | **191 ms** | global passes; `/trucks` 248 ms, `/drivers` 225 ms breach |
| 50 | ~133 rps | **431 ms** | saturated |

Realtime, 500 trucks / 100 clients over two gateways with a reconnect storm every 20 s: **relay p95
840 ms**, client p95 971 ms, 0.00 % loss, 0 duplicates.

**The knee for one instance is ~25 concurrent console sessions, and it is database-bound.**
`/fleet/dashboard` spends 4.5 ms per request in SQL — its 15 s cache — and passes at every level.
`/fleet/trucks` and `/fleet/drivers` issue **4 statements each** (the batched-lookup pattern, not an
N+1) and are the first to exhaust the connection pool. So the lever for Phase 9a is task count and
`DATABASE_POOL_MAX`, not query rewriting.

Read those per-route numbers off `/v1/metrics` (`http_request_db_seconds`, `http_request_db_queries`)
and the `dbMs` / `dbCalls` fields on every access-log line, both added in this phase precisely so a
load run can be explained rather than merely observed.

**Per-route thresholds are not decoration:** at 25 VUs the global p95 passes while two routes breach.
A single global number would have called that a clean run.

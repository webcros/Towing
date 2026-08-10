# Multi-instance rehearsal (Phase 8)

Runs the whole product across **two backends and two Next processes behind one
proxy**, so anything still holding state in a process shows up here rather than
on the first day the ECS service scales past one task.

This is the local stand-in for the deploy gate:

> the 9a ECS service is pinned to `desiredCount: 1` and may not be raised until
> the Redis `ThrottlerStorage` and the shared BFF refresh lock have landed.

**A correction to the phase brief worth stating once:** there is no separate
gateway binary. `main.ts` mounts `FleetGateway` on the same HTTP server as the
API and no flag splits the roles, so "2× API + 2× gateway" is honestly *two
backend processes, each serving both*. Nothing needs to change for that to be
true — it is simply what the code is.

---

## What the proxy does, and does not

`src/scripts/rehearsal-proxy.ts` — ~200 lines of `node:http`, no dependencies:

- **round-robins** HTTP and WebSocket upgrades across the targets;
- **appends** to `X-Forwarded-For` exactly as a load balancer does, which is what
  makes `TRUST_PROXY_HOPS=1` meaningful locally;
- **defaults to `--sticky=off`**, because the point of the exercise is proving we
  do not need sticky sessions.

It listens on **4000 and 3000 — the ports everything already uses** — so
`PUBLIC_WS_URL`, `API_BASE_URL`, `CORS_ORIGINS` and Playwright's `baseURL` need
no changes at all. Only the real servers move aside.

It is not nginx because reaching host processes from a container on Windows
needs `host.docker.internal`, which adds a NAT hop to the very latencies the
rehearsal exists to observe.

---

## Running it (PowerShell)

### 1. Infrastructure and data

```powershell
cd "apps\backend"
docker compose up -d --wait
pnpm db:migrate
pnpm db:seed            # or db:seed:load for the ×10 dataset
pnpm build
```

### 2. Two backends — one terminal each

`AUTH_DEV_OTP_ECHO` is what lets the browser suite complete the two-step login
without scraping the log. Production refuses to boot with it set.

```powershell
$env:PORT='4001'; $env:TRUST_PROXY_HOPS='1'; $env:AUTH_DEV_OTP_ECHO='true'; $env:THROTTLE_AUTH_LIMIT='50'
pnpm --filter @towing/backend start

# second terminal
$env:PORT='4002'; $env:TRUST_PROXY_HOPS='1'; $env:AUTH_DEV_OTP_ECHO='true'; $env:THROTTLE_AUTH_LIMIT='50'
pnpm --filter @towing/backend start
```

`THROTTLE_AUTH_LIMIT` is raised because the live suite logs in once per test as
the same owner, and 5/min is a deliberately tight credential-stuffing defence
that a real human never approaches. Raise it for the rehearsal; **never** in a
deployed environment. (This is the reason the bucket limits are env-driven.)

### 3. Two Next processes against the mocks-OFF build

`NEXT_PUBLIC_USE_MOCKS` is inlined at build time, so this is a *different build*
— `NEXT_DIST_DIR` keeps it out of the `.next` the hermetic suite depends on.

```powershell
cd "apps\towfleet-web"
$env:NEXT_DIST_DIR='.next-live'; $env:NEXT_PUBLIC_USE_MOCKS='false'; $env:API_BASE_URL='http://localhost:4000'
pnpm exec next build

# two terminals, same env
$env:NEXT_DIST_DIR='.next-live'; $env:API_BASE_URL='http://localhost:4000'; pnpm exec next start -p 3001
$env:NEXT_DIST_DIR='.next-live'; $env:API_BASE_URL='http://localhost:4000'; pnpm exec next start -p 3002
```

### 4. The proxy

```powershell
pnpm --filter @towing/backend exec tsx src/scripts/rehearsal-proxy.ts
```

---

## The checks

```powershell
# 1. The hermetic suite through the proxy. It never touches the backend, so a
#    clean pass across two round-robined Next processes is a statement about
#    the WEB tier holding no per-process state.
pnpm --filter towfleet-web exec playwright test

# 2. The live suite: a real login, real data, and the refresh race.
pnpm --filter towfleet-web test:e2e:live

# 3. Realtime across two gateways, including §19.7's reconnect storm.
pnpm --filter @towing/backend exec tsx src/scripts/realtime-load.ts `
  --trucks=500 --clients=100 --duration=120 `
  --gateways=http://localhost:4001,http://localhost:4002 `
  --reconnect-every=20

# 4. THE throttler check — the acceptance test for the Redis storage. Run with
#    the throttler ON (do not set THROTTLE_DISABLED) and through the proxy, so
#    the 301st request is refused no matter which backend served the first 300.
cd "apps\backend"
docker compose --profile load run --rm k6 run /scripts/throttle-buckets.js
```

`refresh-race.spec.ts` passing across two Next processes is the browser-level
evidence for the refresh grace window; `throttle-buckets.js` is the evidence for
the shared rate-limit counter. Those two are the deploy gate.

---

## Stopping

`kill`/`pkill` from a bash shell does not kill node processes started from
another shell on Windows — a lesson already recorded in the implementation plan
and re-learned during Phase 8.

```powershell
Get-NetTCPConnection -LocalPort 3000,3001,3002,4000,4001,4002 -State Listen -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object { Stop-Process -Id $_ -Force }
```

---

## Known gap this rehearsal will expose

`DiskStorageAdapter` writes uploads to node-local disk and returns a `local://`
URL, so a compliance document uploaded through one backend is unreadable from
the other. That is **not** fixed here — the S3 adapter is Phase 9a's scheduled
work and the `StoragePort` seam already exists for it. Uploads are kept out of
the live suite for that reason, and the gap is recorded in `ToBeDoneEhsan.md` as
a deploy-gate item the original brief did not name.

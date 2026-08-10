# Towing — Monorepo

On-demand roadside assistance & towing platform for India (see [`docs/Towing-Project-Specification_v3.md`](docs/Towing-Project-Specification_v3.md)).

**Status: Phases 1–4 complete — TowFleet console + backend are the deployable units** (see [`docs/TowFleet-Implementation-Plan.md`](docs/TowFleet-Implementation-Plan.md)).

> **AWS/deployment engineers: start at [`Aws/01-project-overview.md`](Aws/01-project-overview.md)** — the `Aws/` folder is a complete deployment handover pack ([index](Aws/README.md)).

This repo is a **pnpm + Turborepo monorepo**.

## Structure

```
apps/
  backend/          # @towing/backend — shared NestJS 11 API (Postgres+PostGIS, Redis, Drizzle)
  towfleet-web/     # TowFleet fleet-owner web console (Next.js 15) — wired to the real backend
  towgo/            # TowGo customer app (Expo, React Native) — in-app mocks only
  towpartner/       # TowPartner driver app (Expo, React Native) — in-app mocks only
packages/
  api-contracts/    # @towing/api-contracts — Zod schemas + branded ids shared web↔backend
  theme/            # @towing/theme — design tokens, light/dark themes (web imports only /tokens)
  ui/               # @towing/ui    — React Native component kit for the Expo apps
  web-ui/           # @towing/web-ui — web component kit for the consoles
  config/           # @towing/config — shared ESLint preset
docs/               # Product spec v3 + implementation plan
Aws/                # AWS deployment handover pack (start here for deployment)
infrastructure/     # deploy-all.sh — CDK generator scaffold (Phase 9 formalizes it)
```

## Prerequisites

- **Node ≥ 20**, **pnpm 11.1.2** (pinned via `packageManager` in `package.json` — corepack or a matching global install)
- **Docker Desktop** (backend's Postgres+PostGIS and Redis run from `apps/backend/docker-compose.yml`)
- For a mobile device preview: the **Expo Go** app (Android/iOS), or an Android emulator / iOS simulator

## Run the TowFleet console + backend (the deployable units)

```bash
pnpm install                          # once, from the repo root

# 1. Infra — Postgres+PostGIS :5432 and Redis :6379
cd apps/backend && docker compose up -d --wait

# 2. Schema + deterministic demo data (refuses NODE_ENV=production)
pnpm db:migrate && pnpm db:seed

# 3. Backend API on :4000 — dev OTPs print in this terminal
cd ../.. && pnpm backend

# 4. Console on :3000 (mock mode by default; see apps/towfleet-web/.env.example for real mode)
pnpm fleet

# Login: lakshmi@recovery.in / Password123!  (OTP appears in the backend terminal)

# 5. Optional — fake GPS so the live map actually moves
cd apps/backend && pnpm sim:locations
```

Tests: `cd apps/backend && docker compose --profile test up -d --wait && pnpm test` (374 tests), and `pnpm test:e2e` in `apps/towfleet-web` (Playwright, 26 tests — run `pnpm build` first, it tests a production build). The same backend suite runs in CI on every push and pull request.

Load and scale (Phase 8): [docs/load-testing.md](docs/load-testing.md) for the k6 profiles and the measured baseline, and [docs/rehearsal.md](docs/rehearsal.md) for running the whole product across two backends and two Next processes behind a local proxy.

### Realtime (Phase 5)

The console opens one WebSocket to the backend's `/fleet` namespace and streams truck positions onto a
MapLibre map within ~1 s of a ping. Worth knowing:

- **The map needs no API key.** The default basemap is vendorless — a token-coloured background plus
  the seeded service zones as GeoJSON. Set `NEXT_PUBLIC_MAP_STYLE_URL` to add a real tile vendor.
- **Nothing moves without a ping source.** `pnpm sim:locations` is the only publisher until the driver
  app lands; without it the map renders last-known positions and correctly greys them as stale.
- **Load smoke:** `pnpm --filter @towing/backend smoke:realtime` — 50 clients / 200 trucks, asserts
  p95 ping→client < 2 s (§19.1) and exits non-zero if it misses. Add
  `--gateways=http://localhost:4000,http://localhost:4001` against two `PORT`s to rehearse
  multi-instance fan-out; `duplicates 0` in the output is the assertion that matters.
- **Degradation:** start the backend with `REALTIME_ENABLED=false` and the console drops to 10 s REST
  polling instead of erroring (§19.2). Stopping Redis makes the positions endpoint serve PostGIS with
  `degraded: true`.

### Background jobs & compliance (Phase 6)

The backend runs BullMQ workers **inside the API process**, so `pnpm backend` gives you the queue too.

- **Compliance sweep** runs hourly (`COMPLIANCE_SWEEP_CRON`): expired documents move a truck to
  `non_compliant` (excluding it from dispatch, §3.2), the 30-day window opens a warning alert, and
  renewing the papers walks all of it back. It is idempotent — re-running changes nothing — so
  `POST /v1/fleet/alerts/recheck` (the "Re-check now" button on `/alerts`) is safe to spam and is how
  you avoid waiting an hour after a renewal.
- **Alerts are stored, not derived.** `pnpm db:seed` runs the sweep at the end so the alert feed and
  `/alerts` have content immediately.
- **Bulk truck import** on `/trucks` → "Import CSV". The console previews and validates the file
  before uploading (same Zod schema the server uses); files over 500 rows are handed to the queue.
  Grab the template at `/api/proxy/trucks/bulk/template.csv`.
- **Queue health:** `curl localhost:4000/v1/health/queues` — per-queue depth plus `deadLettered`,
  which is the number to alarm on. Failed jobs are kept deliberately; they are the dead-letter record.
- **Turn it off** with `QUEUE_ENABLED=false`: no workers, no cron, no enqueue. Work is deferred, not
  lost.

## Run the mobile apps (mock mode — no backend needed)

```bash
pnpm towgo                   # customer app  = pnpm --filter towgo start  → Expo Dev Tools
pnpm driver                  # driver app    = pnpm --filter towpartner start
```

Then press **a** (Android emulator), **i** (iOS simulator), or scan the QR code with **Expo Go**.

> Both apps run fully in **Expo Go** on in-app mocks today — they do not talk to the backend yet. Maps are styled placeholders (Google Maps keys pending), and local storage falls back to memory (MMKV arrives with a dev build later).

### Verify the designed states (spec §10.9)

The nearby-drivers data is mocked. Force each state with an env var:

```bash
# Empty state ("few trucks nearby")
EXPO_PUBLIC_MOCK_DRIVERS_STATE=empty pnpm towgo
# Error state (inline retry)
EXPO_PUBLIC_MOCK_DRIVERS_STATE=error pnpm towgo
```

Cold start shows skeletons → data (no first-paint spinner). Toggle the OS light/dark theme to see the themed tokens; turn off Wi-Fi/data to see the offline banner.

## Checks

```bash
pnpm typecheck               # tsc across all packages + apps (turbo)
pnpm lint                    # ESLint
pnpm test                    # turbo run test (backend suite needs the docker test profile)
```

## Design system

All brand identity lives in one file: [`packages/theme/src/brand.config.ts`](packages/theme/src/brand.config.ts). Current brand is **amber `#FFB800` + Inter** (matches Figma). Components never hardcode colors — mobile reads semantic tokens via `useTheme()`; web imports **only** `@towing/theme/tokens` (the root entry imports react-native and must never appear in web code).

# Towing — Monorepo

On-demand roadside assistance & towing platform for India (see [`docs/Towing-Project-Specification_v3.md`](docs/Towing-Project-Specification_v3.md)).

**Status: Track A phases 1–8 complete (9a — AWS staging — is next) · Track B phases 10–13 complete (14 — pricing — is next).** The TowFleet console + backend are the deployable units; both mobile apps run against the real backend, and the §12 notification spine is live on log adapters — no provider credentials exist yet, so nothing is delivered to a real phone, inbox or handset. See [`docs/TowFleet-Implementation-Plan-V2.md`](docs/TowFleet-Implementation-Plan-V2.md) — the working plan. ([`docs/TowFleet-Implementation-Plan.md`](docs/TowFleet-Implementation-Plan.md) is V1 and superseded.)

> **AWS/deployment engineers: start at [`Aws/01-project-overview.md`](Aws/01-project-overview.md)** — the `Aws/` folder is a complete deployment handover pack ([index](Aws/README.md)).

This repo is a **pnpm + Turborepo monorepo**.

## Structure

```
apps/
  backend/          # @towing/backend — shared NestJS 11 API (Postgres+PostGIS, Redis, Drizzle)
  towfleet-web/     # TowFleet fleet-owner web console (Next.js 15) — wired to the real backend
  towgo/            # TowGo customer app (Expo, React Native) — real phone-OTP auth, REST client, MMKV storage; mocks still the default
  towpartner/       # TowPartner driver app (Expo, React Native) — same stack, plus the KYC wizard and a durable offline mutation queue
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

Tests: `cd apps/backend && docker compose --profile test up -d --wait && pnpm test` (577 tests across 70 files), and `pnpm test:e2e` in `apps/towfleet-web` (Playwright, 29 hermetic tests — run `pnpm build` first, it tests a production build). The same backend suite runs in CI on every push and pull request. **There is no mobile test runner** — neither Expo app has Jest/RTL; the five Maestro flows (`apps/towgo/maestro/`, `apps/towpartner/maestro/`) are authored and reviewed but have never been executed.

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

## Run the mobile apps

Both apps have two modes. **Mocks are still the default** (`env.useMocks` defaults `true`), so this
needs no backend:

```bash
pnpm towgo                   # customer app  = pnpm --filter towgo start  → Expo Dev Tools
pnpm driver                  # driver app    = pnpm --filter towpartner start
```

Then press **a** (Android emulator), **i** (iOS simulator), or scan the QR code with **Expo Go**.

### Mocks off — against the real backend

Since Phase 12 both apps have real phone-OTP sign-in, a real REST client and MMKV-backed
storage/session persistence; since Phase 13 they also register a device for push and read an in-app
notification centre. To run against the backend, copy each app's `.env.example` to `.env`
(they document every variable) and set:

```bash
EXPO_PUBLIC_USE_MOCKS=false
EXPO_PUBLIC_API_URL=http://localhost:4000   # Android emulator: http://10.0.2.2:4000
                                            # physical device:  http://<your LAN IP>:4000
```

Then run the backend first (`docker compose up -d --wait && pnpm db:migrate && pnpm db:seed`, then
`pnpm backend`) and start the app. **The dev OTP prints in the backend terminal** — there is no real
SMS provider yet. Notifications behave the same way: every channel defaults to `NOTIFY_*_PROVIDER=log`,
which prints what it would have sent (masked) and still writes the in-app notification, so the whole
spine is demonstrable with zero vendor accounts. **Push additionally needs a dev-client or EAS build**
— Expo Go cannot mint a push token, and no build has ever been produced for either app. `EXPO_PUBLIC_*` is inlined at build time by Metro, so restart the bundler after
changing it.

Caveats that still hold:

- Only **9 of the 16 `DataSource`s** flip with the flag — the ones whose backend routes exist today
  (TowGo: auth, profile, vehicles, addresses, emergency-contacts, privacy · TowPartner: auth, kyc,
  capabilities). The rest (bookings, home, dashboard, earnings, jobs, offers, driver profile) stay on
  mocks until their own phase lands. Maps are still styled placeholders (Google Maps keys pending).
- **No EAS build has ever been produced, so neither app has run on a real device.** In Expo Go there
  is no MMKV native module and storage falls back to in-memory — persistence across restarts needs a
  dev build.

### Verify the designed states (spec §10.9)

The nearby-drivers data is still mocked. Force each state with an env var:

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

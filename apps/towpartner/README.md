# MiTow Partner (driver app)

The tow-truck **driver** app for the Towing platform — sibling of the customer
app (`apps/towgo`) in the same monorepo. Both consume the shared `@towing/*`
packages (`theme`, `ui`, `config`).

Built from the Figma "Towing" driver flow (Driver Home / Jobs / New Job /
Earnings / Profile), extended in Track B **Phase 12** with the pieces the design
never covered: sign-in, KYC submission and capabilities.

## Stack

Expo SDK 57 · React Native 0.86 · React 19 · React Navigation v7 ·
TanStack Query v5 (+ persist-client) · Zustand · MMKV · Lucide icons ·
react-native-svg · expo-image-picker/-manipulator. Light-mode only (matches the
design), same conventions as `apps/towgo`.

## Run

```bash
pnpm install            # once, from the repo root
pnpm driver             # or: pnpm --filter towpartner start
pnpm driver:android     # open on Android
pnpm driver:go          # Expo Go
```

**Mocks are the default** (`env.useMocks` is true unless `EXPO_PUBLIC_USE_MOCKS`
is exactly `false`), so the above needs no backend. To run against the real API,
copy `.env.example` to `.env` and set `EXPO_PUBLIC_USE_MOCKS=false` plus
`EXPO_PUBLIC_API_URL` (`http://10.0.2.2:4000` on an Android emulator, the host's
LAN IP on a device), start the backend from `apps/backend`, and read the **dev
OTP out of the backend terminal** — there is no SMS provider yet. `EXPO_PUBLIC_*`
is inlined by Metro at build time, so restart the bundler after changing it.

> **Not yet run for real.** No EAS build has ever been produced, so this app has
> never executed on a physical device — only Expo Go and simulators. In Expo Go
> there is no MMKV native module and storage silently falls back to in-memory,
> so session persistence needs a dev build. `maestro/driver-kyc-submit.yaml` is
> authored and reviewed but **never executed**, and there is **no test runner in
> this app** (no Jest/RTL) — the only automated coverage for these flows is the
> backend supertest suite.

## Screens (bottom tabs)

| Tab | Screen | Highlights |
| --- | --- | --- |
| Home | `screens/home` | Online/offline hero toggle, today's summary, quick actions, recent activity |
| Jobs | `screens/jobs` | Status filter tabs, job history cards |
| New Job (center FAB) | `screens/newjob` | Incoming request card with live expiry countdown, accept/decline |
| Earnings | `screens/earnings` | Total hero, period selector, SVG trend chart, transactions |
| Profile | `screens/profile` | Profile hero, stats, Account & Support menus |

### Screens outside the tabs (Phase 12)

| Screen | Path | What it does |
| --- | --- | --- |
| Splash · Phone · OTP | `screens/auth` | Real driver sign-in against `POST /v1/auth/otp/{send,verify}` — the driver realm. Session (access + rotating refresh) is persisted, so a signed-in driver stays signed in. |
| KYC wizard | `screens/kyc/KycWizardScreen` | The five required documents, one per step: camera/library pick → compress → presign → upload → confirm, with live per-document status and resubmission of a rejected document. Backed by `POST /v1/driver/kyc/documents/{presign,confirm}` + `/kyc/submit`. |
| KYC status | `screens/kyc/KycStatusScreen` | Where a driver waits between submit and an admin decision; shows per-document rejections and reasons. |
| Capabilities | `screens/capabilities` | Vehicle class + long-distance opt-in (`PUT /v1/driver/capabilities`), behind the server's `KycApprovedGuard`. |

Job Details and Active Job (Phases 17–18) and the remaining Account sub-screens
are still lightweight `PlaceholderScreen` shells, so navigation stays fully
browsable — check `navigation/RootNavigator.tsx` for which are which.

## Architecture

- **Feature verticals** under `src/features/<name>/` — each with `types.ts`,
  `mocks/`, `components/`, and an `api/` folder holding a keys factory, query
  hooks, a `DataSource` interface, a mock source and (where the backend exists) a
  REST source. `env.useMocks` picks between them in the `DataSource` file, so
  components and hooks never change.
- **Only 3 of the features are real today**: `auth`, `kyc` and `capabilities`
  flip with the mock toggle, because those are the driver-realm routes the
  backend actually serves after Phase 12. `dashboard`, `jobs`, `offers`,
  `earnings` and `profile` still hardcode their mock — every route they would
  call belongs to a phase that has not shipped (17 jobs/offers, 19 earnings).
  This is deliberate: a REST source pointed at a 404 is worse than an honest mock.
- **API client** (`src/lib/api/client.ts`) — `apiFetch` adds the bearer, and a
  401 triggers **one** serialized refresh. Two callers racing a 401 must not both
  hit `/auth/refresh`, or the backend's family reuse-detection reads the loser as
  token theft and kills the session. Mutations carry an idempotency key
  (`src/lib/api/idempotency.ts`).
- **Durable offline mutation queue** (`src/lib/mutationQueue/queue.ts`) — a
  mutation that fails on a genuine *network* error (never on a 4xx/5xx) is
  written to MMKV and replayed on reconnect **with its original idempotency key**,
  so it survives an app kill mid-job on a weak signal. `useLogout()` purges it:
  otherwise a queued action could replay under the next driver's session on a
  shared device.
- **Storage** (`src/lib/storage/`) — `storage.ts` is a tiny `KVStorage`
  interface; `mmkv.ts` implements it over `react-native-mmkv@4` (Nitro Modules:
  `createMMKV()`, `.remove()` — not the v3 `new MMKV()`/`.delete()` shape) with an
  in-memory fallback for Expo Go. `queryPersister.ts` persists the TanStack Query
  cache on top of it.
- **Mock toggle** via `src/lib/env.ts` (`EXPO_PUBLIC_USE_MOCKS`, plus
  per-feature `EXPO_PUBLIC_MOCK_*_STATE` to preview loading/empty/error states).
- **Online gating** — `driverStatusStore` defaults to offline, and the toggle
  unlocks only on a **this-session-confirmed** KYC approval (`kycVerified` +
  `kycStatus === 'approved'`), not on a cached status hydrated from a previous
  session. This is the client half of the §3.1 supply gate; the server enforces
  it independently.
- **Theme**: reuses `@towing/theme` for structure (spacing, radii, typography,
  shadows, surfaces, text, the amber brand). Driver-specific accents (the gold
  FAB, orange links/active tab, coloured icon-chip families) live in
  `src/theme/driverColors.ts` — the shared theme package is untouched.
- **Icons**: curated Lucide re-export in `src/icons/index.ts`.

## Mock state previews

```bash
EXPO_PUBLIC_MOCK_JOBS_STATE=empty pnpm driver      # empty Jobs list
EXPO_PUBLIC_MOCK_EARNINGS_STATE=error pnpm driver  # Earnings error state
EXPO_PUBLIC_MOCK_OFFER_STATE=none pnpm driver      # New Job: no incoming request
```

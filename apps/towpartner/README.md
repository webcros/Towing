# TowPartner (driver app)

The tow-truck **driver** app for the Towing platform — sibling of the customer
app (`apps/towgo`) in the same monorepo. Both consume the shared `@towing/*`
packages (`theme`, `ui`, `config`).

Built from the Figma "Towing" driver flow (Driver Home / Jobs / New Job /
Earnings / Profile).

## Stack

Expo SDK 57 · React Native 0.86 · React 19 · React Navigation v7 ·
TanStack Query v5 · Zustand · Lucide icons · react-native-svg. Light-mode only
(matches the design), same conventions as `apps/towgo`.

## Run

```bash
pnpm install            # once, from the repo root
pnpm driver             # or: pnpm --filter towpartner start
pnpm driver:android     # open on Android
pnpm driver:go          # Expo Go
```

## Screens (bottom tabs)

| Tab | Screen | Highlights |
| --- | --- | --- |
| Home | `screens/home` | Online/offline hero toggle, today's summary, quick actions, recent activity |
| Jobs | `screens/jobs` | Status filter tabs, job history cards |
| New Job (center FAB) | `screens/newjob` | Incoming request card with live expiry countdown, accept/decline |
| Earnings | `screens/earnings` | Total hero, period selector, SVG trend chart, transactions |
| Profile | `screens/profile` | Profile hero, stats, Account & Support menus |

Routes beyond the five designed tabs (Account sub-screens, Job Details, Active
Job) are lightweight `PlaceholderScreen` shells so navigation is fully browsable.

## Architecture

- **Feature verticals** under `src/features/<name>/` — each with `types.ts`,
  `mocks/`, `components/`, and an `api/` folder holding a keys factory, query
  hooks, a `DataSource` interface, and a mock source. Swapping mocks for a REST
  backend is a one-line change per feature (no component/hook edits).
- **Mock toggle** via `src/lib/env.ts` (`EXPO_PUBLIC_USE_MOCKS`, plus
  per-feature `EXPO_PUBLIC_MOCK_*_STATE` to preview loading/empty/error states).
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

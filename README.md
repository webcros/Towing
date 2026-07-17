# Towing — Monorepo

On-demand roadside assistance & towing platform (see [`docs/Towing-Project-Specification_v3.md`](docs/Towing-Project-Specification_v3.md)).

This repo is a **pnpm + Turborepo monorepo**. First app in development: **TowGo** (the customer app, React Native / Expo).

## Structure

```
apps/
  towgo/            # TowGo customer app (Expo, React Native, TypeScript)
packages/
  theme/            # @towing/theme — design system: tokens, light/dark themes, ThemeProvider
  ui/               # @towing/ui    — shared component kit (Screen, Button, Card, Map facade, …)
  config/           # @towing/config — shared ESLint preset
docs/               # Project specification
```

Shared packages are consumed as **TypeScript source** (no build step) — Metro transpiles them. When the driver app (TowPartner) starts, it adds `apps/towpartner` and imports the same `@towing/*` packages.

## Prerequisites

- Node ≥ 20, `pnpm` (v11)
- For a device preview: the **Expo Go** app (Android/iOS), or an Android emulator / iOS simulator

## Run TowGo

```bash
pnpm install                 # once, from the repo root
pnpm towgo                   # = pnpm --filter towgo start  → opens Expo Dev Tools
```

Then press **a** (Android emulator), **i** (iOS simulator), or scan the QR code with **Expo Go**.

> The Home screen runs fully in **Expo Go** today — the "Nearby Tow Trucks" map is a styled placeholder (Google Maps keys pending), and local storage falls back to memory (MMKV is added in a dev build later). No native build required.

## Verify the designed states (spec §10.9)

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
pnpm typecheck               # tsc across all packages + app (turbo)
pnpm lint                    # ESLint (expo config + no-hardcoded-color rule)
```

## Design system

All brand identity lives in one file: [`packages/theme/src/brand.config.ts`](packages/theme/src/brand.config.ts). Current brand is **amber `#FFB800` + Inter** (matches Figma). Components never hardcode colors — they read semantic tokens via `useTheme()`.

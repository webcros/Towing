# Admin-realm contracts

The Towing Admin console's half of the API (spec §16.5, §9.4).

| File | Ships | Phase |
|---|---|---|
| `auth.ts` | Password → OTP admin login, session shape | 10 |
| `drivers.ts` | KYC queue, per-document review, capability toggle | 11 |
| `pricing.ts` | `GET/PUT /admin/pricing` · `GET/PUT /admin/commission` + history | 14 |

Still unclaimed from the §16.5 table: `/admin/zones` (polygon editor, Phase 20),
`/admin/dispatch-config` (Phase 17 — its `dispatchConfigOverrideSchema` already
lives in `common/dispatch-config.ts`, written by Phase 14's seed), `/admin/ops/*`,
`/admin/bookings`, `/admin/finance/*`, `/admin/promos`, `/admin/analytics`.

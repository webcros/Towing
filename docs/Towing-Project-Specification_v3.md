# Towing — Project Specification Document (Detailed)

**Project Name:** Towing
**Document Version:** 3.0 (Detailed / Comprehensive)
**Reference Apps:** Uber, Rapido, Bolt
**Document Type:** Full-Stack On-Demand Roadside Assistance & Towing Ecosystem Specification
**Prepared By:** Mohammad Ehsan · Webcros (Design · Develop · Deliver)
**Build Approach:** 2 React Native apps (TowGo, TowPartner) + 2 web consoles (TowFleet Web, Towing Admin) + shared AWS backend
**Date:** July 2026

---

## 0. Document Control

### 0.1 How to Read This Document
This is the single source of truth for building the Towing ecosystem. It moves from **why** (business) → **what** (rules, roles, flows) → **how it looks & feels** (screens, design, tracking) → **how it's built** (architecture, APIs, schema, reliability, security) → **how it ships** (DevOps, QA, timeline, cost) → **what's next** (roadmap). Non-technical stakeholders can read §1–§13; engineers live in §14–§26; delivery and commercials are §27–§31.

### 0.2 Revision History
| Version | Date | Author | Notes |
|---|---|---|---|
| 1.0 | Jun 2026 | Ehsan | Initial four-interface spec (AWS backend) |
| 2.0 | Jun 2026 | Ehsan | Detailed expansion — screen specs, API, schema, security, DevOps, QA, roadmap |
| 3.0 | Jul 2026 | Ehsan | **Revenue model changed to pure per-booking commission (5–10%, tiered by service)** — driver subscriptions removed entirely. **Fleet interface moved from mobile app to web console** (build = 2 mobile apps + 2 web). Deep-dive detail added: progressive-radius dispatch, live tracking system, reliability engineering, Uber/Rapido-grade UX standards. |

### 0.3 Scope of This Build
**In scope:** four interfaces fully — **TowGo** (customer app), **TowPartner** (driver app), **TowFleet Web Console**, **Towing Admin** (web) — plus the shared AWS backend, progressive-radius dispatch & matching engine, dynamic pricing, **tiered per-booking commission engine (5–10%)**, wallets & split payouts, KYC (manual review), **live driver tracking with share-trip links**, SOS, ratings, invoices, basic coupons, geofenced service zones, basic surge, reliability engineering (SLOs, degradation, load-tested real-time).
**Phased (documented in §29):** auto-KYC OCR, advanced ML surge, full reward automation, AI chatbot, marketplace, corporate/insurance portals, full loyalty/referrals, multi-language, **TowFleet mobile app**, long-distance auto-quoting, **cash payments + commission-debt ledger**.

### 0.4 Glossary
See **Appendix C** for full terms (KYC, dispatch, geofence, surge, take rate, commission band, Route, etc.).

---

## 1. Executive Summary

Towing is an enterprise-grade, on-demand roadside assistance and towing platform for India — tagline *"Fast · Reliable · Emergency Roadside Assistance."* It connects stranded vehicle owners with nearby tow operators in real time and monetizes the way India's biggest mobility platforms do: **a percentage commission on every completed booking — nothing else**. Drivers join free, pay **₹0 upfront and ₹0 weekly**, and the platform earns only when they earn. Commission is tiered by service type (10% local · 8% highway/intercity · 5% long-distance) and is admin-tunable within a 5–10% guardrail.

The platform is a **four-interface ecosystem** — two mobile apps and two web consoles — all connected through one shared backend and real-time dispatch engine:

| Interface | Who Uses It | Platform | Purpose |
|---|---|---|---|
| **TowGo** | Customers | React Native (iOS + Android) | Book towing & roadside help, live-track the driver, pay, trigger emergency SOS |
| **TowPartner** | Tow Drivers (the "rider"/captain side) | React Native (iOS + Android) | Pass KYC, go online, accept & run jobs, navigate, track transparent earnings |
| **TowFleet Web** | Fleet Owners | Web (Next.js) | Manage multiple trucks & drivers on a desktop-grade console — compliance, live fleet map, consolidated payouts |
| **Towing Admin** | Platform Ops | Web (Next.js) | Verify drivers, monitor live operations, control pricing & commission, analytics |

Beneath the screens, the genuinely hard pieces — the parts that make Uber and Rapido feel effortless — are: **geospatial nearest-driver matching with a progressively expanding search radius**, a multi-factor dynamic pricing engine, **sub-2-second live driver tracking** over WebSockets, driver/fleet wallets and split payouts, document/KYC verification, and SOS safety. The system is built **AWS-native** and engineered to explicit reliability targets (§19): 99.9% uptime, ≤2s real-time propagation, p95 API < 200ms, crash-free sessions ≥ 99.5%.

The defining product constraint is the **supply-side gate**: a driver cannot receive a single job until admin has approved their KYC. This single hard gate is enforced at the app, API, and database layers and is threaded through the entire system. There is **no paywall** between an approved driver and their first job — removing the classic cold-start friction of subscription marketplaces.

---

## 2. Project Overview

### 2.1 Vision & Business Goals
- Launch an on-demand towing & roadside marketplace, starting in one city and expanding zone-by-zone.
- Generate revenue through a **pure per-booking platform commission (5–10%, tiered by service)** — the proven Uber/Rapido model: zero barrier for supply, income scales with marketplace volume.
- Support the full service range — local sub-40 km recovery through highway, intercity, and long-distance flatbed hauling.
- Enable **enterprise fleet partnerships** via a dedicated fleet web console with multi-truck management and compliance tracking.
- Deliver an Uber/Rapido-grade consumer experience: **app-open to "Confirm Booking" in under 45 seconds**, median time-to-match under 30 seconds in covered zones.
- Give operators full control through a web admin: verification, live ops, pricing/surge, commission bands, finance, analytics.
- Build a scalable AWS foundation that grows to multiple cities, dispatch zones, and microservices without core refactors.
- Long-term: become India's complete vehicle-emergency ecosystem (recovery, garages, insurance, corporate).

### 2.2 Target Users & Personas

| Segment | Description | Key Needs |
|---|---|---|
| Stranded Vehicle Owners | Drivers needing emergency tow / roadside help | Fast help, transparent fare, live tracking, safety (SOS, OTP start, share-trip) |
| Independent Tow Drivers | Single-truck owner-operators | Steady jobs, **zero upfront cost**, fair transparent commission, fast payouts, simple navigation |
| Fleet Owners | Businesses running multiple trucks & drivers | Multi-truck/driver management on a big screen, compliance alerts, consolidated payouts |
| Platform Ops Team | Operators running the marketplace | Verification, live visibility, pricing/commission control, dispute handling, analytics |
| Insurance / Corporate (later) | B2B partners routing recovery jobs | Bulk dispatch, SLAs, billing — phased (§29) |

**Persona — Ramesh (Customer, 34, Bengaluru).** Car won't start on a busy road at night. Opens TowGo, taps "Breakdown," confirms pickup via GPS in seconds, sees a transparent fare and a driver 6 minutes away, watches the truck move toward him on the map, shares the live trip link with his wife, hands over the OTP, pays by UPI, rates the driver. *Needs: speed, trust, no haggling.*

**Persona — Suresh (Driver, 41, owner of one wheel-lift truck).** Wants consistent local jobs without another weekly bill. Onboards in TowPartner, uploads documents, gets approved in a day, and goes online the same evening — **he paid nothing to start**. Each job offer shows his **net earning after the platform's 10% cut before he accepts**. He completes with OTP, watches his wallet grow per trip, requests a weekly payout. *Needs: job flow, transparent cut, predictable payouts.*

**Persona — Lakshmi (Fleet Owner, runs 8 trucks & 12 drivers).** Manages a recovery business from her office desktop. Logs into the TowFleet web console, tracks compliance (insurance expiry alerts), assigns drivers to trucks, watches utilization on a large live map, exports weekly reports, and receives consolidated payouts with driver splits handled automatically. *Needs: oversight, compliance, consolidated money, a real screen — not a phone.*

**Persona — Anita (Ops Admin).** Reviews the KYC queue each morning, approves/rejects drivers, watches the live ops map during peak hours, tweaks surge for a rainy evening and nudges the highway commission band, resolves a disputed cancellation, exports the weekly revenue report. *Needs: a fast, clear web console.*

### 2.3 Platform Composition
- **TowGo** — React Native, iOS + Android — browse, book, live-track, pay, SOS.
- **TowPartner** — React Native, iOS + Android — KYC, job workflow, navigation, transparent earnings. **No subscription screens — approved drivers earn immediately.**
- **TowFleet Web Console** — Next.js web — fleet/truck/driver management, compliance, live fleet map, payouts. Desktop-grade tables, bulk operations, CSV exports.
- **Towing Admin** — Next.js web — verification, live ops, pricing/commission controls, finance, analytics.
- **Shared Backend** — AWS Node.js (NestJS) API + Socket.io dispatch engine — the foundation all four sit on.
- **Shared Web Monorepo** — TowFleet Web and Towing Admin share one Next.js monorepo and component library (two deployments, separate auth realms), cutting web build effort meaningfully.

### 2.4 Revenue Model

**Primary — per-booking platform commission, tiered by service type.** No driver subscriptions, no joining fees, no weekly charges. The platform's income is a slice of every completed booking:

| Commission Band | Covers | Launch Default |
|---|---|---|
| **Band A — Local & Roadside** | Tows ≤ 40 km; battery jumpstart, flat-tyre, fuel delivery, breakdown assistance | **10%** |
| **Band B — Highway & Intercity** | Tows 40–100 km, highway-zone pickups, accident recovery | **8%** |
| **Band C — Long-Distance** | Flatbed hauling > 100 km | **5%** |

- Every rate is **admin-editable** within a configurable guardrail (floor 5%, cap 10% — guardrail itself editable by Super Admin only).
- The applicable band and % are **locked at booking confirmation** together with the fare — later admin changes never affect in-flight bookings.
- Bigger tickets carry a lower take: a ₹40,000 long-distance haul at 5% still earns the platform ₹2,000 while keeping the platform irresistible to high-value drivers.

**Secondary revenue:**
1. **Cancellation fees** — retained per policy (§3.5), used to compensate drivers / cover cost.
2. **Future B2B (phased, §29):** corporate/insurance contracts, garage marketplace take-rate, premium placements.

**Why commission-only wins here (vs the earlier subscription model):**
- **Zero supply friction** — the hardest problem for a new marketplace is driver acquisition; "install, verify, earn tonight" beats "pay ₹999/week before your first job."
- **Aligned incentives** — the platform earns only when drivers earn; growth efforts concentrate on booking volume, which helps everyone.
- **Simpler ops** — no renewal billing, grace periods, dunning, plan-tier support tickets, or paywall edge cases.
- **Market-standard** — Uber, Ola, and Rapido trained Indian drivers to expect commission-based platforms; no education needed.

### 2.5 Success Metrics (KPIs)
- **Acquisition:** customer installs, driver signups, KYC approval rate, **time-from-install-to-first-online** (target < 48h including manual KYC).
- **Activation:** % drivers who go online within 48h of approval; % customers who complete a first booking.
- **Marketplace health:** fill rate (jobs matched / requested), time-to-match (p50 < 30s, p90 < 90s), time-to-arrival, cancellation rate, offer acceptance rate.
- **Revenue:** GMV, AOV, **commission revenue (net revenue)**, **effective take rate** (net revenue ÷ GMV), revenue per active driver.
- **Reliability:** on-time arrival rate, SOS response time, payment success rate, payout SLA, crash-free session rate, real-time propagation latency.
- **Retention:** weekly active drivers, driver 4-week retention, customer repeat-booking rate.

---

## 3. Core Business Rules & Enforcement

### 3.1 The Supply-Side Gate — KYC

**A driver cannot go online until verified. This is the single hard gate.**
All driver documents (driving licence, RC, Government ID, vehicle inspection photos, selfie) must be uploaded and **admin-approved** before the driver can toggle "Online" or receive any job. There is no payment gate — the moment KYC is approved, the driver can earn.

Enforced at three layers:
- **App UI** — the online toggle is disabled with a verification-status banner; job screens show locked states until approval.
- **API middleware** — every protected request passes through a guard that reads `kyc_status` from the JWT (and re-checks the DB on sensitive actions). Pseudocode:
  ```
  if (route.requires('driver_online') && user.kyc_status !== 'approved') {
        return 403 FORBIDDEN { reason: 'kyc_not_approved' }
  }
  ```
- **Database** — assignment writes are guarded so a booking cannot reference a driver whose `kyc_status != 'approved'` (constraint/policy + transactional check).

### 3.2 Job Eligibility Matrix

With subscriptions gone, job eligibility is a pure capability check computed server-side by the dispatch engine on every search. A driver is a candidate for a booking only if **all** of the following hold:

| Check | Rule |
|---|---|
| KYC | `kyc_status = 'approved'` |
| Presence | `is_online = true` and location ping fresh (≤ 15s old) |
| Vehicle class | Truck class matches the request (wheel-lift / flatbed); roadside services (battery, tyre, fuel, breakdown) open to both classes |
| Distance band | Local & highway jobs → any eligible driver. **Long-distance (> 100 km) → flatbed + driver's `long_distance_enabled` flag** (driver opt-in, admin can revoke) |
| Availability | Not currently on an active job and no pending offer |
| Zone | Inside an active service zone; fleet trucks must be `active` (compliance valid) |

> The `long_distance_enabled` opt-in replaces the old Pro/Fleet plan-tier gating: long hauls need capable trucks and willing drivers, not a more expensive plan.

### 3.3 Commission Structure (full)

| Band | Services | Distance | Commission | Rationale |
|---|---|---|---|---|
| **A — Local & Roadside** | Car/bike tow, wheel-lift, flatbed (local), battery, flat-tyre, fuel, breakdown | ≤ 40 km | **10%** | High frequency, small tickets |
| **B — Highway & Intercity** | Tows 40–100 km, highway-zone pickup, accident recovery | 40–100 km | **8%** | Mid tickets, higher driver effort |
| **C — Long-Distance** | Flatbed hauling | > 100 km | **5%** | Large tickets; low take keeps supply loyal |

**Rules:**
- **Band resolution:** service type + billed distance decide the band; accident recovery always resolves to Band B minimum. Resolution happens at estimate time and is shown to the customer only as part of the total (customers see fares, not commission).
- **Locked at confirm:** `commission_band` + `commission_pct` are written onto the booking in the same transaction that locks the fare. Admin edits apply to *future* bookings only.
- **Guardrail:** admin edits are validated server-side against the floor/cap (5%/10% at launch); attempts outside the band are rejected and audited.
- **Driver transparency (Rapido-style trust):** every job offer shows the driver **gross fare, commission %, and net earning before accepting**; every completed trip shows the same breakdown in earnings history. No surprises = supply retention.
- **Fleet drivers:** commission applies to the booking total first; the remaining pool is split driver/fleet per the configured share (§3.4, §14.3).
- **Future:** driver-level commission reductions (reward engine, §3.6) can lower a driver's effective % but never below the floor — schema supports it now, automation is phased (§29).

### 3.4 Money-Integrity Rules
- **Atomic booking + fare lock + commission lock + assignment** in a single DB transaction (no double-assignment, no orphan bookings, no rate drift).
- **Commission on every completed booking**, band-driven, admin-configurable within guardrails.
- **Driver–fleet split at payout layer** for fleet-affiliated drivers (configurable share).
- **No raw card data stored** — Razorpay hosted/native checkout handles PCI scope.
- **Idempotent payment capture & payout** — every money operation carries an idempotency key to prevent duplicates on retry.
- **Ledger-first wallets** — balances are derived from an append-only transaction ledger, never mutated directly (§14).

### 3.5 Cancellation Policy (with worked examples)

| Window after booking confirmed | Customer Charge | Driver Compensation |
|---|---|---|
| 0–2 minutes | Free | None |
| 2–10 minutes | Partial fee (default ₹150) | Configurable share of fee |
| > 10 minutes **or** driver en route / at pickup | Full base fare | Configurable share of base fare |

- *Example A:* Customer books, cancels at 1m30s → ₹0.
- *Example B:* Customer books wheel-lift 0–5 km (base ₹999), cancels at 6m before driver moves → ₹150 partial fee.
- *Example C:* Customer books flatbed, driver is en route, customer cancels at 12m → full base fare (e.g. ₹1,999) charged; driver compensated.
- **During search (`SEARCHING`)** cancellation is always free — the customer hasn't been matched yet.
- **Driver cancellations** and **"unable to deliver"** (customer unavailable / wrong address / refused) are logged separately, count against acceptance/completion rate, trigger automatic re-dispatch (§6.7), and never charge the customer.

### 3.6 Driver Reward & Level Engine

Levels computed from rolling 30-day completed rides, average rating, acceptance rate, and customer feedback.

| Level | Example Threshold (configurable) | Rewards |
|---|---|---|
| Bronze | Default / new | Standard commission, standard job priority |
| Silver | 50+ rides, ≥4.5★, ≥80% acceptance | Minor priority boost |
| Gold | 150+ rides, ≥4.7★, ≥85% acceptance | Priority bookings, small bonus incentives |
| Platinum | 400+ rides, ≥4.8★, ≥90% acceptance | Reduced commission (never below the 5% floor), top priority, VIP support, faster payouts |

> **This build:** the **level badge is displayed** and thresholds are tracked; **full reward automation** (commission reduction, priority weighting in dispatch, bonus payouts) is a phased item (§29). Schema and metrics are included now so it can be switched on later without migration. Note the natural fit: with a tiered commission model, level rewards are simply per-driver percentage adjustments inside the same engine.

### 3.7 Account & Verification Status States

| Entity | Status | Meaning | Can Operate? |
|---|---|---|---|
| Customer | `active` / `suspended` | Standard / blocked | ✅ / ❌ |
| Driver KYC | `pending` | Submitted, awaiting review | ❌ |
| Driver KYC | `approved` | Verified | ✅ |
| Driver KYC | `rejected` | Denied, reason given, can re-submit | ❌ |
| Driver KYC | `incomplete` | Missing documents | ❌ |
| Driver KYC | `suspended` | Previously approved, now blocked | ❌ |
| Driver capability | `long_distance_enabled` | Flatbed long-haul opt-in | ✅ for Band C jobs |
| Fleet | `active` / `suspended` | Account state | ✅ / ❌ |
| Truck | `active` / `inactive` / `non_compliant` | Operational state (compliance docs valid?) | ✅ / ❌ |

### 3.8 Business Rule Edge Cases
- **Driver goes offline mid-search:** removed from candidate set; if already offered, offer expires and passes to the next candidate.
- **No eligible driver in radius:** radius expands in waves (§6.5); after the max radius/attempts → `no_drivers_found`, customer prompted to retry/widen.
- **Commission band changed by admin mid-search:** irrelevant to the active booking — band + % were locked at confirm.
- **Driver's long-distance flag revoked mid-job:** in-progress job completes normally; no new Band C offers afterwards.
- **Compliance doc expires mid-day (fleet truck):** truck flips to `non_compliant`, removed from dispatch; fleet alerted.
- **Surge changes between estimate and confirm:** fare is **locked at confirm**; estimate clearly states "fare may change with demand until you confirm."
- **Customer with unpaid prior balance:** blocked from new bookings until cleared (admin-configurable).
- **Duplicate booking spam:** rate-limited per customer; one active booking per customer at a time (configurable).

---

## 4. User Roles & Permissions

### 4.1 Top-Level Roles
| Role | Interface | Summary |
|---|---|---|
| Customer | TowGo (mobile) | Book, track, pay, SOS, rate |
| Driver | TowPartner (mobile) | KYC, go online, run jobs, earn |
| Fleet Owner | TowFleet Web (browser) | Manage fleet, compliance, payouts |
| Admin | Towing Admin (browser) | Operate the platform |

Fleet owners and admins authenticate into **separate web realms** (different portals, different session cookies, different RBAC scopes) even though the two consoles share a codebase.

### 4.2 Admin Sub-Roles & Permission Matrix
| Capability | Super Admin | Operations | Support | Finance |
|---|---|---|---|---|
| Approve/Reject KYC | ✅ | ✅ | ❌ | ❌ |
| Suspend/Reactivate users | ✅ | ✅ | ⚠️ (request) | ❌ |
| Edit pricing & surge | ✅ | ✅ | ❌ | ❌ |
| Edit commission bands (within guardrail) | ✅ | ⚠️ (propose) | ❌ | ✅ |
| Edit commission guardrail (floor/cap) | ✅ | ❌ | ❌ | ❌ |
| Live ops monitoring | ✅ | ✅ | ✅ | ❌ |
| Cancel / reassign bookings | ✅ | ✅ | ⚠️ | ❌ |
| Handle disputes / refunds | ✅ | ✅ | ✅ | ✅ |
| Approve payouts | ✅ | ❌ | ❌ | ✅ |
| View finance / ledger | ✅ | ⚠️ (summary) | ❌ | ✅ |
| Manage admins & roles | ✅ | ❌ | ❌ | ❌ |
| Manage promotions/coupons | ✅ | ✅ | ❌ | ❌ |
| Export analytics | ✅ | ✅ | ⚠️ | ✅ |

✅ full · ⚠️ limited/needs approval · ❌ none. Roles are enforced via JWT role claim + server-side RBAC middleware on every admin endpoint.

---

## 5. Lifecycles & State Machines

### 5.1 Customer Booking State Machine

```
                 ┌─────────────────────────────────────────────┐
                 ▼                                             │ (retry / widen)
 [created] → SEARCHING → ASSIGNED → EN_ROUTE → ARRIVED → IN_PROGRESS → COMPLETED → PAID
                 │            │         │          │            │
                 │            │         │          │            └─(driver cannot finish)→ DISPUTED
                 │            └─────────┴──────────┴──→ CANCELLED (policy applies)
                 └──(no eligible driver after retries)──→ NO_DRIVERS_FOUND
```

**Transition table:**
| From | Event | To | Side Effects |
|---|---|---|---|
| created | confirm | SEARCHING | fare + commission band/% locked, dispatch starts, booking OTP generated |
| SEARCHING | driver accepts | ASSIGNED | driver/customer notified; ETA computed; live tracking channel opens |
| SEARCHING | timeout/no drivers | NO_DRIVERS_FOUND | customer prompted to retry/widen |
| ASSIGNED | driver moves | EN_ROUTE | live location stream begins (§11) |
| EN_ROUTE | driver arrives | ARRIVED | "driver arrived" push; waiting timer arms after grace |
| ARRIVED | OTP verified | IN_PROGRESS | job timer starts |
| IN_PROGRESS | driver completes | COMPLETED | fare finalized, waiting charges added |
| COMPLETED | payment captured | PAID | commission retained, driver/fleet wallet credited, invoice generated, rating prompt |
| any active | cancel | CANCELLED | cancellation fee per policy; driver compensated; if driver cancelled → auto re-dispatch |
| IN_PROGRESS | failure | DISPUTED | ops review |

### 5.2 Driver Job State Machine
`offered → accepted → arriving → arrived → otp_verified(started) → completed` (with `rejected`, `expired`, `cancelled`, `unable_to_deliver` branches). Each transition emits a WebSocket event to the customer + admin and updates `booking_status_history`.

### 5.3 KYC Verification Lifecycle
`incomplete → pending(submitted) → [admin] → approved | rejected(reason) | request_info → (re-submit) → pending`. Approval triggers Push + SMS + WhatsApp — and the driver can go online **immediately**; there is no further payment step. Suspension reachable from `approved` at any time by admin.

### 5.4 Driver Earning & Settlement Lifecycle
`job COMPLETED → payment captured (PAID) → commission retained (band % locked on booking) → net credited to driver wallet ledger [→ fleet split if fleet-affiliated] → payout_requested → processing (Razorpay Route) → paid | failed(retry)`. Every step idempotent and ledgered; the driver sees gross → commission → net per trip in the app.

### 5.5 Payment & Payout Lifecycle
`fare_locked → payment_pending → captured | failed(retry) → settled`. Payout: `earning_credited(wallet) → payout_requested → processing(Route) → paid | failed`. All steps idempotent and ledgered.

### 5.6 SOS Lifecycle
`triggered → contacts_notified + location_broadcast + ops_alerted → acknowledged(ops) → resolved`. SOS works during any active booking and (configurable) standalone.

### 5.7 Compliance (Fleet Truck) Lifecycle
`active → (doc within 30d of expiry) alert_sent → (expired) non_compliant → (renewed & re-uploaded) active`. Non-compliant trucks are excluded from dispatch automatically.

---

## 6. Dispatch & Matching Engine — Progressive-Radius Nearest-Driver Search

The heart of the marketplace, and the section that most decides whether Towing *feels* like Uber/Rapido. Runs on every `SEARCHING` booking. Design goals: **median time-to-match < 30s, p90 < 90s** in covered zones; never double-offer; never double-assign; every parameter tunable from admin without a deploy.

### 6.1 How Driver Locations Are Kept Hot
- Online drivers stream location every 3–5s over WebSocket (§11).
- Each ping updates **Redis** (`GEOADD drivers:online:{zone}` + a per-driver hash with heading, class, capability flags, last-ping timestamp) — the *hot* store the matcher queries in ~1ms.
- PostgreSQL (`drivers.current_location`, PostGIS `geography(Point)` + GIST index) is refreshed on a slower cadence (every ~30s and on go-online/offline) — the *authoritative* store used for verification, analytics, and recovery if Redis is rebuilt.
- Drivers whose last ping is **older than 15s are excluded** from candidate sets (stale GPS = phantom supply, the classic cause of "driver never moved" complaints).

### 6.2 Candidate Selection
1. **Spatial query:** `GEOSEARCH` Redis for online drivers within the current wave radius of the pickup, ordered by distance (PostGIS `ST_DWithin` / KNN `<->` as authoritative fallback path).
2. **Eligibility filters (server-side, §3.2):** KYC approved · fresh ping · vehicle class matches · Band C requires `long_distance_enabled` · not on an active job · no pending offer · zone active · fleet truck compliant.
3. **Scoring** — candidates ranked by a weighted score (weights admin-configurable):

| Factor | Launch Weight | Notes |
|---|---|---|
| Proximity (ETA-biased) | 60% | Straight-line distance at query time; road-ETA refinement phased |
| Driver rating | 15% | Rolling 30-day average |
| Acceptance rate | 15% | Discourages cherry-picking |
| Completion rate | 10% | Penalizes mid-job cancels |
| Level boost | phased | Priority weighting for Gold/Platinum (§3.6, §29) |

### 6.3 Offer Lifecycle
- The top-scored candidate gets a `job:offer` push + WebSocket event with a **20-second server-authoritative countdown** (client shows the timer; the server's clock decides).
- The offer card shows: service, pickup distance & area, est. gross fare, **commission % and net earning**, customer rating.
- **One offer per driver at a time**, ever — a driver with a pending offer is invisible to other searches (Redis lock `offer:{driver_id}`, TTL = timeout + grace).
- On **reject** or **timeout**, the offer passes to the next candidate; rejected drivers are excluded for the remainder of this search.
- On **accept**, assignment runs as an **atomic transaction**: `SELECT … FOR UPDATE` on the booking → verify still `SEARCHING` → verify driver still eligible → write assignment + history → commit. A losing simultaneous accept gets a graceful "job no longer available."

### 6.4 Progressive Radius Expansion (Wave Search)

The search starts tight — the nearest driver gives the fastest arrival — and **widens in waves until a cap**:

| Wave | Radius (urban default) | Max sequential offers | Wave behavior |
|---|---|---|---|
| 1 | 2 km | 3 | Query, score, offer one-by-one |
| 2 | 4 km | 3 | Re-query (fresh supply may have come online); exclude prior decliners |
| 3 | 7 km | 3 | 〃 |
| 4 | 10 km | 3 | 〃 |
| 5 (final) | **15 km cap** | 4 | Last attempt before giving up |

- **Empty wave → advance immediately** (no dead waiting time); the ~3-minute worst case only occurs when offers are actually being declined.
- **Caps by context:** radius ladder and cap are configured **per zone and per service**. Long-distance (Band C) searches use a wider ladder (10 → 25 → 50 km) because flatbed long-haul supply is sparse and a 40-km empty run is acceptable against a 300-km job.
- **Max total search time:** ~3 minutes (configurable) → `NO_DRIVERS_FOUND`.
- **Customer messaging tracks the waves** (§6.6) so widening feels like effort, not silence.

### 6.5 Re-Dispatch on Driver Cancel
If an assigned driver cancels (or is cancelled by ops), the booking **returns to `SEARCHING` with priority**: it re-enters the matcher at the front of the queue, the cancelling driver is excluded, the search resumes **at the wave where it previously matched** (not from wave 1), and the customer sees an honest banner — "Your driver had to cancel. Finding you a new one now." The cancel is logged against the driver's completion rate.

### 6.6 Customer-Facing Search Experience
| Engine state | Customer sees |
|---|---|
| Wave 1–2 | Radar pulse animation over the map + "Contacting the nearest tow driver…" + live count "3 drivers contacted" |
| Wave 3+ | "Expanding your search…" (radius ring visibly grows on the map) |
| Re-dispatch | "Your driver had to cancel — finding you a new one (you won't be charged)" |
| `NO_DRIVERS_FOUND` | "No drivers free right now." → actions: **Try again** (full ladder re-run, decliners re-included) · **Get help** (support) |
| Any time during search | **Cancel — always free** before assignment |

### 6.7 Admin-Tunable Dispatch Parameters (no deploy needed)
`radius ladder & cap (per zone/service) · offer countdown (default 20s) · max offers per wave · max total search time · scoring weights · stale-ping threshold · re-dispatch priority · one-active-booking-per-customer toggle`. All changes versioned + audited.

### 6.8 Pseudocode
```
function dispatch(booking):
  ladder = config.radiusLadder(booking.zone, booking.service)   # e.g. [2,4,7,10,15] km
  declined = {}
  deadline = now() + config.maxSearchTime                        # ~3 min
  for radius in ladder:
    candidates = redis.geosearch(booking.pickup, radius)
                   .filter(eligible(booking))                    # §3.2 checks
                   .exclude(declined)
                   .rank(score)                                  # §6.2 weights
    for driver in candidates.take(config.offersPerWave):
      if now() > deadline: break 2
      offer = sendOffer(driver, booking, timeout=20s)            # locks driver
      if offer.accepted:
        assign(booking, driver)                                  # atomic txn
        return ASSIGNED
      declined.add(driver)
  return NO_DRIVERS_FOUND
```

### 6.9 Worked Timeline Example
`T+0s` customer confirms → `T+1s` wave 1 (2 km): 2 candidates found, best is D1 (900 m, 4.8★) → offer → `T+9s` D1 rejects → offer D2 → `T+29s` D2 times out → `T+30s` wave 2 (4 km): D3 found (2.8 km) → offer → `T+41s` **D3 accepts** → atomic assign → customer sees driver card + live truck marker. Time-to-match: **41 seconds, two waves.**

### 6.10 Geofencing
- **Service zones** are polygons (`geography(Polygon)`) defining where the platform operates and how pricing/surge applies (city limits vs highway service areas).
- A booking's pickup is point-in-polygon tested to pick the zone, its surge band, any highway charge, and its dispatch radius ladder.
- Drivers can be restricted to zones; zones can be toggled active/inactive from admin.

### 6.11 Dispatch Edge Cases
- **Driver goes offline / ping goes stale mid-offer:** offer auto-expires early; next candidate offered.
- **Two bookings compete for the same driver:** impossible by design — the per-driver offer lock serializes offers.
- **Driver accepts as their app loses network:** accept is queued locally and replayed (§21); if the server-side offer already expired, the driver gets a clear "offer expired" message, never a ghost job.
- **Booking cancelled during search:** matcher aborts, any pending offer is revoked with a "booking cancelled" notice.
- **Supply appears mid-wave** (driver comes online nearby): picked up naturally at the next wave's fresh re-query.

---

## 7. Pricing & Commission Engine

Multi-factor, fully admin-configurable. Launch matrices below.

**Formula:**
```
Total = BaseFare(vehicle_class, distance_slab)
      + NightCharge        (+15% of base, in night window)
      + HighwayPickup      (+₹500–₹1,000 if pickup in highway zone)
      + AccidentRecovery   (+₹1,500 if accident-recovery service)
      + WaitingCharge      (₹5/min after first 15 min on-site)
      + Surge              (+10–25% by zone/demand/weather band)
      − Discount           (coupon, if any)

commission%     = CommissionBand(service_type, distance)   # A 10% · B 8% · C 5% (§3.3)
PlatformEarning = Total × commission%
DriverPool      = Total − PlatformEarning
DriverPayout    = DriverPool                                # independent driver
FleetSplit      = DriverPool × fleet_share                  # fleet-affiliated drivers only
```
All computation in paise precision; commission rounded half-up to the paisa; driver net = total − commission (so the two always sum exactly).

### 7.1 Wheel-Lift Base Pricing (small cars, sedans, city recovery)
| Distance | Price |
|---|---|
| 0–5 km | ₹999 |
| 5–10 km | ₹1,499 |
| 10–20 km | ₹2,199 |
| 20–40 km | ₹3,499 |
| 40–60 km | ₹4,999 |
| 60–80 km | ₹6,499 |
| 80–100 km | ₹7,999 |

### 7.2 Flatbed Base Pricing (luxury, SUV, EV, accident recovery, long-distance)
| Distance | Price |
|---|---|
| 0–5 km | ₹1,999 |
| 5–10 km | ₹2,999 |
| 10–20 km | ₹4,499 |
| 20–40 km | ₹6,499 |
| 40–60 km | ₹8,499 |
| 60–80 km | ₹10,999 |
| 80–100 km | ₹13,499 |

### 7.3 Long-Distance Flatbed (Band C — capable, opted-in drivers)
| Distance | Price |
|---|---|
| 100–150 km | ₹16,000 – ₹20,000 |
| 150–250 km | ₹22,000 – ₹30,000 |
| 250–400 km | ₹35,000 – ₹48,000 |
| 400–600 km | ₹55,000 – ₹75,000 |
| 600 km+ | Custom quote (manual at launch) |

### 7.4 Additional Charges
| Charge | Amount |
|---|---|
| Night towing | +15% |
| Highway pickup | +₹500 – ₹1,000 |
| Accident recovery | +₹1,500 |
| Waiting after 15 min | ₹5 / min |
| Rain / emergency surge | +10–25% |

### 7.5 Worked Examples (commission bands applied)
- **Wheel-lift, 8 km, daytime (Band A · 10%):** base ₹1,499 → total ₹1,499. Platform ₹149.90; driver ₹1,349.10.
- **Flatbed, 15 km, night (Band A · 10%):** base ₹4,499 + 15% night ₹674.85 = ₹5,173.85. Platform ₹517.39; driver ₹4,656.46.
- **Wheel-lift, accident recovery, 25 km, surge 20% (Band B · 8% — accident always ≥ Band B):** base ₹3,499 + ₹1,500 accident = ₹4,999 → +20% surge ₹999.80 = ₹5,998.80. Platform ₹479.90; driver ₹5,518.90.
- **Fleet driver, flatbed 12 km, fleet share 80/20 (Band A · 10%):** total ₹4,499; platform ₹449.90; pool ₹4,049.10 → driver 80% ₹3,239.28, fleet 20% ₹809.82.
- **Long-distance flatbed, 300 km, quoted ₹40,000 (Band C · 5%):** platform ₹2,000; driver/fleet pool ₹38,000 — the low take on big tickets is deliberate supply retention.

### 7.6 Estimate Contract & Guarantees
- The estimate endpoint returns the full line-item breakdown + band + ETA in **≤ 2s**; the customer sees fares, never commission.
- Fare **and** commission % lock at confirm in one transaction; surge/admin changes only affect future bookings.
- Waiting charges accrue only after the driver has been at pickup 15 minutes, are visible live to both parties, and are added at completion.

> **Geofencing** decides where night/highway/surge rules apply and which zone surge band is in effect. Advanced weather/holiday/toll auto-calculation is phased (§29).

---

## 8. Site Architecture & Screen Structure

### 8.1 TowGo — Customer App (React Native)
```
TowGo (Customer)
├── Onboarding
│   ├── Splash
│   ├── Auth (/auth) — Mobile OTP · Google · Apple sign-in
│   └── Profile setup — name, photo, saved vehicles + RC, emergency contacts, saved addresses
├── Home (/) — map-first
│   ├── Live map with nearby tow-truck markers + "Help near you" ETA
│   ├── Service catalog (9 services) in a bottom sheet
│   ├── Promotional / safety banners
│   └── Quick re-book
├── Booking Flow (/book) — bottom-sheet steps over the map
│   ├── Service → vehicle type
│   ├── Pickup (GPS + map pin + autocomplete) → drop
│   ├── Distance + transparent fare estimate (breakdown)
│   └── One-tap Confirm
├── Finding Driver (/searching) — radar animation, wave status, free cancel
├── Live Tracking (/trip/[id])
│   ├── Driver card · live map · ETA · status timeline
│   ├── Booking OTP · in-app chat & call · share-trip link
│   └── Cancel (policy)
├── SOS (global)
├── Payments — Razorpay + wallet + breakdown
├── Trips (/trips) — active + history, invoice PDF, rate, re-book
└── Account (/account) — profile, vehicles, addresses, emergency contacts, notifications, wallet, coupons, help
```

### 8.2 TowPartner — Driver App (React Native)
```
TowPartner (Driver)
├── Onboarding & KYC (/auth → /kyc) — OTP, document upload, truck class + long-distance opt-in,
│                                      verification states (online locked until approved — no payment step)
├── Home / Dashboard (/) — online/offline toggle (KYC-gated), today's earnings/trips/acceptance/level,
│                          incoming job offer sheet (gross · commission % · NET earning · countdown)
├── Active Job (/job/[id]) — detail, OTP entry, navigation, live ping, status actions, unable-to-deliver
├── Earnings & Wallet (/earnings) — balance, per-trip gross→commission→net, weekly reports, payout requests
└── Account — profile, documents, truck & capability settings, ratings, level, support
```

### 8.3 TowFleet — Fleet Owner Web Console (Next.js)
```
TowFleet Web (fleet.towing.app)
├── Login (/login) — email/password + OTP verify; business profile setup on first login
├── Dashboard (/) — KPI cards, utilization, revenue, alert feed
├── Live Map (/map) — full-width fleet map: trucks, active jobs, statuses
├── Trucks (/trucks) — table + detail drawer: add/edit, compliance checklist, 30-day expiry alerts, bulk upload
├── Drivers (/drivers) — invite/onboard, assign trucks, KYC status, per-driver performance
├── Jobs (/jobs) — fleet jobs feed + history, filters, export CSV
├── Earnings & Payouts (/earnings) — consolidated earnings, driver-split breakdown, payout requests (Route)
├── Reports (/reports) — per truck / driver / period; CSV/PDF export
└── Settings (/settings) — business profile, users, notification prefs
```

### 8.4 Towing Admin — Web Dashboard (Next.js)
```
Towing Admin (admin.towing.app)
├── Dashboard (/) — active rides, online drivers, today's GMV & commission, key metrics
├── Verification (/drivers/pending)  ← Primary workflow
├── Users & Drivers (/users, /drivers) — search, detail, suspend/reactivate, history, capability flags
├── Fleets (/fleets) — accounts, trucks, drivers, compliance oversight
├── Live Operations (/ops) — live map of bookings + drivers, dispatch inspector
├── Bookings (/bookings) — active/completed/cancelled, view/cancel/reassign/dispute, invoice PDF
├── Pricing (/pricing) — fares, slabs, multipliers, charges, surge bands, service zones/geofencing
├── Commission (/commission) — band editor (A/B/C %), guardrail view, dispatch parameters
├── Payments & Payouts (/finance) — transactions, wallet ledger, payout approvals
├── Promotions (/promos) — banners, coupons
├── Support (/support) — tickets
└── Analytics (/analytics) — GMV, take rate, commission revenue, peak times, heat maps, performance
```

---

## 9. Detailed Screen Specifications

Each screen lists: **purpose · key components · states (loading / empty / error / success) · interactions · edge cases · acceptance criteria (AC).**

### 9.1 TowGo (Customer App) — Complexity: HIGH

#### 9.1.1 Splash
- **Purpose:** brand moment + session check.
- **Components:** logo, tagline, subtle motion.
- **Behavior:** check stored session (MMKV) → route to Home if valid, else Auth; auto-advance ≤ 2s.
- **AC:** never blocks > 2s; degrades to Auth on any session error.

#### 9.1.2 Auth (Mobile OTP · Google · Apple)
- **Components:** country code + 10-digit mobile field; "Send OTP"; 6-digit OTP input with auto-submit; 30s resend timer; Google & Apple buttons (Apple mandatory on iOS).
- **States:** sending OTP (spinner) · OTP sent · invalid number (inline error) · wrong OTP (shake + count) · too many attempts (locked, retry later) · network error (retry).
- **Edge cases:** OTP expiry (10 min) → resend; SIM has no signal → SMS fallback messaging; social sign-in cancelled → return cleanly.
- **AC:** OTP delivered < 10s (Indian numbers); max 5 attempts then cooldown; successful auth issues JWT + refresh token; Apple/Google link to same account by verified phone where possible.

#### 9.1.3 Profile Setup
- **Components:** full name (req), profile photo (optional → S3), add vehicle (type, make/model, plate, RC upload), emergency contacts (name/phone/relation), saved addresses (GPS + label).
- **States:** uploading (progress) · upload failed (retry) · saved.
- **Edge cases:** skip optional fields; large image auto-compressed before upload; duplicate plate warning.
- **AC:** at least name required to proceed; vehicles/addresses editable later; images stored encrypted (S3 SSE-KMS).

#### 9.1.4 Home (map-first, Uber/Rapido pattern)
- **Components:** full-bleed map with **live nearby tow-truck markers** (anonymized positions, refreshed ~10s — the "supply is real" signal that builds instant trust); location header ("Help near you", auto-detected, tap to change); bottom sheet with **service catalog** (9 services — Appendix B); promo/safety banner carousel (admin-configurable); quick re-book chip (last service).
- **States:** locating (skeleton map + shimmer) · location denied (manual entry prompt) · no nearby drivers (catalog still bookable; honest "few drivers nearby" note) · offline (cached catalog + "limited connectivity" strip).
- **Edge cases:** GPS denied → manual address; outside any service zone → "Not yet available in your area" + waitlist (phased).
- **AC:** catalog renders from cache instantly then refreshes; nearby-driver markers never identify a specific driver pre-booking; tapping a service starts booking; location change updates ETA + zone.

#### 9.1.5 Booking Flow (bottom-sheet steps, 3 taps to confirm)
- **Step 1 — Service & vehicle:** choose service; select vehicle (from saved or new); vehicle determines class (wheel-lift/flatbed) and base matrix.
- **Step 2 — Locations:** pickup via GPS + draggable map pin + Places autocomplete; drop location (optional for some services); distance via Distance Matrix.
- **Step 3 — Fare estimate:** transparent breakdown (base, night, highway, accident, surge, est. total) + ETA; clear note "fare locks when you confirm; may change with demand until then."
- **Step 4 — Confirm:** one-tap "Confirm Booking" → fare + commission locked, OTP generated, dispatch starts.
- **States:** computing fare (skeleton rows) · no drop needed · surge active (badge) · payment method check · confirming (spinner).
- **Edge cases:** pin moved outside zone → re-evaluate/charge; surge changes pre-confirm → estimate updates with a gentle pulse; payment method missing → prompt to add.
- **AC:** estimate within ~2s; **end-to-end open→confirm < 45s** on a warm app; a saved-vehicle repeat booking is literally 3 taps (service → confirm pickup → confirm); confirmation produces a `SEARCHING` booking + OTP.

#### 9.1.6 Finding Your Driver (search state)
- **Purpose:** make the progressive-radius search (§6) feel alive — the moment Uber/Rapido win or lose users.
- **Components:** radar-pulse animation centered on pickup; expanding radius ring synced to search waves; status copy per wave ("Contacting the nearest tow driver…" → "Expanding your search…"); count of drivers contacted; **Cancel — free** button.
- **States:** wave 1–2 · widening (wave 3+) · re-dispatch after driver cancel (banner) · `NO_DRIVERS_FOUND` (retry / get help) · matched (hero transition to tracking).
- **Edge cases:** app backgrounded during search → push on match; network drop → search continues server-side, state resyncs on reconnect.
- **AC:** wave transitions reflect the actual engine state (no fake progress); cancel during search always ₹0; match transition < 1s from server event.

#### 9.1.7 Live Tracking (see §11 for the full system spec)
- **Components:** driver card (name, photo, vehicle, plate, rating, call/chat); live map with smoothly animated truck marker (interpolated, bearing-rotated), snapped route polyline, ETA countdown; **status timeline** (Searching → Assigned → En route → Arrived → In progress → Completed); **Booking OTP** prominently (hand to driver on arrival); **Share trip** (read-only public link via WhatsApp/SMS); cancel button (policy-aware, shows fee before confirming).
- **States:** assigned · en route (moving marker) · arrived (OTP highlighted + haptic) · in progress · completed (→ payment) · cancelled · connection lost ("reconnecting" + last-known ghost marker).
- **Edge cases:** driver location stale > 15s → reconnecting state; driver cancels → re-dispatch banner; OTP never visible before assignment.
- **AC:** location & ETA update within 2s; marker motion is smooth (no teleporting); cancel reflects correct fee per policy; OTP one-time, expires 30 min; share-link viewers see position + ETA only (no phone numbers).

#### 9.1.8 SOS (global, always reachable during active trip)
- **Components:** large SOS button; on trigger → confirm (2-tap to avoid accidental); shares live location to emergency contacts (SMS/WhatsApp), alerts ops, optionally broadcasts to nearest drivers.
- **States:** idle · armed · sent (confirmation + "help notified") · resolved.
- **Edge cases:** poor network → SMS fallback; accidental trigger → cancel within 5s.
- **AC:** SOS fires reliably on degraded networks; contacts receive location link; ops sees alert in real time.

#### 9.1.9 Payments & Wallet
- **Components:** Razorpay sheet (UPI, cards, wallets); in-app wallet balance; fare breakdown; apply coupon; saved methods.
- **States:** capturing (spinner) · success (animated check + invoice) · failed (retry / change method) · partial wallet + gateway.
- **Edge cases:** payment failure post-completion → booking stays `COMPLETED` until paid; retry idempotent; refund flow for disputes.
- **AC:** no raw card data stored; success transitions to `PAID`, generates invoice PDF, prompts rating.

#### 9.1.10 Trips (Active + History)
- **Components:** active trip card; history list (date, service, fare, driver, status); invoice (PDF) download; rate & review; re-book.
- **States:** empty ("No trips yet") · loading · error (retry).
- **AC:** history paginates; invoices downloadable; re-book pre-fills last booking.

#### 9.1.11 Account
- **Components:** profile, saved vehicles, addresses, emergency contacts, notification preferences, wallet & coupons, help & support, legal (privacy/terms), logout.
- **AC:** edits persist; logout clears session/tokens; document re-upload supported.

---

### 9.2 TowPartner (Driver App) — Complexity: HIGH

#### 9.2.1 Auth, KYC & Capability Setup
- **Components:** OTP login; KYC wizard — driving licence, RC, **Government ID**, vehicle inspection photos, selfie (liveness optional/phased); **truck class selection (wheel-lift / flatbed)** and **long-distance opt-in** (flatbed only); progress indicator; status screen (pending/approved/rejected/incomplete with reasons). Prominent reassurance: **"Free to join. No weekly fees. You keep 90–95% of every fare."**
- **States:** uploading (per-doc progress) · submitted (pending) · approved (celebration → online unlocked immediately) · rejected (reasons + re-submit) · request-info.
- **Edge cases:** blurry/oversized images → client compression + quality hint; partial submission saved as `incomplete`; capability change later (e.g., enabling long-distance) → instant, no re-KYC unless truck changes.
- **AC:** online toggle stays locked until `approved` and unlocks the moment approval lands (real-time push); documents stored encrypted (S3 SSE-KMS, private + pre-signed access); approval triggers Push + SMS + WhatsApp.

#### 9.2.2 Home / Dashboard
- **Components:** **Online/Offline toggle** (disabled only by KYC state); today's earnings (net), trips, acceptance rate, **level badge**; **incoming job offer sheet** — service, pickup distance & area, est. gross fare, **commission % and net earning**, customer rating, **Accept / Reject + 20s countdown ring**; earnings-so-far ticker.
- **States:** offline · online idle (waiting, subtle pulse) · job offer (timer, full-screen takeover + sound + haptic) · on a job (dashboard locked to active job).
- **Edge cases:** offer arrives with weak signal → still actionable, accept queued & replayed (§21); offers never stack (one at a time, §6.3); countdown is server-authoritative — a lagging client can't extend it.
- **AC:** toggle respects the KYC gate; offer shows **net** earnings before accept (transparency AC); accept atomically assigns and routes to Active Job; reject/timeout reassigns elsewhere.

#### 9.2.3 Active Job
- **Components:** job + customer detail (name, pickup/drop, vehicle, fare); **navigation** (Google Maps deep link / in-app, traffic-aware); **Booking OTP entry** to start; status actions (arrived / start / complete); continuous live location ping; call/chat; **unable-to-deliver** (customer unavailable / wrong address / refused).
- **States:** navigating to pickup · arrived · awaiting OTP · in progress · completing (fare finalize incl. waiting) · completed (shows gross → commission → **net credited**).
- **Edge cases:** wrong OTP (retry, capped); customer unreachable → unable-to-deliver flow with reason; GPS drop → buffered pings sync on reconnect (§21).
- **AC:** job cannot start without valid OTP; live location streams to customer + admin within 2s; completion finalizes fare, adds waiting charges, and shows the driver their exact net.

#### 9.2.4 Earnings & Wallet
- **Components:** balance; **per-trip breakdown: gross fare → commission (band + %) → net**; daily/weekly charts; commission-band explainer ("Local 10% · Highway 8% · Long-distance 5%"); **payout request** (to bank via Route), payout history & status.
- **States:** empty · loading · payout pending/processing/paid/failed.
- **AC:** earnings derived from ledger; every trip's commission math is visible and audit-consistent; payout requests respect minimum threshold + schedule; statuses update in real time.

#### 9.2.5 Account
- Profile, documents (re-upload), truck & capability settings (class, long-distance opt-in), ratings, level + thresholds, cancellation/fee visibility, notification prefs, support, legal, logout.

---

### 9.3 TowFleet Web Console (Fleet Owner) — Complexity: HIGH

> Moved from mobile to **web** deliberately: fleet owners work at desks with spreadsheets, documents, and multiple trucks to monitor. A desktop console gives them big live maps, dense tables, bulk uploads, and exports a phone never could. (A companion mobile app is a roadmap item, §29.)

#### 9.3.1 Login & Onboarding
- **Components:** email + password with mobile-OTP verification; first-login wizard — business profile (name, GSTIN optional, address), bank details for payouts (Route), notification preferences.
- **States:** invalid credentials · OTP pending · wizard progress (resumable).
- **AC:** fleet realm session separate from admin; wizard resumable; account usable only after business profile completes.

#### 9.3.2 Dashboard
- **Components:** KPI cards (active trucks, jobs today, revenue today, utilization %); alert feed (expiring docs, idle trucks, non-compliant trucks, failed payouts); mini live map; quick links.
- **States:** loading (skeleton cards) · empty (no trucks yet → prominent "Add your first truck" CTA) · alerts present.
- **AC:** KPIs real-time (Socket.io); alerts deep-link to the relevant truck/driver/payout.

#### 9.3.3 Live Fleet Map
- **Components:** full-width map with every truck (status-colored: on job / idle / offline / non-compliant), active job routes, click marker → side panel (truck, driver, current job, ETA); filters (status, driver, zone).
- **AC:** positions update ≤ 2s behind driver pings; panel links to truck/driver/job detail.

#### 9.3.4 Trucks & Compliance
- **Components:** trucks table (sortable/filterable, TanStack) — plate, type, capacity, assigned driver, compliance state; detail drawer: **Compliance Checklist** per truck — insurance, RC, PUC, permit (upload + issue/expiry dates); status (active / inactive / non_compliant); **30-day expiry alerts**; bulk CSV import of trucks.
- **States:** compliant · expiring soon (amber, days-left chip) · expired (red, auto-removed from dispatch).
- **Edge cases:** missing doc → truck cannot dispatch; expired mid-day → auto non-compliant + alert (EventBridge).
- **AC:** documents stored encrypted; expiry alerts fire 30 days prior; non-compliant trucks excluded from matching automatically; bulk import validates per-row with a downloadable error report.

#### 9.3.5 Drivers
- **Components:** driver table — name, KYC state, assigned truck, rating, trips, earnings; invite flow (driver completes KYC in TowPartner; fleet sees status live); assign/unassign truck; per-driver performance panel.
- **AC:** fleet-linked drivers' earnings split per fleet share; KYC always admin-approved centrally; invitations expire and are auditable.

#### 9.3.6 Jobs
- **Components:** live jobs feed + history table; filters (status, driver, truck, date, service); job detail (timeline, fare, split); CSV export.
- **AC:** jobs route through the platform dispatch; fleet sees aggregate + per-driver; exports respect date filters.

#### 9.3.7 Earnings & Payouts
- **Components:** consolidated fleet earnings; **driver–fleet split breakdown per job** (pool after platform commission → driver share / fleet share); fleet wallet; payout requests (Route); payout history with statuses.
- **AC:** split computed at payout layer; ledgered; statuses real-time; monthly statement export (CSV/PDF).

#### 9.3.8 Reports & Settings
- **Reports:** per truck / driver / period; utilization, revenue, compliance history; CSV/PDF export.
- **Settings:** business profile, additional console users (phased), notification prefs, legal.
- **AC:** report queries hit read paths (no impact on live ops); exports contain no customer PII beyond what invoices require.

---

### 9.4 Towing Admin (Web Dashboard) — Complexity: HIGH

#### 9.4.1 Login & Shell
- **Components:** secure role-based login (email + password + optional 2FA); left nav with pending-count badges; role-aware menu.
- **AC:** RBAC enforced server-side; sessions expire; audit log on sensitive actions.

#### 9.4.2 Dashboard
- **Components:** KPI cards (active rides, online drivers, today's GMV, today's commission revenue, pending approvals, fill rate); live activity feed; quick links.
- **AC:** real-time via Socket.io client subscription; cards refresh without full reload.

#### 9.4.3 Verification (Primary Workflow)
- **Components:** KYC queue table (name, phone, vehicle class + long-distance opt-in, submitted date, docs preview, status); detail panel (zoomable documents, selfie, vehicle photos, GPS on map, history); actions — **Approve / Reject (reason) / Request Info / Suspend / Reactivate**; bulk approve/reject.
- **States:** empty queue · loading · acting (per-row spinner).
- **AC:** action triggers driver notification (Push+SMS+WhatsApp); approval instantly unlocks the driver's online toggle (no payment step follows); decision logged with admin id + timestamp; rejected requires reason.

#### 9.4.4 Users & Drivers
- **Components:** searchable/filterable tables (TanStack Table); detail view (profile, trips, payments, status timeline, capability flags, notes); suspend/reactivate; toggle `long_distance_enabled`; impersonation read-only (phased).
- **AC:** server-side pagination/sort/filter; actions audited.

#### 9.4.5 Fleets
- **Components:** fleet accounts, trucks (with compliance state), drivers, consolidated earnings; suspend/reactivate fleet.
- **AC:** compliance oversight visible; non-compliant trucks flagged.

#### 9.4.6 Live Operations
- **Components:** live map (active bookings + driver positions), filter by zone/status, click marker → booking/driver detail; **dispatch inspector** — for any `SEARCHING` booking, see the live wave number, radius, candidates contacted, and declines (invaluable for tuning §6.7 parameters).
- **AC:** positions update in real time; selecting a booking opens management actions.

#### 9.4.7 Bookings
- **Components:** tables (active/completed/cancelled), filters (status, date, user, driver, zone, band), detail (items, parties, address, timeline, payment, commission breakdown), actions — view / cancel / reassign / handle dispute / **invoice PDF**.
- **AC:** manual status override available for edge cases; reassign re-runs dispatch or assigns directly; cancel triggers refund logic.

#### 9.4.8 Pricing & Geofencing
- **Components:** editable base-fare matrices (wheel-lift/flatbed slabs), vehicle multipliers, night charge, highway pickup, accident recovery, waiting rate, **surge bands**; **service-zone editor** (draw polygons on map; set surge band, highway flag, dispatch radius ladder, active state).
- **States:** editing · validating · saved (versioned).
- **AC:** changes versioned and effective immediately for new bookings; existing locked fares unaffected; zone polygons persisted as geography.

#### 9.4.9 Commission & Dispatch Controls
- **Components:** **commission band editor** — Band A/B/C percentages with live guardrail validation (floor 5% / cap 10%); band-to-service mapping view; impact preview ("at last week's volume, Band A 10%→9% ≈ −₹X revenue"); **dispatch parameter panel** (§6.7 — radius ladders, offer countdown, offers per wave, max search time, scoring weights); full change history.
- **AC:** guardrail enforced server-side (UI hints, API rejects); every change audited (admin id + before/after + timestamp); changes never touch in-flight bookings (locked at confirm).

#### 9.4.10 Payments & Payouts (Finance)
- **Components:** transactions table, wallet ledger viewer, **payout approval queue** (driver/fleet), refund issuance, reconciliation export (GMV vs commission vs payouts).
- **AC:** payouts require Finance/Super Admin; idempotent; ledger immutable; exports (CSV).

#### 9.4.11 Promotions
- **Components:** banner manager (image + CTA + schedule + active), **coupon manager** (percentage/flat, min order, usage limit, expiry).
- **AC:** banners drive customer-app carousel; coupon validation server-side.

#### 9.4.12 Support
- **Components:** ticket list (from customers/drivers/fleets), status workflow, assignment, notes.
- **AC:** tickets link to bookings/users; status transitions audited.

#### 9.4.13 Analytics
- **Components:** GMV / commission revenue / **effective take rate** / AOV charts (Recharts), peak-time & demand **heat maps**, revenue by commission band, driver activity, fill rate, time-to-match distribution, on-time rate, coupon redemption; date-range filter; export.
- **AC:** queries hit read replica at scale; exports available; no PII in aggregate exports.

---

## 10. Design System & UX Standards

### 10.1 Art Direction
**Concept:** fast, professional, reassuring — the polish of **Uber** (clarity, authority, map-craft) fused with the energy of **Rapido** (speed, warmth, big friendly CTAs, price-forward honesty), built for high-stress emergency moments where clarity wins. **Tone:** confident, urgent, trustworthy. **Mood:** fast, reliable, safe, on-its-way. System-wide **dark/light mode**; **WCAG 2.1 AA** target.

### 10.2 UX Principles (what "feels like Uber/Rapido" actually means)
1. **Map-first.** The customer home is the map, not a menu — supply is visible (nearby truck markers) before a single tap. Confidence is ambient.
2. **Bottom sheets over screens.** Booking, offers, and details slide over the map; the user never loses spatial context. Full-screen navigation is reserved for account/history.
3. **Three taps to help.** Saved-vehicle repeat booking = service → confirm pickup → confirm. Every added tap in an emergency is a defection risk.
4. **Thumb-zone first.** Primary CTAs live in the bottom 40% of the screen, 44pt+ targets, one-handed reach — users are standing on a roadside, phone in one hand.
5. **Always show motion.** Searching pulses, the truck marker glides (never teleports), ETAs count down. Stillness reads as "broken" — motion reads as "working on it."
6. **Radical money transparency.** Customers see full fare breakdowns before confirming; drivers see net earnings before accepting. No surprises is the retention strategy.
7. **States are designed, not defaulted.** Every screen ships loading (skeleton), empty, error, and offline states — no blank whites, no raw error strings.
8. **Honest status.** If the search is widening, say so. If the driver's GPS dropped, show "reconnecting," not a frozen marker. Trust survives bad moments only when the app narrates them.

### 10.3 Color Tokens
| Role | Name | Light | Dark | Usage |
|---|---|---|---|---|
| Primary | Signal Blue | `#2563EB` | `#3B82F6` | TowGo primary, CTAs, links, platform identity |
| Secondary | Recovery Orange | `#F97316` | `#FB923C` | TowPartner accent, high-visibility actions |
| Enterprise | Fleet Navy | `#1E3A8A` | `#2747B0` | TowFleet Web identity, enterprise surfaces |
| Base | Near Black | `#0E1116` | `#0E1116` | Dark backgrounds, headers |
| Surface 0 | Snow / Charcoal | `#FAFAFA` | `#15181F` | Page background |
| Surface 1 | Light Grey / Slate | `#F3F4F6` | `#1C212B` | Cards |
| Success | Fresh Green | `#22C55E` | `#34D399` | Online, completed, approved |
| Warning | Amber | `#F59E0B` | `#FBBF24` | Pending KYC, expiring docs |
| Error | Red | `#EF4444` | `#F87171` | Rejected, errors |
| **SOS** | Emergency Red | `#DC2626` | `#DC2626` | **Strictly SOS/critical safety** |
| Text 1 | Ink | `#111827` | `#F3F4F6` | Body |
| Text 2 | Stone | `#6B7280` | `#9CA3AF` | Captions, secondary |

**Per-interface accent:** TowGo → Signal Blue · TowPartner → Recovery Orange · TowFleet Web → Fleet Navy + Orange · Admin → Charcoal + Blue.

### 10.4 Typography
| Role | Font | Weight | Notes |
|---|---|---|---|
| Display/Hero | Clash Display (Fontshare) | 600–700 | App names, hero |
| Body/UI | General Sans (Fontshare) | 400–600 | All UI |
| Numbers/Fare | General Sans (tabular-nums) | 700 | Fares, earnings, timers, countdowns |
| Labels/Badges | General Sans | 600 uppercase | Status pills, tags |

**Type scale (mobile):** 32 / 24 / 20 / 17 / 15 / 13 / 11. **Line-height:** 1.3 headings, 1.5 body. Fares and net-earnings render at 24–32pt — money is the hero number on booking and offer screens (a signature Rapido move).

### 10.5 Spacing, Radius, Elevation
- Spacing scale: 4 · 8 · 12 · 16 · 20 · 24 · 32. Base unit 4px.
- Radius: 8 (inputs), 12 (cards), 16 (sheets), full (pills/avatars).
- Elevation: subtle shadows; dark mode uses surface tints over shadows.

### 10.6 Core Components (shared library across both apps)
Buttons (primary/secondary/destructive/ghost), inputs + OTP input, status pills, driver/trip cards, **job-offer sheet with countdown ring**, map + markers (truck, pickup, drop, radar pulse, radius ring), bottom sheets, modals, toasts, skeleton loaders, empty states, fare-breakdown row, **gross→commission→net earnings row**, rating stars, segmented controls, share sheet. Reuse cuts UI work ~30%; the web consoles get the equivalent kit in shadcn/ui.

### 10.7 Microinteractions & Haptics
| Moment | Animation | Haptic / Sound |
|---|---|---|
| Search started | Radar pulse + radius ring breathing | Light tick |
| Driver matched | Radar collapses into driver card (hero transition) | Success haptic |
| Job offer arrives (driver) | Full-screen sheet + countdown ring | Strong haptic + distinct sound (repeats until acted) |
| Driver arrived (customer) | OTP card slides up + highlights | Double haptic |
| OTP verified | Lock-open micro-animation | Light haptic |
| Payment success | Animated check + count-up of amount | Success haptic |
| SOS armed | Button micro-pulse (respects reduced-motion) | Warning haptic |
| Truck marker movement | 1s position interpolation + bearing rotation (§11.4) | — |

Motion: 150–250ms ease for UI, map marker interpolation for smoothness; all animation respects OS reduced-motion.

### 10.8 Perceived Performance
- **Skeletons everywhere** content loads (catalog, fare rows, tables) — never spinners on first paint.
- **Optimistic UI** where safe: going online, sending chat, rating — commit visually, reconcile in background, roll back with a toast on failure.
- **Cache-first rendering:** MMKV-cached catalog/last-trip render instantly on open, refresh silently — this is how "app-open → confirm < 45s" survives bad networks.
- **Prefetch:** fare matrix + zone config prefetched on home open; driver photo prefetched during search so the match transition is instant.

### 10.9 Standardized Feedback States
- **Errors:** human copy + one recovery action ("Couldn't fetch fare. Retry"). Never raw codes; error codes logged to Sentry with a support-reference id shown on repeated failure.
- **Empty:** friendly illustration + a next step ("No trips yet — help is one tap away.").
- **Offline:** persistent slim banner + cached content; actions that need network are disabled with explanation, never silently failing.

### 10.10 Iconography
A single consistent line/solid family (Lucide/Phosphor RN + web) — trucks, hooks, batteries, fuel, tyres drawn in the same stroke weight as system icons.

### 10.11 Accessibility
Min 4.5:1 contrast for text; 44×44pt min tap targets; full screen-reader labels (booking status announced on change); dynamic type support; never color-only state (icon + label); SOS reachable and labeled; countdowns also shown numerically.

### 10.12 Web Design (TowFleet Web + Towing Admin)
Tailwind CSS + shadcn/ui on both consoles from one shared package; dense data tables (TanStack Table) with server-side pagination; Recharts; live maps; responsive ≥ 1280px primary, graceful to tablet; same color tokens; dark mode. Fleet console leans Fleet Navy; Admin leans Charcoal + Blue.

---

## 11. Live Tracking System

Live tracking is the emotional core of the product — a stranded customer staring at the map *is* the product for 10–30 minutes. This section specifies it end-to-end to Uber/Rapido standard.

### 11.1 Experience Goals
- The truck marker **moves smoothly and truthfully** — no teleporting, no frozen markers without explanation.
- Position and ETA visible to customer, admin, and (for fleet trucks) the fleet console **within 2 seconds** of the driver's ping.
- Tracking survives bad networks gracefully: buffered pings, reconnect resync, honest "reconnecting" states.
- A customer can **share the live trip** with family via a link — no app install needed.

### 11.2 Pipeline Architecture
```
Driver phone GPS
  └─ TowPartner app: adaptive sampling + local buffer (MMKV)
       └─ Socket.io `location:update` {lat,lng,heading,speed,accuracy,ts,seq}
            └─ NestJS gateway (Fargate) ── validates + rate-limits
                 ├─ Redis: GEOADD zone set + driver hash (TTL 30s)   ← dispatch reads this (§6.1)
                 ├─ Redis pub/sub → all Fargate tasks → broadcast to:
                 │     booking:{id}   (customer app)
                 │     admin:ops      (admin live map)
                 │     fleet:{id}     (fleet console, own trucks only)
                 │     track:{shareToken}  (public share page)
                 └─ Sampled persist → booking_location_path (PostgreSQL, ~every 30s + key events)
```
Only samples and final positions are persisted — Redis absorbs the high-frequency stream so PostgreSQL stays lean.

### 11.3 Update Cadence & Battery Strategy
| Driver state | GPS sampling | Emit rate |
|---|---|---|
| On active job (en route / in progress) | High accuracy | Every 3s |
| Online, idle (waiting for offers) | Balanced accuracy | Every 10s |
| Offline | None | — |

- Cadence is server-configurable (pushed via config event) so battery/fidelity can be tuned without app releases.
- Pings include a **monotonic `seq`** so late/out-of-order packets are discarded server-side.
- Low-accuracy readings (> 50 m) are flagged; the map shows an accuracy halo instead of a confidently wrong position.

### 11.4 Map Rendering (customer side)
- **Interpolation:** the marker animates from previous → new point over ~1s with easing; heading rotates the truck icon to match bearing.
- **Route polyline:** driver→pickup (then pickup→drop) drawn from Directions API; the marker is **snapped to the polyline** when within GPS-error distance of it, eliminating "driving through buildings."
- **Camera:** auto-fits driver + pickup with padding; user pan pauses auto-follow, a "re-center" chip restores it.
- **ETA chip** counts down between recomputes so it never appears frozen.

### 11.5 ETA Engine
- Initial ETA from Directions API (traffic-aware) at assignment.
- **Recompute triggers:** every 60s · driver deviates > 200 m from polyline · driver stationary > 90s (traffic) · status transition.
- Smoothing: displayed ETA never jumps > ±40% in one update (blended) unless a route change explains it — prevents the "7 min → 21 min → 8 min" whiplash that destroys trust.
- Arrival detection: within 100 m of pickup + speed < 5 km/h → prompts driver "Mark arrived?"

### 11.6 Degraded-Network Behavior
- **Driver side:** pings buffer locally on signal loss and flush **in order** on reconnect; the active job screen keeps working from local state.
- **Customer side:** last ping age > 15s → marker dims to "ghost" + "reconnecting…" label; > 60s → banner "We're having trouble reaching your driver" + support shortcut. On reconnect, the app resyncs authoritative state via REST (never trusts possibly-missed socket events).
- **Server side:** stale drivers drop out of dispatch candidacy automatically (§6.1).

### 11.7 Share-Trip Link (safety feature, Uber-style)
- From the tracking screen: **Share trip** → generates `https://towing.app/t/{shareToken}` → share via WhatsApp/SMS.
- The public page (Next.js, no login) shows: live truck position, pickup area, ETA, driver first name + vehicle plate, trip status — **no phone numbers, no exact customer address**.
- Token: random 128-bit, scoped to the booking, expires when the trip completes (+30 min grace), revocable from the tracking screen.
- Fed by the same Redis pub/sub via a `track:{shareToken}` channel (read-only).

### 11.8 Background Location (driver app, OS-compliant)
- **Android:** foreground service with persistent notification ("You're online — Towing") per Play Store policy; survives screen-off; battery-optimization exemption requested with in-app education.
- **iOS:** background location mode active during jobs; significant-change monitoring while idle-online; clear App Store privacy strings.
- Location captured **only while online or on a job** — never when offline (privacy commitment, §20.4).

### 11.9 Nearby-Driver Preview (pre-booking)
The customer home map shows anonymized nearby truck markers (positions coarsened to ~100 m, no identity, refreshed ~10s) — the ambient "supply exists" signal Uber/Rapido open with. Server returns only count + coarse positions for the viewport; individual driver identity is never exposed pre-assignment.

### 11.10 Acceptance Criteria
- p95 ping→customer-render latency ≤ 2s on healthy networks.
- Marker never teleports across the screen for updates ≤ 10s apart (interpolated).
- Stale/reconnecting states appear at the thresholds above; resync after reconnect completes ≤ 3s.
- Share links carry no PII beyond first name + plate; expire and revoke correctly.
- Driver battery drain from tracking ≤ ~6–8%/hour on a typical device during an active job.

---

## 12. Notifications System

### 12.1 Channels
Push (FCM via Expo), SMS (MSG91, DLT templates), WhatsApp (Cloud API / BSP), Email (SES, transactional), In-app (notification center), Web (fleet/admin console toasts + badge counts).

### 12.2 Trigger Matrix
| Event | Recipient | Push | SMS | WhatsApp | Email |
|---|---|---|---|---|---|
| OTP (login / booking) | User/Driver | — | ✅ | ✅ (opt) | — |
| KYC approved ("You can start earning now") | Driver | ✅ | ✅ | ✅ | — |
| KYC rejected / request info | Driver | ✅ | ✅ | ✅ | — |
| New job offered (net earning shown) | Driver | ✅ (high-priority) | — | — | — |
| Booking confirmed | Customer | ✅ | ✅ | ✅ | — |
| Driver assigned / en route / arrived | Customer | ✅ | — | ✅ | — |
| Search widening / no drivers found | Customer | ✅ | — | — | — |
| Job started (OTP verified) | Customer | ✅ | — | — | — |
| Completed + invoice | Customer | ✅ | — | ✅ | ✅ (invoice) |
| Payment success / failure | Customer | ✅ | ✅ (fail) | — | ✅ (receipt) |
| Earnings credited (per trip: net amount) | Driver | ✅ | — | — | — |
| Weekly earnings summary | Driver | ✅ | — | ✅ | — |
| Compliance doc expiring (30d) | Fleet | ✅ (web) | — | ✅ | ✅ |
| Payout processed / failed | Driver/Fleet | ✅ | ✅ | — | ✅ |
| **SOS triggered** | Emergency contacts + Ops | ✅ (ops) | ✅ | ✅ | — |
| Dispute update | Customer/Driver | ✅ | — | ✅ | — |

### 12.3 Delivery Rules
- High-priority FCM for job offers and SOS (bypass notification batching; distinct channel + sound on Android).
- SMS/WhatsApp via DLT-registered templates (MSG91/Cloud API) — content stored as templates in admin.
- Notification fan-out via **SQS** to avoid blocking request paths; retries with backoff; dead-letter queue for failures.
- Per-user notification preferences (channel opt-outs where legally allowed; transactional/safety always on).

---

## 13. Safety & SOS

- **Trigger:** large SOS control in TowGo (2-tap arm to prevent accidents), available during any active booking (and standalone — configurable).
- **Actions on trigger:** (1) live location link to emergency contacts via SMS + WhatsApp; (2) real-time alert to Ops (admin live feed); (3) optional broadcast to nearest available drivers; (4) record `sos_alert` with location + booking ref.
- **Resilience:** if data network is poor, SMS fallback fires; SOS event queued and retried.
- **Ops handling:** acknowledge → contact customer/driver → resolve; full timeline logged.
- **Layered safety beyond SOS:** every driver KYC-verified with photo shown pre-arrival · OTP-gated job start (the right customer meets the right driver) · share-trip links (§11.7) · in-app masked chat/call · post-trip two-way ratings.
- **Privacy:** location sharing scoped to the SOS event; contacts pre-saved by the user.
- **AC:** SOS must fire on degraded networks; ops sees alerts within 2s on a healthy network; resolution audited.

---

## 14. Wallets, Payments, Commission & Payouts

### 14.1 Ledger Model
- **Append-only `wallet_transactions`** is the source of truth; `wallets.balance` is a derived/cached value reconciled against the ledger.
- Every entry: `wallet_id, type (credit/debit), amount, reason, ref_id (booking/payout/refund), created_at`.
- All money mutations carry an **idempotency key**.

### 14.2 Payment & Commission Flow (Razorpay)
1. Fare + commission band/% locked at confirm (§3.3).
2. On completion, capture via Razorpay (UPI/card/wallet); webhook confirms (signature-verified).
3. On success → booking `PAID` → **commission retained** (`total × locked %`) → **net credited to driver wallet ledger** (or split, §14.3) → invoice PDF generated (shows customer the fare; shows driver the gross→commission→net in-app).
4. On failure → retry (idempotent); booking remains `COMPLETED` (unpaid) until resolved; ops can intervene; driver credit occurs only on capture.

### 14.3 Commission & Split
- `PlatformEarning = Total × commission%` — the platform's **only** per-booking revenue (no fees to drivers beyond this).
- `DriverPool = Total − PlatformEarning`.
- Independent driver: full `DriverPool` credited.
- Fleet driver: `DriverPool` split `driver_share` / `fleet_share` (configurable per fleet, default 80/20) → two ledger credits in one transaction.
- Every credit stores the band + % applied, making driver-facing math and finance reconciliation trivially auditable.

### 14.4 Payouts (Razorpay Route)
- Driver/Fleet requests payout (min threshold + schedule) → `processing` via Route to linked bank → webhook → `paid`/`failed`.
- Admin Finance approves where required; all idempotent and ledgered.
- **Setup dependency:** Razorpay merchant account + Route onboarding (client business/legal task).

### 14.5 Refunds & Disputes
- Cancellation refunds and dispute resolutions issue ledger entries + Razorpay refunds; reasons recorded; visible in finance + user history.
- If a dispute reverses a paid booking, the commission and driver credit are reversed by **compensating ledger entries** (never edits) so history stays intact.

---

## 15. Technical Architecture (AWS)

Architected around three needs: **relational + spatial** (matching/pricing/money), **high-frequency ephemeral** (live location), **real-time push** (dispatch/status). Best AWS tool per job.

### 15.1 Mobile (2 apps)
| Layer | Choice | Why |
|---|---|---|
| Framework | React Native (Expo) | One codebase iOS+Android × 2 apps; OTA updates; strong India dev pool |
| Language | TypeScript | Type-safe gate/commission logic; end-to-end types |
| Navigation | React Navigation v7 | Standard |
| State | Zustand + TanStack Query | UI state + cached server state |
| Local storage | MMKV | ~10× faster than AsyncStorage; powers offline buffers |
| Maps | Google Maps (react-native-maps) | Best India coverage; Places, Directions, Distance Matrix |
| Realtime | Socket.io client | Dispatch, location, status, chat |
| Payments | Razorpay RN SDK | UPI/cards/wallets |
| Push | Expo Push → FCM | One abstraction, both stores |
| Media | expo-image-picker → S3 pre-signed | KYC docs, photos |

### 15.2 Web (2 consoles, one monorepo)
| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15 (App Router) | SSR + API proximity; one monorepo, two deployments (`admin.` / `fleet.`) |
| UI | Tailwind CSS + shadcn/ui (shared package) | Same kit powers both consoles — fleet console rides on admin components |
| Tables/Charts | TanStack Table · Recharts | Dense ops data |
| Realtime | Socket.io client | Live maps, KPI feeds, dispatch inspector |
| Hosting | AWS Amplify Hosting (SSR) | AWS-native CI/CD *(or ECS + CloudFront)* |

### 15.3 Backend
| Layer | Choice | Why |
|---|---|---|
| Runtime | Node.js + **NestJS** | Modular enterprise structure (auth/booking/pricing/commission/dispatch/tracking/payments/notifications modules) |
| API | REST + WebSocket (Socket.io) | CRUD + real-time |
| Compute | **Amazon ECS on Fargate** | Long-running containers for persistent WebSockets + auto-scaling; no servers to patch |
| LB | **Application Load Balancer** | WebSocket upgrade + sticky sessions for Socket.io |
| Registry | Amazon ECR | CI/CD image store |

> **Why not Lambda for the API:** persistent WebSocket connections for dispatch/tracking need long-lived processes; Lambda is request-scoped/timeboxed. (Lambda still used for isolated async via SQS triggers.) **Why not EKS now:** ECS Fargate is simpler ops at launch; EKS is the Phase-3 scale path.

### 15.4 Data Layer
**Amazon RDS for PostgreSQL (+ PostGIS)** — relational + spatial source of truth.
| Why | Detail |
|---|---|
| Nearest-driver | PostGIS KNN `<->` / `ST_DWithin` on `geography(Point)` + GIST index (authoritative path behind the Redis hot path, §6.1) |
| Atomic txns | Booking + fare/commission lock + assignment in one transaction |
| Integrity | FKs across users→bookings→payments→drivers→fleets |
| Analytics | SQL reports, read replicas at scale |
| Gates | Constraints/policies back the KYC gate |
ORM: **Drizzle** (TS-native, fast) or Prisma. Scale: **Aurora PostgreSQL** + read replicas.

**Amazon ElastiCache for Redis** — ephemeral + real-time state.
| Use | Detail |
|---|---|
| Socket.io adapter | Shared pub/sub across Fargate tasks |
| Live location | GEO sets + short-TTL driver hashes; broadcast to subscribers; only samples/final persisted to PostgreSQL (§11.2) |
| Dispatch locks | Per-driver offer locks, search state |
| Sessions/OTP | Refresh tokens, OTP counters, rate limits |
| Hot cache | Pricing + commission config, nearby-driver sets, surge state |

### 15.5 Supporting Services
| Concern | Service | Why |
|---|---|---|
| Files/docs | **S3** (SSE-KMS) + CloudFront | Encrypted KYC docs (private + pre-signed), public thumbnails via CDN |
| Auth | **Custom JWT** (NestJS) + OTP (MSG91) + Google/Apple | Embeds role + `kyc_status` claims; Apple mandatory iOS *(Cognito = alternative)* |
| Payments | **Razorpay + Route** | India coverage + split payouts; PCI handled |
| Maps | **Google Maps Platform** | India coverage *(Amazon Location = alt)* |
| Push/SMS/WhatsApp | FCM · MSG91 · WhatsApp Cloud API | Notifications |
| Email | **Amazon SES** | Invoices, alerts |
| Async/cron | **SQS** + **EventBridge Scheduler** | Fan-out, weekly earnings summaries, 30-day compliance alerts |
| Secrets | **Secrets Manager / SSM** | Keys/env injected to Fargate — none in code |
| Network | **VPC** (3-tier subnets), **AWS WAF**, **Route 53**, **ACM** | Public edge (IGW/ALB/NAT) → private compute (Fargate) → **isolated data tier** (RDS/Redis, no NAT route); WAF managed rules on the ALB; TLS via ACM |
| Private AWS access | **VPC Endpoints** (S3 gateway · SQS/Secrets Manager/ECR interface) | AWS-service traffic stays private and off the NAT Gateway — cheaper and no internet exposure |
| CI/CD | **GitHub Actions → ECR → ECS** | Build/push/rolling deploy |
| Observability | **CloudWatch** + Sentry (+ X-Ray opt.) | Logs/metrics/alarms; crash tracking |
| Web hosting | **AWS Amplify Hosting** (Next.js SSR ×2) | Admin + fleet consoles |

### 15.6 Architecture Diagram
```
┌────────────────────────────────────────────┐   ┌─────────────────────────────────────────┐
│   MOBILE · React Native (Expo) + TS        │   │   WEB · Next.js 15 monorepo             │
│   TowGo (Customer)   TowPartner (Driver)   │   │   TowFleet Web        Towing Admin      │
│   Zustand · TanStack Query · MMKV ·        │   │   (fleet.towing.app)  (admin.towing.app)│
│   Google Maps · Socket.io                  │   │   Tailwind · shadcn/ui · Socket.io      │
└───────────────┬────────────────────────────┘   └───────────────┬─────────────────────────┘
                │ REST + WebSocket                               │ REST + WebSocket
                ▼                                                ▼
        ┌───────────────┐                        ┌─────────────────────┐
        │  CloudFront    │                        │  AWS WAF ▸ App Load  │
        │  (assets/CDN)  │                        │  Balancer (WS+sticky)│
        └───────┬────────┘                        └──────────┬──────────┘
                │                             ┌──────────────▼──────────────┐
                │                             │  Amazon ECS (Fargate)        │
                │                             │  NestJS API + Socket.io      │
                │                             │  dispatch · tracking ·       │
                │                             │  pricing+commission · money  │
                │                             └──┬────────┬────────┬────────┘
                │                    ┌───────────▼──┐ ┌───▼─────┐ ┌▼────────┐
                │                    │ RDS Postgres │ │ Elasti  │ │  S3 +   │
                │                    │ + PostGIS    │ │ Cache   │ │  KMS    │
                │                    │ Users·Book-  │ │ (Redis) │ │ (docs)  │
                │                    │ ings·Money·  │ │ Geo·Locks│└─────────┘
                │                    │ Fleets·Zones·│ │ Pub/Sub │ ┌──────────────┐
                │                    │ Commission   │ │ Sessions│ │ SQS +        │
                │                    └──────────────┘ └─────────┘ │ EventBridge  │
                │                                                 │ (jobs/cron)  │
                ▼                                                 └──────────────┘
   Public share-trip pages (towing.app/t/{token})

  External:  Google Maps · Razorpay + Route · MSG91 ·
             WhatsApp Cloud API · FCM (Expo Push) · SES
```

---

## 16. API Specification (REST + WebSocket)

Base: `https://api.towing.app/v1`. Auth: `Authorization: Bearer <JWT>`. All list endpoints paginate (`?page&limit&sort&filter`). Standard error envelope: `{ error: { code, message, details } }`. All mutating money/booking endpoints accept an `Idempotency-Key` header.

### 16.1 Auth
| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/otp/send` | Send OTP (body: phone, role) |
| POST | `/auth/otp/verify` | Verify OTP → JWT + refresh token |
| POST | `/auth/social` | Google/Apple sign-in |
| POST | `/auth/refresh` | Rotate tokens |
| POST | `/auth/logout` | Invalidate session |

### 16.2 Customer (TowGo)
| Method | Path | Purpose |
|---|---|---|
| GET/PUT | `/me` | Profile |
| GET/POST/DELETE | `/me/vehicles` | Saved vehicles |
| GET/POST/DELETE | `/me/addresses` | Saved addresses |
| GET/POST/DELETE | `/me/emergency-contacts` | Contacts |
| GET | `/services` | Service catalog |
| GET | `/drivers/nearby` | Anonymized nearby-truck markers for home map (§11.9) |
| POST | `/pricing/estimate` | Fare estimate (service, vehicle_class, pickup, drop) — returns breakdown + band |
| POST | `/bookings` | Create booking (locks fare + commission, starts dispatch) |
| GET | `/bookings/:id` | Booking detail (incl. search progress while `SEARCHING`) |
| GET | `/bookings` | History |
| POST | `/bookings/:id/cancel` | Cancel (policy applies; free during search) |
| GET | `/bookings/:id/otp` | Booking OTP |
| POST | `/bookings/:id/share` | Create share-trip link · DELETE revokes (§11.7) |
| GET | `/bookings/:id/invoice` | Invoice PDF |
| POST | `/bookings/:id/rate` | Rate driver |
| POST | `/payments/:bookingId/capture` | Capture payment |
| POST | `/sos` | Trigger SOS |
| GET | `/wallet` · `/wallet/transactions` | Wallet & ledger |
| POST | `/coupons/validate` | Validate coupon |

**Public (no auth):** `GET /track/:shareToken` — read-only trip state for the share page.

### 16.3 Driver (TowPartner)
| Method | Path | Purpose |
|---|---|---|
| POST | `/driver/kyc/documents` | Upload doc (pre-signed S3) |
| GET | `/driver/kyc/status` | KYC status |
| PUT | `/driver/capabilities` | Truck class + `long_distance_enabled` opt-in |
| GET | `/driver/commission-rates` | Current band percentages (transparency screen) |
| POST | `/driver/online` · `/driver/offline` | Toggle (KYC-gated) |
| POST | `/driver/location` | Location ping fallback (primary path is WS) |
| POST | `/jobs/:id/accept` · `/reject` | Offer response (idempotent; server-authoritative timeout) |
| POST | `/jobs/:id/arrived` · `/start` · `/complete` | Status |
| POST | `/jobs/:id/unable` | Unable-to-deliver (reason) |
| GET | `/driver/earnings` · `/driver/earnings/weekly` | Earnings (per-trip gross→commission→net) |
| POST | `/driver/payouts` | Request payout |

### 16.4 Fleet (TowFleet Web)
| Method | Path | Purpose |
|---|---|---|
| POST | `/fleet/auth/login` | Console login (email+password+OTP) |
| GET/POST/PUT | `/fleet/trucks` | Trucks CRUD (+ bulk CSV import) |
| POST | `/fleet/trucks/:id/compliance` | Upload compliance doc |
| GET/POST | `/fleet/drivers` | Manage/invite drivers |
| POST | `/fleet/drivers/:id/assign-truck` | Assign truck |
| GET | `/fleet/dashboard` | Live fleet summary |
| GET | `/fleet/jobs` | Jobs feed/history (+ CSV export) |
| GET | `/fleet/earnings` · `/fleet/earnings/split` | Earnings + split |
| POST | `/fleet/payouts` | Request payout |
| GET | `/fleet/reports` | Per truck/driver/period reports |

### 16.5 Admin (web)
| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/dashboard` | KPIs |
| GET | `/admin/drivers/pending` | KYC queue |
| POST | `/admin/drivers/:id/approve|reject|request-info|suspend|reactivate` | KYC actions |
| PUT | `/admin/drivers/:id/capabilities` | Toggle long-distance flag |
| GET | `/admin/users` · `/admin/drivers` · `/admin/fleets` | Management |
| GET | `/admin/ops/live` | Live ops feed |
| GET | `/admin/ops/dispatch/:bookingId` | Dispatch inspector (waves, candidates, declines) |
| GET | `/admin/bookings` | Bookings |
| POST | `/admin/bookings/:id/cancel|reassign|dispute` | Booking actions |
| GET/PUT | `/admin/pricing` · `/admin/zones` | Pricing & geofencing |
| GET/PUT | `/admin/commission` | Commission bands (guardrail-validated, audited) |
| GET/PUT | `/admin/dispatch-config` | Radius ladders, timeouts, weights (§6.7) |
| GET | `/admin/finance/transactions` · `/admin/finance/payouts` | Finance |
| POST | `/admin/finance/payouts/:id/approve` | Approve payout |
| GET/POST | `/admin/promos` · `/admin/coupons` | Promotions |
| GET | `/admin/analytics` | Analytics (GMV, take rate, band revenue) |

### 16.6 WebSocket Events (Socket.io)
**Channels:** `booking:{id}`, `driver:{id}`, `admin:ops`, `fleet:{id}`, `track:{shareToken}` (read-only). Scoped server-side to prevent cross-user leakage.
| Event | Direction | Payload |
|---|---|---|
| `job:offer` | server→driver | booking summary + gross/commission/net + expires_at |
| `job:accept` / `job:reject` | driver→server | booking id (idempotent) |
| `booking:status` | server→customer/admin/fleet | status, ts |
| `search:progress` | server→customer | wave, radius, drivers_contacted |
| `location:update` | driver→server→subscribers | lat, lng, heading, speed, accuracy, ts, seq |
| `eta:update` | server→customer/share | eta seconds |
| `chat:message` | bi-directional | booking id, text |
| `sos:alert` | server→admin | user, location, booking |
| `ops:metrics` | server→admin | live KPI deltas |
| `config:update` | server→driver | ping cadence, dispatch params (§11.3) |

---

## 17. Database Schema (Full)

PostgreSQL + PostGIS. `geography(Point/Polygon,4326)` columns are GIST-indexed. UUID PKs, `created_at/updated_at` on all tables.

```sql
-- CUSTOMERS
users (id, mobile UNIQUE, name, email, photo_url,
       default_lat, default_lng, status, created_at, updated_at)
saved_vehicles (id, user_id FK, type, make_model, plate, rc_url, is_default)
addresses (id, user_id FK, label, full_address, lat, lng, is_default)
emergency_contacts (id, user_id FK, name, phone, relation)

-- DRIVERS
drivers (id, mobile UNIQUE, name, email, photo_url,
         fleet_id FK NULL,
         kyc_status,            -- pending|approved|rejected|incomplete|suspended
         is_online BOOL, vehicle_class,   -- wheel_lift|flatbed
         long_distance_enabled BOOL DEFAULT false,   -- Band C opt-in (§3.2)
         current_location geography(Point,4326),  -- GIST
         last_ping_at,
         rating NUMERIC(2,1), total_trips INT,
         acceptance_rate NUMERIC, completion_rate NUMERIC,
         level,                 -- bronze|silver|gold|platinum
         approved_by FK, approved_at, rejection_reason, created_at, updated_at)
INDEX idx_drivers_geo USING GIST(current_location);
INDEX idx_drivers_status ON drivers(kyc_status, is_online);
driver_documents (id, driver_id FK, doc_type,  -- license|rc|gov_id|inspection|selfie
                  file_url, status, verified_by, verified_at, created_at)

-- FLEETS
fleets (id, owner_id FK, business_name, gstin, address, status, created_at)
fleet_trucks (id, fleet_id FK, type, plate, capacity,
              current_location geography(Point,4326), status)  -- active|inactive|non_compliant
compliance_documents (id, truck_id FK, doc_type, -- insurance|rc|puc|permit
                      file_url, issued_at, expires_at, alert_sent_30d BOOL, status)
fleet_driver_shares (id, fleet_id FK, driver_id FK, driver_share NUMERIC, fleet_share NUMERIC)

-- GEOFENCING & DISPATCH CONFIG
service_zones (id, name, area geography(Polygon,4326), surge_band,
               is_highway BOOL, is_active BOOL,
               dispatch_config JSONB)   -- radius ladder, cap, offer timeout overrides (§6.7)
INDEX idx_zones_geo USING GIST(area);

-- BOOKINGS (state machine)
bookings (id, user_id FK, driver_id FK NULL, fleet_id FK NULL, zone_id FK NULL,
          service_type, vehicle_class,
          pickup_lat, pickup_lng, pickup_address,
          drop_lat, drop_lng, drop_address, distance_km,
          status,               -- searching|assigned|en_route|arrived|in_progress|
                                -- completed|paid|cancelled|no_drivers_found|disputed
          base_fare, distance_charge, night_charge, highway_charge,
          accident_charge, waiting_charge, surge_amount, discount,
          total,
          commission_band,      -- A|B|C  (locked at confirm, §3.3)
          commission_pct, commission_amount, driver_payout,
          booking_otp, otp_verified BOOL, otp_expires_at,
          share_token NULL, share_expires_at NULL,      -- share-trip link (§11.7)
          cancelled_by, cancellation_reason, cancellation_fee,
          unable_reason, payment_id FK NULL, payment_method,
          created_at, updated_at)
INDEX idx_bookings_status ON bookings(status);
INDEX idx_bookings_user ON bookings(user_id);
INDEX idx_bookings_driver ON bookings(driver_id);
booking_status_history (id, booking_id FK, status, actor, note, created_at)
booking_location_path (id, booking_id FK, lat, lng, recorded_at)  -- persisted samples (§11.2)
dispatch_attempts (id, booking_id FK, wave INT, radius_km, driver_id FK,
                   outcome,     -- offered|accepted|rejected|expired|revoked
                   offered_at, responded_at)   -- powers the dispatch inspector (§9.4.6)

-- PRICING (admin-editable)
pricing_rules (id, vehicle_class, distance_min, distance_max, base_price, is_active)
charge_config (id, key, value, is_percentage, updated_by, updated_at)
                                -- night, highway_min, highway_max, accident, waiting_per_min, surge_band_*

-- COMMISSION (replaces subscription tables)
commission_config (id, band,            -- A|B|C
                   label, service_types JSONB, distance_min_km, distance_max_km,
                   commission_pct NUMERIC,       -- launch: A 10 · B 8 · C 5
                   floor_pct NUMERIC DEFAULT 5, cap_pct NUMERIC DEFAULT 10,
                   is_active BOOL, updated_by FK, updated_at)
commission_config_history (id, config_id FK, old_pct, new_pct, changed_by FK, changed_at)

-- MONEY (ledger-first)
wallets (id, owner_id, owner_type, balance NUMERIC)   -- user|driver|fleet
wallet_transactions (id, wallet_id FK, type, amount, reason, ref_id, idempotency_key, created_at)
payments (id, booking_id FK, gateway_ref, amount, method, status, idempotency_key, created_at)
payouts (id, owner_id, owner_type, amount, route_ref, status, idempotency_key,
         requested_at, paid_at)
refunds (id, booking_id FK, amount, reason, gateway_ref, status, created_at)

-- SAFETY & FEEDBACK
sos_alerts (id, user_id FK, booking_id FK NULL, lat, lng, status, acknowledged_by, created_at)
ratings (id, booking_id FK, driver_id FK, rating INT CHECK(1..5), review, created_at)

-- PROMOTIONS, SUPPORT, ADMIN
banners (id, image_url, cta_link, starts_at, ends_at, is_active, sort_order)
coupons (id, code UNIQUE, type, value, min_order, max_uses, used_count, expires_at, is_active)
support_tickets (id, raised_by, role, booking_id FK NULL, subject, body, status, assigned_to, created_at)
admin_users (id, name, email UNIQUE, role, password_hash, twofa_secret, created_at)
                                -- super_admin|operations|support|finance
admin_actions (id, admin_id FK, target_type, target_id, action_type, notes, created_at)
notifications (id, recipient_id, role, channel, title, body, read BOOL, created_at)
otp_verifications (id, phone, purpose, code_hash, attempts, expires_at, used BOOL, created_at)
```

---

## 18. Real-Time Architecture

- **Transport:** Socket.io over the ALB (WebSocket upgrade + sticky sessions); **Redis adapter** lets all Fargate tasks broadcast consistently.
- **Location pipeline:** full specification in §11.2 — Redis-first, sampled persistence, channel fan-out to customer/admin/fleet/share subscribers.
- **Dispatch:** server pushes `job:offer` to `driver:{id}` with a server-authoritative timeout; driver responds; on accept, assignment is an atomic DB txn then `booking:status` broadcast; per-driver offer locks live in Redis (§6.3).
- **Backpressure & reconnect:** clients auto-reconnect with exponential backoff + jitter; missed events reconciled via REST refetch on reconnect (client never assumes socket completeness); offers expire server-side regardless of client state.
- **Connection health:** heartbeat ping/pong every 25s; dead connections reaped; driver liveness for dispatch is decided by *location ping freshness*, not merely socket connectivity; ALB idle timeout raised above the heartbeat interval so quiet-but-alive sockets are never dropped by the load balancer.
- **Latency target:** status & location propagate within 2s end-to-end on a healthy network (measured, see §19.1).

---

## 19. Reliability Engineering

What separates an Uber/Rapido-grade platform from a demo is behavior under stress: traffic spikes, flaky vendor APIs, dead zones, double-taps. This section makes those behaviors explicit build targets.

### 19.1 Service-Level Objectives (SLOs)
| Metric | Target | Measured by |
|---|---|---|
| API availability (core booking paths) | 99.9% during operating hours | ALB + synthetic checks |
| API latency | p95 < 200ms, p99 < 500ms | CloudWatch/X-Ray |
| Real-time propagation (status/location) | ≤ 2s p95 | Instrumented event timestamps |
| Time-to-match | p50 < 30s, p90 < 90s (covered zones) | Dispatch metrics |
| Payment success rate | > 97% (gateway-adjusted) | Razorpay webhooks vs attempts |
| Crash-free sessions (both apps) | ≥ 99.5% | Sentry |
| OTP delivery | < 10s (Indian numbers) | MSG91 delivery receipts |
| Payout SLA | Requested → processed < 24h (working days) | Ledger timestamps |

SLOs are dashboarded from day one; alarms fire when error budgets burn abnormally fast.

### 19.2 Graceful-Degradation Ladder
When a dependency fails, features shed in a designed order — never a blank screen:
| Failure | Behavior |
|---|---|
| Google Maps/Directions degraded | Straight-line ETA fallback + cached last route polyline; booking continues |
| Razorpay down | Bookings complete as `COMPLETED (unpaid)`; capture retries in background; customer messaged honestly |
| MSG91 down | OTP falls back to WhatsApp channel (and vice-versa); voice-OTP fallback (phased) |
| Redis degraded | Dispatch falls back to direct PostGIS queries (slower but correct); location broadcast queues |
| WebSocket unavailable | Apps poll REST for state every 10s (built-in fallback mode) |
| One Fargate AZ lost | ALB routes to healthy tasks; Multi-AZ RDS fails over automatically |

### 19.3 Timeouts, Retries & Circuit Breakers (external dependencies)
- Every outbound call (Razorpay, Maps, MSG91, WhatsApp, FCM) has an explicit **timeout** (2–5s), **bounded retries with exponential backoff + jitter**, and a **circuit breaker** that opens after repeated failures — protecting booking latency from a slow vendor.
- Vendor webhooks are **signature-verified, idempotent, and replayable**; a missed webhook is reconciled by scheduled polling (e.g., payment status sweep every 5 min).

### 19.4 Idempotency & Exactly-Once Money
- All mutating booking/money endpoints require an `Idempotency-Key`; server stores request-hash + response so retries (user double-tap, network replay, queue redelivery) return the original result.
- Assignment, capture, credit, split, payout, refund: each is a single DB transaction with unique constraints as the final backstop (e.g., one payment row per booking per key).

### 19.5 Asynchronous Decoupling
- Notification fan-out, invoice generation, analytics events, and webhook processing run through **SQS** (with DLQs + alarm on DLQ depth) so the booking hot path never blocks on a slow side effect.
- EventBridge Scheduler drives compliance expiry alerts, weekly earnings summaries, and reconciliation sweeps.

### 19.6 Autoscaling & Capacity
- Fargate scales on CPU **and** active-WebSocket-connection count; scale-out is aggressive (surge demand is spiky — rain = instant peak), scale-in conservative (protect live connections; connection draining on deploy/scale-in).
- Redis and RDS sized with 3× expected peak headroom at launch; RDS Multi-AZ in production; connection pooling (PgBouncer/RDS Proxy) to survive task churn.

### 19.7 Load & Chaos Validation (pre-launch gates)
- k6/Artillery scenarios: 500 concurrent active bookings · 2,000 drivers pinging at 3s cadence · surge burst (10× booking creation for 5 min) · WebSocket reconnect storm (mass network flap).
- Pass = SLOs hold and no message loss (location samples + status history complete).
- Game-day drills: kill a Fargate task mid-dispatch, fail over RDS, block Razorpay egress — verify the degradation ladder (§19.2) behaves as designed.

### 19.8 Feature Flags & Kill Switches
- Server-driven config (Redis-backed, admin-editable): per-zone dispatch parameters, surge, ping cadence, and **kill switches** — pause new bookings per zone, disable long-distance offers, force REST-polling mode — all without a deploy or store release.
- Mobile releases ride Expo OTA for JS fixes; a minimum-supported-version gate can force-upgrade broken clients.

### 19.9 Incident Management
| Severity | Example | Response |
|---|---|---|
| SEV-1 | Booking creation or dispatch down | Page on-call immediately; status banner in apps; 15-min update cadence |
| SEV-2 | Payments degraded, tracking lag > 10s | On-call within 30 min; degradation ladder active |
| SEV-3 | Non-core feature broken (coupons, reports) | Next business day |
- Runbooks per failure class (vendor outage, DB failover, WS storm, queue backlog) written during build, rehearsed in game days; every SEV-1/2 gets a blameless post-mortem with action items.

### 19.10 App-Quality Gates (mobile)
- Crash-free ≥ 99.5%, ANR < 0.5%, cold start < 3s on mid-range Android; CI blocks release on regression.
- Sentry release health tracked per version; staged rollouts (10% → 50% → 100%) on Play Store; phased release on App Store.

---

## 20. Security, Privacy & Compliance

### 20.1 Data Protection
- **Encryption at rest:** S3 SSE-KMS (AES-256) for all documents/PII; RDS & ElastiCache encryption at rest; KMS-managed keys.
- **Encryption in transit:** TLS 1.2+ everywhere (ACM certs on ALB/CloudFront/Amplify).
- **Sensitive documents (Government ID, licence, RC, insurance):** private S3 buckets; access only via short-lived **pre-signed URLs**; never public; masked in UI where possible.

### 20.2 AuthN / AuthZ
- Custom JWT with role + `kyc_status` claims; **short-lived access tokens + rotating refresh tokens**; refresh tokens stored in Redis and revocable.
- RBAC middleware on every protected endpoint; admin sub-roles enforced server-side (§4.2); fleet console scoped strictly to the fleet's own trucks/drivers/jobs.
- The KYC supply-side gate enforced at all three layers (§3.1).
- Share-trip tokens: unguessable, booking-scoped, auto-expiring, revocable (§11.7).

### 20.3 Application Security
- Input validation/sanitization (class-validator/zod) on every endpoint; parameterized queries (ORM) — no raw string SQL.
- Rate limiting (OTP, login, booking creation, location pings) via Redis; lockouts on abuse.
- Idempotency keys on all money operations; commission guardrail validation server-side.
- Secrets only in Secrets Manager/SSM; no secrets in code or images.
- Dependency scanning + image scanning (ECR) in CI.
- Webhook signature verification (Razorpay).

### 20.4 Privacy & Indian Compliance
- **DPDP Act 2023** alignment: collect only necessary PII; explicit consent at onboarding; clear privacy policy & terms; data-retention policy; user rights (access/correction/deletion within policy).
- **Location privacy:** driver location captured only while online/on-job (§11.8); customer location only around bookings; nearby-driver previews anonymized and coarsened (§11.9); share pages expose no phone numbers or exact addresses.
- **DLT compliance** for SMS (MSG91 registered templates); WhatsApp template approval (Cloud API/BSP).
- **PCI scope** minimized — payment handled by Razorpay hosted/native checkout; no raw card data stored.
- **Document retention:** KYC/compliance docs retained per legal requirement; deletion on account closure per policy.
- **Audit:** `admin_actions` + `commission_config_history` log all sensitive operations (who/what/when, before/after).

### 20.5 Operational Security
- Three-tier network: public edge (IGW/ALB/NAT) → private compute (Fargate) → **isolated data subnets with no NAT route** (RDS Proxy/PostgreSQL, Redis) — even a compromised app container has no direct internet exfiltration path from the data tier; per-tier least-privilege security groups (app, database, and cache scoped separately); no public DB/Redis.
- **AWS WAF** on the ALB (managed rules: SQLi/XSS/bot control + rate-based rules) as the first defense line ahead of app-layer rate limiting; Razorpay webhook paths allow-listed so callbacks are never blocked.
- **VPC endpoints** (S3 gateway; SQS/Secrets Manager/ECR interface) keep AWS-service traffic off the public internet; VPC Flow Logs enabled.
- CloudWatch alarms on anomalies; centralized logs; Sentry for error tracking (PII-scrubbed).
- Backups: RDS automated backups + PITR; S3 versioning; periodic restore drills.

---

## 21. Offline & Resilience (client-side)

- **Driver offline-accept queue:** if connectivity drops momentarily, "Accept" and status actions are queued locally (MMKV) and synced via WebSocket/REST on reconnect; server-side offer timeouts still apply (a stale accept is rejected gracefully with a clear message — never a ghost job).
- **Customer app:** cached service catalog + last booking render offline; booking creation requires connectivity (clear offline banner).
- **Location buffering:** driver location pings buffer locally on signal loss and flush in order on reconnect (§11.6).
- **Idempotent retries:** all mutating calls are safe to retry (idempotency keys) so flaky networks don't double-book or double-charge.
- **Graceful degradation:** map falls back to last-known position with a "reconnecting" indicator; SOS uses SMS fallback; WebSocket loss flips apps to REST polling (§19.2).

---

## 22. Analytics & KPIs

### 22.1 Event Tracking (GA4 / Amazon Pinpoint)
Key events: `app_open`, `signup_start/complete`, `kyc_submit/approved`, `driver_first_online`, `service_selected`, `estimate_viewed`, `booking_confirmed`, `search_wave_advanced`, `driver_assigned`, `job_started`, `booking_completed`, `payment_success/failure`, `booking_cancelled`, `no_drivers_found`, `sos_triggered`, `trip_shared`, `payout_requested`.

### 22.2 Operational Dashboards (Admin)
- **Marketplace:** fill rate, time-to-match distribution (per wave), time-to-arrival, active drivers vs demand, offer acceptance rate, cancellation rate.
- **Revenue:** GMV, AOV, **commission revenue by band (A/B/C)**, **effective take rate**, revenue per active driver, coupon redemption.
- **Reliability:** on-time arrival %, payment success %, SOS response time, payout SLA, real-time latency, crash-free rate (§19.1 SLO board).
- **Geographic:** demand heat maps by zone/time; surge effectiveness; wave-depth heat map (where searches go wide = supply gaps).
- **Driver:** activity, acceptance/completion rates, ratings distribution, level distribution, earnings distribution.

### 22.3 Reporting
Date-range filtering; CSV export (no PII in aggregate exports); read-replica-backed queries at scale.

---

## 23. Non-Functional Requirements

- **Gate enforcement at 3 layers** — the KYC gate in app UI, API middleware (JWT claims + DB check), and database (constraint/policy).
- **Commission integrity** — band + % locked at confirm; guardrail-validated edits; audited history; driver-visible math always reconciles with the ledger.
- **Real-time** — status & location update within **2 seconds** end-to-end (healthy network).
- **Time-to-book** — app-open → "Confirm Booking" under **45 seconds** (warm app); time-to-match p50 < 30s.
- **Performance** — app cold start < 3s; API p95 < **200ms**; map first paint < 2s.
- **Uptime** — 99.9% during operating hours; RDS Multi-AZ in production (full SLO table §19.1).
- **Security** — AES-256 at rest (S3 SSE-KMS, RDS); PCI via Razorpay; JWT refresh rotation; input sanitization; least-privilege RBAC.
- **OTP delivery** — < 10s (Indian numbers).
- **Offline** — driver accept-queue + location buffering; idempotent retries.
- **Safety** — SOS fires on degraded networks (SMS fallback); share-trip links.
- **Accessibility** — WCAG 2.1 AA; dark/light mode.
- **Scalability** — new cities/zones/vehicle-classes/commission-bands without core refactor.
- **Observability** — centralized logs, metrics, alarms, crash tracking, SLO dashboards.
- **Maintainability** — modular NestJS, typed end-to-end, shared mobile component library, shared web UI package, IaC.

---

## 24. Scalability Architecture

### 24.1 Phase 1 — MVP (Single City)
ECS Fargate (1–2 tasks), single RDS PostgreSQL + PostGIS, ElastiCache Redis, manual KYC, distance + night + simple surge, manual long-distance quoting, SQS for notifications, full SLO instrumentation from day one.

### 24.2 Phase 2 — Multi-City
Geofenced per-zone surge + per-zone dispatch ladders; auto-scaling Fargate (CPU/connection-based policies); RDS read replicas for analytics; SQS at volume with DLQ; **auto-KYC via Amazon Textract** (+ optional Rekognition selfie match); surge tuning from live demand; CDN-cached catalog.

### 24.3 Phase 3 — Enterprise
Service split (auth, booking, dispatch, tracking, pricing/commission, notification, payout) on **Amazon EKS**; **Aurora PostgreSQL** + read replicas; event streaming via **Amazon MSK (Kafka)** or EventBridge; multi-region/DR; B2B/insurance portals, garage marketplace, AI chatbot, full loyalty/reward engine, TowFleet mobile app.

---

## 25. DevOps, Environments & CI/CD

### 25.1 Environments
| Env | Purpose | Notes |
|---|---|---|
| `dev` | Active development | Smaller RDS/Redis; seeded data |
| `staging` | Pre-prod QA + client UAT | Mirrors prod topology; test payment keys |
| `production` | Live | Multi-AZ RDS; auto-scaling; alarms; backups |

### 25.2 Infrastructure as Code
All AWS resources defined as code (**Terraform** or AWS CDK): VPC, subnets, ECS/Fargate services, ALB, RDS, ElastiCache, S3, IAM roles, SQS, EventBridge, CloudWatch alarms, Secrets. Repeatable, reviewable, environment-parametrized.

### 25.3 CI/CD Pipeline (GitHub Actions)
1. **Lint + type-check + unit tests** on PR.
2. **Build** backend Docker image → push to **ECR**; build web monorepo (Amplify: admin + fleet) and mobile (EAS ×2) artifacts.
3. **Deploy to staging** on merge to `main` (ECS rolling update with WS connection draining; DB migrations via Drizzle/Prisma migrate).
4. **Smoke/integration tests** on staging.
5. **Manual approval → production** (rolling or blue/green via CodeDeploy).
6. **Mobile:** EAS build → TestFlight / Play Internal → staged store rollout (2 apps); OTA (Expo Updates) for JS-only fixes.

### 25.4 Secrets & Config
Per-environment values in Secrets Manager/SSM; injected into Fargate task definitions and Amplify; never committed. Runtime feature flags/kill switches live in Redis-backed config (§19.8), editable from admin.

### 25.5 Observability & Ops
CloudWatch dashboards (latency, error rate, queue depth, DB connections, WS connections, dispatch metrics); alarms → email/SMS/Slack; Sentry for backend + mobile crashes; structured JSON logs; X-Ray tracing (optional); SLO dashboards (§19.1).

### 25.6 Backups & DR
RDS automated backups + PITR; S3 versioning; documented restore runbook + periodic drills; production Multi-AZ.

---

## 26. Testing & QA Strategy

| Layer | Approach |
|---|---|
| Unit | Jest — pricing engine, **commission band resolution + guardrails**, split math, gate logic, state transitions |
| Integration | API + DB (test containers / staging) — booking lifecycle, payments, payouts, dispatch waves |
| Real-time | Socket.io event flows — offer/accept, wave progression, location broadcast, reconnect/resync, share-channel scoping |
| E2E (mobile) | Detox / Maestro — onboarding, booking, KYC, job flow, earnings |
| E2E (web) | Playwright — admin verification queue, commission editor, finance flows; **fleet console: trucks, compliance, payouts** |
| Load | k6 / Artillery — §19.7 scenarios (concurrent bookings, ping throughput, surge burst, reconnect storm) |
| Security | Dependency + image scanning; auth/RBAC tests; webhook signature tests; share-token scope tests |
| UAT | Client sign-off on staging per module |
| Device matrix | Common Android (low/mid/high) + iOS (last 3 versions); both stores' review readiness |

**Critical test scenarios:** KYC gate enforcement (unverified driver blocked at UI/API/DB), atomic assignment (no double-book under concurrent accepts), fare + commission lock at confirm (admin edits don't leak into in-flight bookings), **band resolution correctness (39.9 km vs 40.1 km vs 100.1 km; accident always ≥ Band B)**, guardrail rejection (11% edit refused + audited), cancellation tiers, fleet split correctness, OTP-gated job start, progressive-radius ladder (empty-wave fast-advance, decliner exclusion, re-dispatch resume wave), stale-ping candidate exclusion, SOS on degraded network, payout idempotency, offline accept-queue resync, share-link expiry/revocation.

---

## 27. Development Phases & Timeline

Phases overlap (driver app begins while customer app finishes). High build velocity via the Claude Code workflow. Dropping the third mobile app and subscription billing shortens the critical path versus v2.

| Phase | Deliverables | Window |
|---|---|---|
| 1 — Foundation | AWS IaC (VPC, ECS, RDS+PostGIS, Redis, S3, SQS, CI/CD), DB schema, auth + OTP, driver KYC, admin verification module, design system (4 interfaces) | Weeks 1–4 |
| 2 — Engine | Dispatch/matching with progressive-radius waves, pricing + **commission engine**, WebSocket real-time + live-tracking pipeline, wallet ledger | Weeks 3–7 |
| 3 — TowGo | Customer app: onboarding, booking, finding-driver UX, live tracking + share-trip, payments, SOS, trips, account | Weeks 5–9 |
| 4 — TowPartner | Driver app: KYC + capabilities, job workflow with net-earnings offers, navigation, earnings/wallet/payouts | Weeks 7–11 |
| 5 — Towing Admin | Web: dashboard, verification, live ops + dispatch inspector, pricing/geofencing, commission controls, finance, promotions, support, analytics | Weeks 9–13 |
| 6 — TowFleet Web | Fleet console: trucks + compliance, drivers, live fleet map, jobs, earnings/split/payouts, reports | Weeks 11–14 |
| 7 — Integration & Hardening | End-to-end real-time, payments/payouts wiring, notifications, load/chaos gates (§19.7), cross-interface QA | Weeks 13–16 |
| 8 — Polish & Launch | Performance, accessibility, security hardening, App Store + Play Store submission (2 apps), web go-lives, production setup | Weeks 15–18 |

**Total:** ~**15–18 weeks** (≈ 3.5–4.5 months) for the full four-interface ecosystem.

---

## 28. Cost Estimation

### 28.1 Development Cost (indicative, for discussion)
| Component | Covers | Estimated (INR) |
|---|---|---|
| UI/UX Design (4 interfaces) | Uber/Rapido-grade design system across 2 apps + 2 web consoles | ₹45,000 |
| Foundation — AWS Backend, Dispatch & Real-Time Engine | Infra, APIs, progressive-radius matching, pricing, commission engine, payments, live-tracking pipeline, ledger | ₹1,80,000 |
| TowGo (Customer App) | Booking, finding-driver UX, live tracking + share-trip, payments, SOS, ratings | ₹85,000 |
| TowPartner (Driver App) | KYC, dispatch, navigation, transparent earnings, payouts | ₹85,000 |
| TowFleet Web Console | Fleet/driver/truck management, compliance, live map, payouts, reports | ₹70,000 |
| Towing Admin (Web Dashboard) | Verification, live ops + dispatch inspector, pricing/commission controls, finance, analytics | ₹1,10,000 |
| QA, Builds & Deployment | Testing across both platforms + web; load/chaos gates; store & web go-live | ₹35,000 |
| **Indicative Total** | | **₹6,10,000** |

> Indicative and adjustable by trimming/staging scope (§29). The fleet line reflects the move to web (shares the admin component library — less effort than a third native app). A formal quotation with payment milestones follows once scope is locked.

### 28.2 Monthly AWS Infrastructure (low–moderate volume)
| Service | Monthly (INR) |
|---|---|
| ECS Fargate (right-sized) | ₹3,500 – ₹8,000 |
| RDS PostgreSQL + PostGIS | ₹5,000 – ₹12,000 |
| ElastiCache Redis | ₹2,500 – ₹5,000 |
| S3 + CloudFront | ₹500 – ₹3,000 |
| Application Load Balancer | ₹1,800 – ₹2,500 |
| NAT / data transfer | ₹2,500 – ₹6,000 |
| SES / SQS / EventBridge / CloudWatch | ₹1,000 – ₹3,000 |
| Amplify Hosting (admin + fleet consoles) | ₹1,500 – ₹5,000 |
| **AWS Subtotal** | **₹18,300 – ₹44,500 / month** |

**Volume note:** at higher scale, add RDS Multi-AZ + read replicas, more Fargate tasks, and larger Redis — budget grows roughly linearly with active drivers/bookings.

### 28.3 Third-Party (client-paid, usage-based)
Google Maps Platform · Razorpay transaction & payout fees · MSG91 SMS · WhatsApp Cloud API · Apple Developer ($99/yr) + Google Play ($25 one-time) · KYC/OCR per-check (when auto-KYC added).

### 28.4 Unit-Economics Sanity Check (commission model)
At launch defaults: an average local booking of ₹2,000 earns the platform ₹200 (10%); 1,000 completed bookings/month ≈ ₹2,00,000 commission revenue against ₹18–45k AWS + usage-based vendor costs — the model clears infrastructure early and scales with volume, not driver headcount.

---

## 29. Future Roadmap (Full Detail)

Documented in full so each can be switched on later without rework. Each is a paid module.

### 29.1 Auto-KYC (OCR)
Amazon Textract extracts fields from licence/RC/Government ID; optional Rekognition selfie↔ID face match; rules auto-approve clean cases, route edge cases to manual review. Reduces verification turnaround. *Per-check cost applies.*

### 29.2 Advanced Surge & Geofencing
Weather/traffic/holiday-aware surge bands; toll auto-calculation along route; demand prediction; per-zone dynamic multipliers tuned from historical data.

### 29.3 Driver Reward Automation
Activate Bronze→Platinum effects: per-driver commission reductions (never below the guardrail floor), dispatch priority weighting, bonus payouts, faster payout tiers, VIP support routing. (Schema + metrics already present; slots directly into the commission engine.)

### 29.4 Cash Payments + Commission-Debt Ledger
Accept cash on completion (a large share of Indian roadside payments): driver collects the full fare; the platform's commission accrues as a wallet debit; drivers settle from digital earnings or top-ups; auto-suspend offers past a configurable debt cap. The ledger-first wallet design (§14.1) already supports negative balances — this is a policy + UX module, not a re-architecture.

### 29.5 AI Chatbot & Support
Assistant to help book, estimate fares, answer FAQs, guide emergencies, and triage tickets; escalation to human support; WhatsApp + in-app.

### 29.6 Marketplace
Nearby garages/mechanics discovery and booking; service-center listings; take-rate model; ratings.

### 29.7 Corporate & Insurance Portals
B2B job routing, SLAs, bulk dispatch, contract billing, insurer claim integration, dealership partnerships.

### 29.8 Loyalty, Referrals & Coupons (full)
Customer loyalty points/tiers, referral rewards (two-sided), advanced coupon engine, flash sales.

### 29.9 Multi-Language
Hindi + regional languages across all apps; RTL-ready architecture; admin-managed strings.

### 29.10 TowFleet Mobile App
A React Native companion to the fleet web console for on-the-go monitoring (alerts, live map, approvals) — the console remains the primary workspace.

### 29.11 Long-Distance Auto-Quoting
Automated quotes for 600 km+ flatbed hauling (route + toll + time modeling) replacing manual quotes.

---

## 30. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Cold-start supply (too few drivers) | Low fill rate, poor CX | Launch one city; seed/onboard drivers first; **₹0-upfront commission model removes the join barrier**; progressive-radius search stretches thin supply |
| Thin revenue at low volume (no subscription floor) | Slower early cash flow | Lean single-city infra (₹18–45k/mo); commission bands tunable within guardrail; cancellation fees; volume-first growth focus (§28.4) |
| Payout/legal setup delays (Razorpay Route) | Drivers can't be paid | Start merchant + Route onboarding in week 1; manual payout fallback if needed |
| KYC fraud / fake documents | Safety, trust | Manual review at launch; OCR + face match (Phase 2); suspension tooling |
| WebSocket scaling under surge | Dropped real-time updates | Redis adapter + Fargate auto-scaling; load/chaos gates (§19.7); reconnect/resync; REST-polling fallback |
| Drivers gaming acceptance (cherry-picking) | Slow matches | Net-earnings-upfront offers reduce blind rejects; acceptance rate in scoring; level incentives (phased) |
| Surge mispricing | Lost trips or driver churn | Start simple; tune from real data before advanced engine |
| Map/API cost spikes | Margin pressure | Cache distance/zone results; snap-to-route client-side; monitor usage; usage alarms |
| App Store review friction (iOS) | Launch slip | Apple sign-in + privacy disclosures + background-location strings ready; submit early |
| PII/data compliance (DPDP) | Legal exposure | Encryption, consent, retention policy, audit logging from day one |
| Single-region outage | Downtime | Multi-AZ at prod; documented DR; backups + drills |

---

## 31. Key Decisions to Confirm

| Topic | Why It Matters |
|---|---|
| **Commission defaults** | Confirm Band A 10% · Band B 8% · Band C 5%, and the 5%/10% guardrail (all admin-editable thereafter) |
| Driver & fleet payouts | Razorpay merchant + Route is a client business/legal setup gating payouts |
| KYC & Government ID handling | Encrypted + privacy-compliant; manual review at launch, OCR later (per-check cost) |
| iOS requirements | Apple Developer account; Apple sign-in mandatory; background-location review adds days |
| Launch region | One city first → expand (keeps pricing/surge/supply manageable) |
| Dispatch defaults | Confirm radius ladder (2/4/7/10/15 km), 20s offer countdown, ~3 min max search (all tunable later) |
| Surge model | Distance + night + basic surge first; advanced later |
| Fleet on web confirmed | Fleet owners get a desktop console (shares admin codebase); companion mobile app is a roadmap item |
| Cancellation fee amounts | Confirm partial fee default (₹150) and driver compensation shares |
| Fleet revenue split default | Confirm default driver/fleet share (e.g. 80/20) |

---

## Appendix A — Brand Voice & Microcopy

Towing speaks with calm confidence and urgency — the voice you want when stranded.

| Tone | Description | Example |
|---|---|---|
| Reassuring | Calm, in-control, especially in emergencies | "Help is on the way. Your driver is 6 minutes out." |
| Fast | Urgency in every message | "Tap once. We'll handle the rest." |
| Trustworthy | Around safety & verification | "Every driver is verified. Share your OTP only when they arrive." |
| Clear | No jargon, transparent on money | "Your fare: ₹1,499. No hidden charges." |

**Sample strings.** Empty trips: "No trips yet — help is one tap away." Searching: "Contacting the nearest tow driver…" Widening: "Expanding your search…" No drivers: "No drivers free right now. Try again in a few minutes." Driver cancel: "Your driver had to cancel — finding you a new one. You won't be charged." Pending KYC (driver): "You're almost set — we're reviewing your documents." KYC approved (driver): "You're verified! Go online and start earning — no fees, ever." Job offer (driver): "New job · 2.1 km away · You earn ₹1,349." SOS sent: "Help notified. Stay safe — your location is shared." Payment success: "Paid ₹1,499. Invoice saved to your trips."

---

## Appendix B — Service Catalog

| Service | Description | Typical Vehicle Class | Commission Band |
|---|---|---|---|
| Car tow | Standard car towing | Wheel-lift / Flatbed | A (≤40 km) / B (40–100 km) |
| Bike tow | Two-wheeler recovery | Wheel-lift | A |
| Flatbed tow | Luxury/SUV/EV/accident, damage-free | Flatbed | A / B / C by distance |
| Wheel-lift tow | Quick city recovery | Wheel-lift | A |
| Battery jumpstart | On-site jumpstart | Roadside | A |
| Flat-tyre support | Tyre change/repair | Roadside | A |
| Fuel delivery | Emergency fuel | Roadside | A |
| Breakdown assistance | General on-site help | Roadside | A |
| Accident recovery | Post-accident recovery (+₹1,500) | Flatbed | B minimum |

---

## Appendix C — Glossary

- **KYC** — Know-Your-Customer document verification for drivers.
- **Dispatch / Matching** — selecting and offering a booking to the best eligible driver.
- **Progressive-radius (wave) search** — the expanding-circle driver search: start tight, widen in steps to a cap (§6.4).
- **Commission band** — the service/distance tier (A/B/C) that decides the platform's percentage on a booking (§3.3).
- **Take rate** — platform commission revenue ÷ GMV.
- **Geofence / Service zone** — polygon defining where the platform operates and how pricing/surge/dispatch applies.
- **Surge** — demand/weather/time-based fare multiplier.
- **Route (Razorpay)** — Razorpay's split-payout product for paying drivers/fleets.
- **Share-trip link** — public, expiring, read-only live-tracking page for a booking (§11.7).
- **RBAC** — role-based access control.
- **Ledger** — append-only record of money movements; balances derived from it.
- **OTA** — over-the-air JS updates (Expo) without a store release.
- **PostGIS** — PostgreSQL spatial extension for geo queries.
- **SLO** — service-level objective; a measured reliability target (§19.1).
- **DLT** — Distributed Ledger Technology registration required for Indian SMS.
- **DPDP Act** — India's Digital Personal Data Protection Act, 2023.

---

## Appendix D — Fastest Build Approach

1. **Backend & dispatch engine first** — progressive-radius matching, pricing/commission, and the KYC gate must be stable before consumer features.
2. **Expo (React Native)** — one codebase for both apps + OTA updates during iteration.
3. **One web monorepo, two consoles** — the fleet console rides on the admin component library; the second web app costs a fraction of a third native app.
4. **Razorpay + Route** — India payments + payouts integrate in days; start merchant onboarding immediately.
5. **AWS as code from week 1** — VPC, ECS, RDS, Redis, secrets, CI/CD so every later phase deploys cleanly (and env-var/secrets pain is solved from day one).
6. **Shared component library** across TowGo / TowPartner to cut UI ~30%.
7. **Ship admin verification in Phase 1** — without verified drivers, nothing runs; with commission-only onboarding, an approved driver is a *productive* driver the same day.

---

## Appendix E — Assumptions & Dependencies

**Assumptions:** single-city launch; manual KYC and manual long-distance quoting at launch; digital payments only at launch (cash module phased, §29.4); Indian market (INR, UPI, MSG91, DLT, DPDP); React Native (not Flutter) per existing workflow; fleet + admin on web (fleet mobile app phased).
**Client dependencies (business/legal):** Razorpay merchant account + Route onboarding; Apple Developer account; Google Play account; DLT SMS sender/template registration; WhatsApp Business (Cloud API/BSP) approval; privacy policy & terms content; brand assets/logos; initial pricing/zone/commission confirmation.
**Technical dependencies:** Google Maps API keys; AWS account + billing; domain (Route 53); ACM certificates.

---

*Prepared by Mohammad Ehsan · Webcros — Design · Develop · Deliver · webcros.in*

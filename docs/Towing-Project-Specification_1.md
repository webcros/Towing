# Towing — Project Specification Document (Detailed)

**Project Name:** Towing
**Document Version:** 2.0 (Detailed / Comprehensive)
**Reference Apps:** Uber, Bolt, Lyft
**Document Type:** Full-Stack On-Demand Roadside Assistance & Towing Ecosystem Specification
**Prepared By:** Talagana Rajesh · Webcros (Design · Develop · Deliver)
**Build Approach:** 3 React Native apps (TowGo, TowPartner, TowFleet) + 1 web admin (Towing Admin) + shared AWS backend
**Date:** June 2026

---

## 0. Document Control

### 0.1 How to Read This Document
This is the single source of truth for building the Towing ecosystem. It moves from **why** (business) → **what** (rules, roles, flows) → **how it looks** (screens, design) → **how it's built** (architecture, APIs, schema, security) → **how it ships** (DevOps, QA, timeline, cost) → **what's next** (roadmap). Non-technical stakeholders can read §1–§9; engineers live in §6–§24.

### 0.2 Revision History
| Version | Date | Author | Notes |
|---|---|---|---|
| 1.0 | Jun 2026 | T. Rajesh | Initial four-interface spec (AWS backend) |
| 2.0 | Jun 2026 | T. Rajesh | Detailed/comprehensive expansion — full screen specs, API, schema, security, DevOps, QA, full roadmap |

### 0.3 Scope of This Build
**In scope:** four interfaces fully (TowGo, TowPartner, TowFleet, Towing Admin web), shared AWS backend, dispatch & matching engine, dynamic pricing, subscriptions + commission, wallets & split payouts, KYC (manual review), live tracking, SOS, ratings, invoices, basic coupons, geofenced service zones, basic surge.
**Phased (documented in §27):** auto-KYC OCR, advanced ML surge, full reward automation, AI chatbot, marketplace, corporate/insurance portals, full loyalty/referrals, multi-language, web fleet console, long-distance auto-quoting.

### 0.4 Glossary
See **Appendix C** for full terms (KYC, dispatch, geofence, surge, Route, RLS, etc.).

---

## 1. Executive Summary

Towing is an enterprise-grade, on-demand roadside assistance and towing platform for India — tagline *"Fast · Reliable · Emergency Roadside Assistance."* It connects stranded vehicle owners with nearby tow operators in real time, runs on a weekly driver-subscription plus per-booking commission revenue model, and scales from local recovery to long-distance highway hauling and enterprise fleet partnerships.

The platform is a **four-part ecosystem**, all connected through one shared backend and real-time dispatch engine:

| Interface | Who Uses It | Platform | Purpose |
|---|---|---|---|
| **TowGo** | Customers | React Native (iOS + Android) | Book towing & roadside help, live-track the driver, pay, trigger emergency SOS |
| **TowPartner** | Tow Drivers | React Native (iOS + Android) | Pass KYC, manage weekly subscription, accept & run jobs, navigate, track earnings |
| **TowFleet** | Fleet Owners | React Native (iOS + Android) | Manage multiple trucks & drivers, compliance, enterprise contracts, fleet payouts |
| **Towing Admin** | Platform Ops | Web (Next.js) | Verify drivers, monitor live operations, control pricing & subscriptions, analytics |

Beneath the screens, the genuinely hard pieces are: geospatial nearest-driver matching, a multi-factor dynamic pricing engine, real-time dispatch over WebSockets, driver/fleet wallets and split payouts, document/KYC verification, and SOS safety. The system is built **AWS-native** for security, auto-scaling under demand surges, and long-term portability.

The defining product constraint is the **supply-side gate**: a driver cannot receive a single job until (a) admin has approved their KYC and (b) they hold an active subscription whose tier covers the job. This gate is enforced at the app, API, and database layers and is threaded through the entire system.

---

## 2. Project Overview

### 2.1 Vision & Business Goals
- Launch an on-demand towing & roadside marketplace, starting in one city and expanding zone-by-zone.
- Generate **recurring weekly subscription revenue** from drivers, layered with a **per-booking platform commission** (covers gateway + platform cost on every transaction, independent of plan).
- Support the full service range — local sub-40 km recovery through highway, intercity, and long-distance flatbed hauling.
- Enable **enterprise fleet partnerships** via a dedicated fleet app with multi-truck management and compliance tracking.
- Deliver an Uber-grade consumer experience: **app-open to "Confirm Booking" in under 45 seconds**.
- Give operators full control through a web admin: verification, live ops, pricing/surge, subscriptions, finance, analytics.
- Build a scalable AWS foundation that grows to multiple cities, dispatch zones, and microservices without core refactors.
- Long-term: become India's complete vehicle-emergency ecosystem (recovery, garages, insurance, corporate).

### 2.2 Target Users & Personas

| Segment | Description | Key Needs |
|---|---|---|
| Stranded Vehicle Owners | Drivers needing emergency tow / roadside help | Fast help, transparent fare, live tracking, safety (SOS, OTP start) |
| Independent Tow Drivers | Single-truck owner-operators | Steady jobs, fair commission, fast payouts, simple navigation, earnings clarity |
| Fleet Owners | Businesses running multiple trucks & drivers | Multi-truck/driver management, compliance alerts, enterprise jobs, consolidated payouts |
| Platform Ops Team | Operators running the marketplace | Verification, live visibility, pricing/surge control, dispute handling, analytics |
| Insurance / Corporate (later) | B2B partners routing recovery jobs | Bulk dispatch, SLAs, billing — phased (§27) |

**Persona — Ramesh (Customer, 34, Bengaluru).** Car won't start on a busy road at night. Opens TowGo, taps "Breakdown," confirms pickup via GPS in seconds, sees a transparent fare and a driver 6 minutes away, tracks them live, hands over the OTP, pays by UPI, rates the driver. *Needs: speed, trust, no haggling.*

**Persona — Suresh (Driver, 41, owner of one wheel-lift truck).** Wants consistent local jobs. Onboards in TowPartner, uploads documents, gets approved in a day, buys the Starter plan, toggles online, accepts jobs within 40 km, navigates, completes with OTP, watches earnings, requests a weekly payout. *Needs: job flow, fair cut, predictable payouts.*

**Persona — Lakshmi (Fleet Owner, runs 8 trucks & 12 drivers).** Manages a recovery business. Onboards trucks in TowFleet, tracks compliance (insurance expiry alerts), assigns drivers, watches utilization on a live map, and receives consolidated payouts with driver splits handled automatically. *Needs: oversight, compliance, consolidated money.*

**Persona — Anita (Ops Admin).** Reviews the KYC queue each morning, approves/rejects drivers, watches the live ops map during peak hours, tweaks surge for a rainy evening, resolves a disputed cancellation, exports the weekly revenue report. *Needs: a fast, clear web console.*

### 2.3 Platform Composition
- **TowGo** — React Native, iOS + Android — browse, book, track, pay, SOS.
- **TowPartner** — React Native, iOS + Android — KYC, subscription, job workflow, earnings.
- **TowFleet** — React Native, iOS + Android — fleet/truck/driver management, compliance, payouts.
- **Towing Admin** — Next.js web — verification, live ops, pricing/subscriptions, finance, analytics.
- **Shared Backend** — AWS Node.js (NestJS) API + Socket.io dispatch engine — the foundation all four sit on.

### 2.4 Revenue Model
1. **Driver subscriptions (primary):** weekly recurring — Free Trial (7d), Starter ₹999, Pro ₹1,999, Fleet Business ₹4,999.
2. **Platform commission (per booking):** plan-driven % of gross fare on every completed booking (25% trial / 14% paid) — covers gateway + platform overhead regardless of plan.
3. **Cancellation fees:** retained per policy (§3.3) and used to compensate drivers / cover cost.
4. **Future B2B (phased):** corporate/insurance contracts, garage marketplace take-rate, premium placements.

### 2.5 Success Metrics (KPIs)
- **Acquisition:** customer installs, driver signups, KYC approval rate.
- **Activation:** % drivers who go online within 48h of approval; % customers who complete a first booking.
- **Marketplace health:** fill rate (jobs matched / requested), time-to-match, time-to-arrival, cancellation rate.
- **Revenue:** weekly active subscriptions, MRR-equivalent (weekly × 4.33), GMV, AOV, commission revenue.
- **Reliability:** on-time arrival rate, SOS response time, payment success rate, payout SLA.
- **Retention:** driver weekly subscription renewal rate, customer repeat-booking rate.

---

## 3. Core Business Rules & Enforcement

### 3.1 The Two Supply-Side Gates

**Gate 1 — KYC: a driver cannot go online until verified.**
All driver documents (driving licence, RC, Government ID, vehicle inspection photos, selfie) must be uploaded and **admin-approved** before the driver can toggle "Online" or receive any job.

Enforced at three layers:
- **App UI** — the online toggle is disabled with a verification-status banner; subscription/job screens show locked states.
- **API middleware** — every protected request passes through a guard that reads `kyc_status` from the JWT (and re-checks the DB on sensitive actions). Pseudocode:
  ```
  if (route.requires('driver_online') &&
      (user.kyc_status !== 'approved' || !subscription.isActive(user))) {
        return 403 FORBIDDEN { reason: 'kyc_or_subscription' }
  }
  ```
- **Database** — assignment writes are guarded so a booking cannot reference a driver whose `kyc_status != 'approved'` (constraint/policy + transactional check).

**Gate 2 — Subscription: no active plan ⇒ no jobs; tier limits eligibility.**
Job eligibility is computed server-side from `driver_subscription.status` + `plan.tier` + the booking's distance & service class. The matching engine never surfaces an ineligible job.

| Plan | Distance Eligibility | Service Eligibility |
|---|---|---|
| Free Trial | < 40 km | Local services only |
| Starter | < 40 km | Local tow, breakdown, battery, fuel, flat-tyre |
| Pro | Unlimited | + Highway, intercity, accident recovery, premium/priority |
| Fleet Business | Unlimited | + Enterprise & long-distance, multi-truck |

### 3.2 Money-Integrity Rules
- **Atomic booking + fare lock + assignment** in a single DB transaction (no double-assignment, no orphan bookings).
- **Commission on every completed booking**, plan-driven, admin-configurable.
- **Driver–fleet split at payout layer** for fleet-affiliated drivers (configurable share).
- **No raw card data stored** — Razorpay hosted/native checkout handles PCI scope.
- **Idempotent payment capture & payout** — every money operation carries an idempotency key to prevent duplicates on retry.
- **Ledger-first wallets** — balances are derived from an append-only transaction ledger, never mutated directly (§13).

### 3.3 Cancellation Policy (with worked examples)

| Window after booking confirmed | Customer Charge | Driver Compensation |
|---|---|---|
| 0–2 minutes | Free | None |
| 2–10 minutes | Partial fee (default ₹150) | Configurable share of fee |
| > 10 minutes **or** driver en route / at pickup | Full base fare | Configurable share of base fare |

- *Example A:* Customer books, cancels at 1m30s → ₹0.
- *Example B:* Customer books wheel-lift 0–5 km (base ₹999), cancels at 6m before driver moves → ₹150 partial fee.
- *Example C:* Customer books flatbed, driver is en route, customer cancels at 12m → full base fare (e.g. ₹1,999) charged; driver compensated.
- **Driver cancellations** and **"unable to deliver"** (customer unavailable / wrong address / refused) are logged separately, count against acceptance/completion rate, and never charge the customer.

### 3.4 Subscription Plans & Commission (full)

| Plan | Weekly Price | Commission | Distance | Services / Benefits |
|---|---|---|---|---|
| **Free Trial** | ₹0 (7 days) | 25% | < 40 km | Local only; one trial per driver |
| **Starter** | ₹999 | 14% | < 40 km | Local tow, breakdown, battery, fuel, flat-tyre |
| **Pro** | ₹1,999 | 14% | Unlimited | + Highway, intercity, accident recovery; priority/premium jobs, faster payouts, VIP support |
| **Fleet Business** | ₹4,999 | 14% | Unlimited | + Multi-truck & multi-driver, corporate contracts, enterprise & long-distance, fleet dashboard & analytics |

- Renewal is **weekly auto-renew via Razorpay**; on failure → grace handling then `expired` (jobs stop).
- All prices & commission % are **admin-editable** (launch defaults shown).
- Plan changes take effect at next renewal (upgrade can be immediate, pro-rated — admin-configurable).

### 3.5 Driver Reward & Level Engine

Levels computed from rolling 30-day completed rides, average rating, acceptance rate, and customer feedback.

| Level | Example Threshold (configurable) | Rewards |
|---|---|---|
| Bronze | Default / new | Standard commission, standard job priority |
| Silver | 50+ rides, ≥4.5★, ≥80% acceptance | Minor priority boost |
| Gold | 150+ rides, ≥4.7★, ≥85% acceptance | Priority bookings, small bonus incentives |
| Platinum | 400+ rides, ≥4.8★, ≥90% acceptance | Lowest commission, top priority, VIP support, faster payouts |

> **This build:** the **level badge is displayed** and thresholds are tracked; **full reward automation** (commission reduction, priority weighting in dispatch, bonus payouts) is a phased item (§27). Schema and metrics are included now so it can be switched on later without migration.

### 3.6 Account & Verification Status States

| Entity | Status | Meaning | Can Operate? |
|---|---|---|---|
| Customer | `active` / `suspended` | Standard / blocked | ✅ / ❌ |
| Driver KYC | `pending` | Submitted, awaiting review | ❌ |
| Driver KYC | `approved` | Verified | ✅ |
| Driver KYC | `rejected` | Denied, reason given, can re-submit | ❌ |
| Driver KYC | `incomplete` | Missing documents | ❌ |
| Driver KYC | `suspended` | Previously approved, now blocked | ❌ |
| Subscription | `trial` / `active` | Valid | ✅ (within tier) |
| Subscription | `grace` | Renewal failed, short grace window | ⚠️ limited |
| Subscription | `expired` | Lapsed | ❌ |
| Fleet | `active` / `suspended` | Account state | ✅ / ❌ |
| Truck | `active` / `inactive` / `non_compliant` | Operational state (compliance docs valid?) | ✅ / ❌ |

### 3.7 Business Rule Edge Cases
- **Driver goes offline mid-search:** removed from candidate set; if already offered, offer expires and re-assigns.
- **No eligible driver in radius:** radius expands in steps; after max radius/retries → `no_drivers_found`, customer prompted to retry/widen.
- **Subscription expires mid-job:** in-progress job completes normally; no new jobs offered until renewed.
- **Compliance doc expires mid-day (fleet truck):** truck flips to `non_compliant`, removed from dispatch; fleet alerted.
- **Surge changes between estimate and confirm:** fare is **locked at confirm**; estimate clearly states "fare may change with demand until you confirm."
- **Customer with unpaid prior balance:** blocked from new bookings until cleared (admin-configurable).
- **Duplicate booking spam:** rate-limited per customer; one active booking per customer at a time (configurable).

---

## 4. User Roles & Permissions

### 4.1 Top-Level Roles
| Role | Interface | Summary |
|---|---|---|
| Customer | TowGo | Book, track, pay, SOS, rate |
| Driver | TowPartner | KYC, subscribe, run jobs, earn |
| Fleet Owner | TowFleet | Manage fleet, compliance, payouts |
| Admin | Towing Admin (web) | Operate the platform |

### 4.2 Admin Sub-Roles & Permission Matrix
| Capability | Super Admin | Operations | Support | Finance |
|---|---|---|---|---|
| Approve/Reject KYC | ✅ | ✅ | ❌ | ❌ |
| Suspend/Reactivate users | ✅ | ✅ | ⚠️ (request) | ❌ |
| Edit pricing & surge | ✅ | ✅ | ❌ | ❌ |
| Edit subscription plans / commission | ✅ | ⚠️ (propose) | ❌ | ✅ |
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
| created | confirm | SEARCHING | fare locked, dispatch starts, booking OTP generated |
| SEARCHING | driver accepts | ASSIGNED | driver/customer notified; ETA computed |
| SEARCHING | timeout/no drivers | NO_DRIVERS_FOUND | customer prompted to retry/widen |
| ASSIGNED | driver moves | EN_ROUTE | live location stream begins |
| EN_ROUTE | driver arrives | ARRIVED | "driver arrived" push |
| ARRIVED | OTP verified | IN_PROGRESS | job timer starts |
| IN_PROGRESS | driver completes | COMPLETED | fare finalized, waiting charges added |
| COMPLETED | payment captured | PAID | commission split, invoice generated, rating prompt |
| any active | cancel | CANCELLED | cancellation fee per policy; driver compensated |
| IN_PROGRESS | failure | DISPUTED | ops review |

### 5.2 Driver Job State Machine
`offered → accepted → arriving → arrived → otp_verified(started) → completed` (with `rejected`, `expired`, `cancelled`, `unable_to_deliver` branches). Each transition emits a WebSocket event to the customer + admin and updates `booking_status_history`.

### 5.3 KYC Verification Lifecycle
`incomplete → pending(submitted) → [admin] → approved | rejected(reason) | request_info → (re-submit) → pending`. Approval triggers Push + SMS + WhatsApp. Suspension reachable from `approved` at any time by admin.

### 5.4 Subscription Lifecycle
`none → trial(7d) → active(weekly auto-renew) → [renewal] → active | grace | expired`. Upgrade/downgrade requests queue for next cycle (upgrade may be immediate, pro-rated). Expiry stops new job offers.

### 5.5 Payment & Payout Lifecycle
`fare_locked → payment_pending → captured | failed(retry) → settled`. Payout: `earning_credited(wallet) → payout_requested → processing(Route) → paid | failed`. All steps idempotent and ledgered.

### 5.6 SOS Lifecycle
`triggered → contacts_notified + location_broadcast + ops_alerted → acknowledged(ops) → resolved`. SOS works during any active booking and (configurable) standalone.

### 5.7 Compliance (Fleet Truck) Lifecycle
`active → (doc within 30d of expiry) alert_sent → (expired) non_compliant → (renewed & re-uploaded) active`. Non-compliant trucks are excluded from dispatch automatically.

---

## 6. Dispatch & Matching Engine

The heart of the marketplace. Runs on every `SEARCHING` booking.

### 6.1 Candidate Selection
1. **Spatial query (PostGIS):** find online drivers within initial radius `R0` (e.g. 3 km) of pickup, ordered by distance using a `geography(Point)` column + GIST index and `ST_DWithin` / KNN (`<->`).
2. **Eligibility filters (server-side):**
   - `kyc_status = 'approved'`
   - subscription `active`/`trial` **and** tier covers booking distance + service class
   - `vehicle_class` matches request (wheel-lift / flatbed)
   - not currently on another active job
   - inside an active service zone (geofence) if zone restrictions apply
3. **Scoring (configurable weights):** proximity (primary) + driver rating + acceptance rate + level (priority boost, phased). Best score is offered first.

### 6.2 Offer / Accept / Reassign
- Offer sent to top candidate with a **countdown timer** (e.g. 20s).
- On **reject** or **timeout**, offer passes to the next candidate.
- If candidate pool exhausts, **radius expands** `R0 → R1 → R2` (e.g. 3 → 6 → 10 km) and re-queries.
- After max radius + max attempts → `NO_DRIVERS_FOUND`.

### 6.3 Pseudocode
```
function dispatch(booking):
  for radius in [3, 6, 10] km:
    candidates = postgis_nearest(booking.pickup, radius)
                   .filter(eligible(booking))
                   .sort_by(score)
    for driver in candidates:
      offer = sendOffer(driver, booking, timeout=20s)
      if offer.accepted:
        assign(booking, driver)   # atomic txn
        return ASSIGNED
  return NO_DRIVERS_FOUND
```

### 6.4 Geofencing
- **Service zones** are polygons (`geography(Polygon)`) defining where the platform operates and how pricing/surge applies (city limits vs highway service areas).
- A booking's pickup is point-in-polygon tested to pick the zone, its surge band, and any highway charge.
- Drivers can be restricted to zones; zones can be toggled active/inactive from admin.

---

## 7. Pricing Engine

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

DriverPayout   = Total × (1 − commission%)
PlatformEarning = Total × commission%
FleetSplit     = DriverPayout × fleet_share   (fleet-affiliated drivers only)
```

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

### 7.3 Long-Distance Flatbed (Pro / Fleet only)
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

### 7.5 Worked Examples
- **Wheel-lift, 8 km, daytime, Starter driver:** base ₹1,499 → total ₹1,499. Platform 14% = ₹209.86; driver ₹1,289.14.
- **Flatbed, 15 km, night, Pro driver:** base ₹4,499 + 15% night (₹674.85) = ₹5,173.85. Platform 14% = ₹724.34; driver ₹4,449.51.
- **Wheel-lift, accident recovery, 25 km, daytime, surge 20%:** base ₹3,499 + ₹1,500 accident = ₹4,999 → +20% surge ₹999.80 = ₹5,998.80. Commission/payout applied on total.
- **Fleet driver, flatbed 12 km, fleet share 80/20:** total ₹4,499; platform 14% = ₹629.86; pool to driver+fleet ₹3,869.14 → driver 80% ₹3,095.31, fleet 20% ₹773.83.

> **Geofencing** decides where night/highway/surge rules apply and which zone surge band is in effect. Advanced weather/holiday/toll auto-calculation is phased (§27).

---

## 8. Site Architecture & Screen Structure

### 8.1 TowGo — Customer App
```
TowGo (Customer)
├── Onboarding
│   ├── Splash
│   ├── Auth (/auth) — Mobile OTP · Google · Apple sign-in
│   └── Profile setup — name, photo, saved vehicles + RC, emergency contacts, saved addresses
├── Home (/)
│   ├── Location header + "Help near you" ETA
│   ├── Service catalog (9 services)
│   ├── Promotional / safety banners
│   └── Quick re-book
├── Booking Flow (/book)
│   ├── Service → vehicle type
│   ├── Pickup (GPS + map pin + autocomplete) → drop
│   ├── Distance + transparent fare estimate (breakdown)
│   └── One-tap Confirm
├── Live Tracking (/trip/[id])
│   ├── Driver card · live map · ETA · status timeline
│   ├── Booking OTP · in-app chat & call
│   └── Cancel (policy)
├── SOS (global)
├── Payments — Razorpay + wallet + breakdown
├── Trips (/trips) — active + history, invoice PDF, rate, re-book
└── Account (/account) — profile, vehicles, addresses, emergency contacts, notifications, wallet, coupons, help
```

### 8.2 TowPartner — Driver App
```
TowPartner (Driver)
├── Onboarding & KYC (/auth → /kyc) — OTP, document upload, verification states (online locked until approved)
├── Subscription (/subscription) — plans, Razorpay purchase, auto-renew, tier benefits/eligibility
├── Home / Dashboard (/) — online/offline toggle (gated), today's earnings/trips/acceptance/level, incoming job alerts
├── Active Job (/job/[id]) — detail, OTP entry, navigation, live ping, status actions, unable-to-deliver
├── Earnings & Wallet (/earnings) — balance, weekly reports, payout requests
└── Account — profile, documents, ratings, level, cancellation/fee visibility, support
```

### 8.3 TowFleet — Fleet Owner App
```
TowFleet (Fleet Owner)
├── Onboarding (/auth) — OTP, business profile, Fleet Business subscription
├── Fleet Dashboard (/) — live fleet map, utilization, revenue, alerts
├── Trucks (/trucks) — add/edit trucks, compliance checklist, 30-day expiry alerts
├── Drivers (/drivers) — onboard/invite, assign trucks, KYC status, performance
├── Jobs (/jobs) — fleet jobs, enterprise contracts (basic), assignment view
├── Earnings & Payouts (/earnings) — consolidated earnings, driver split, payout requests (Route)
└── Account — business profile, subscription, reports, support
```

### 8.4 Towing Admin — Web Dashboard
```
Towing Admin (Web)
├── Dashboard (/) — active rides, online drivers, today's revenue, key metrics
├── Verification (/drivers/pending)  ← Primary workflow
├── Users & Drivers (/users, /drivers) — search, detail, suspend/reactivate, history
├── Fleets (/fleets) — accounts, trucks, drivers, compliance oversight
├── Live Operations (/ops) — live map of bookings + drivers
├── Bookings (/bookings) — active/completed/cancelled, view/cancel/reassign/dispute, invoice PDF
├── Pricing (/pricing) — fares, slabs, multipliers, charges, surge bands, service zones/geofencing
├── Subscriptions (/subscriptions) — plan prices, commission %, tier rules
├── Payments & Payouts (/finance) — transactions, wallet ledger, payout approvals
├── Promotions (/promos) — banners, coupons
├── Support (/support) — tickets
└── Analytics (/analytics) — revenue, GMV, AOV, peak times, heat maps, subscription revenue, performance
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

#### 9.1.4 Home
- **Components:** location header ("Help near you", auto-detected, tap to change); search; **service catalog** (car tow, bike tow, flatbed, wheel-lift, battery jumpstart, flat-tyre, fuel delivery, breakdown, accident recovery — see Appendix B); promo/safety banners (admin-configurable carousel); quick re-book (last service).
- **States:** locating (skeleton) · location denied (manual entry prompt) · banners loading · offline (cached catalog + "limited connectivity" strip).
- **Edge cases:** GPS denied → manual address; outside any service zone → "Not yet available in your area" + waitlist (phased).
- **AC:** catalog loads from cache instantly then refreshes; tapping a service starts booking; location change updates ETA + zone.

#### 9.1.5 Booking Flow
- **Step 1 — Service & vehicle:** choose service; select vehicle (from saved or new); vehicle determines class (wheel-lift/flatbed) and base matrix.
- **Step 2 — Locations:** pickup via GPS + draggable map pin + Places autocomplete; drop location (optional for some services); distance via Distance Matrix.
- **Step 3 — Fare estimate:** transparent breakdown (base, night, highway, accident, surge, est. total) + ETA; clear note "fare locks when you confirm; may change with demand until then."
- **Step 4 — Confirm:** one-tap "Confirm Booking" → fare locked, OTP generated, dispatch starts.
- **States:** computing fare (skeleton) · no drop needed · surge active (badge) · payment method check · confirming (spinner).
- **Edge cases:** pin moved outside zone → re-evaluate/charge; surge changes pre-confirm → estimate updates; payment method missing → prompt to add.
- **AC:** estimate within ~2s; **end-to-end open→confirm < 45s** on a warm app; confirmation produces a `SEARCHING` booking + OTP.

#### 9.1.6 Live Tracking
- **Components:** driver card (name, photo, vehicle, plate, rating, call/chat); live map with driver marker + route + ETA countdown; **status timeline** (Searching → Assigned → En route → Arrived → In progress → Completed); **Booking OTP** prominently (hand to driver); cancel button (policy-aware).
- **States:** searching (animated radar, "finding a nearby driver") · no drivers found (retry/widen) · assigned · en route (moving marker) · arrived (highlight OTP) · in progress · completed (→ payment) · cancelled.
- **Edge cases:** driver location stale > X s → "reconnecting"; driver cancels → re-dispatch banner; OTP must not be visible before assignment.
- **AC:** location & ETA update within 2s; cancel reflects correct fee per policy; OTP one-time, expires 30 min.

#### 9.1.7 SOS (global, always reachable during active trip)
- **Components:** large SOS button; on trigger → confirm (2-tap to avoid accidental); shares live location to emergency contacts (SMS/WhatsApp), alerts ops, optionally broadcasts to nearest drivers.
- **States:** idle · armed · sent (confirmation + "help notified") · resolved.
- **Edge cases:** poor network → SMS fallback; accidental trigger → cancel within 5s.
- **AC:** SOS fires reliably on degraded networks; contacts receive location link; ops sees alert in real time.

#### 9.1.8 Payments & Wallet
- **Components:** Razorpay sheet (UPI, cards, wallets); in-app wallet balance; fare breakdown; apply coupon; saved methods.
- **States:** capturing (spinner) · success (animated check + invoice) · failed (retry / change method) · partial wallet + gateway.
- **Edge cases:** payment failure post-completion → booking stays `COMPLETED` until paid; retry idempotent; refund flow for disputes.
- **AC:** no raw card data stored; success transitions to `PAID`, generates invoice PDF, prompts rating.

#### 9.1.9 Trips (Active + History)
- **Components:** active trip card; history list (date, service, fare, driver, status); invoice (PDF) download; rate & review; re-book.
- **States:** empty ("No trips yet") · loading · error (retry).
- **AC:** history paginates; invoices downloadable; re-book pre-fills last booking.

#### 9.1.10 Account
- **Components:** profile, saved vehicles, addresses, emergency contacts, notification preferences, wallet & coupons, help & support, legal (privacy/terms), logout.
- **AC:** edits persist; logout clears session/tokens; document re-upload supported.

---

### 9.2 TowPartner (Driver App) — Complexity: HIGH

#### 9.2.1 Auth & KYC
- **Components:** OTP login; KYC wizard — driving licence, RC, **Government ID**, vehicle inspection photos, selfie (liveness optional/phased); progress indicator; status screen (pending/approved/rejected/incomplete with reasons).
- **States:** uploading (per-doc progress) · submitted (pending) · approved (celebration → unlock) · rejected (reasons + re-submit) · request-info.
- **Edge cases:** blurry/oversized images → client compression + quality hint; partial submission saved as `incomplete`.
- **AC:** online toggle stays locked until `approved`; documents stored encrypted (S3 SSE-KMS, private + pre-signed access); approval triggers Push + SMS + WhatsApp.

#### 9.2.2 Subscription (Paywall)
- **Components:** plan cards (Free Trial 7d · Starter ₹999 · Pro ₹1,999 · Fleet Business ₹4,999), tier benefits, current status, auto-renew toggle, Razorpay purchase, renewal date.
- **States:** no plan (must subscribe to receive jobs) · trial active (days left) · active (renews on date) · grace (renew now) · expired (locked).
- **Edge cases:** renewal failure → grace then expired; upgrade mid-cycle (immediate, pro-rated, admin-config).
- **AC:** purchase activates eligibility immediately; tier gates jobs correctly; expiry stops new offers but lets an in-progress job finish.

#### 9.2.3 Home / Dashboard
- **Components:** **Online/Offline toggle** (disabled unless KYC approved + subscription active); today's earnings, trips, acceptance rate, **level badge**; incoming job alert sheet (service, pickup distance, fare, customer rating) with **Accept / Reject + countdown**.
- **States:** offline · online idle (waiting) · job offer (timer) · on a job (locked to active job).
- **Edge cases:** offer arrives with weak signal → still actionable; multiple offers never stacked (one at a time).
- **AC:** toggle respects both gates; accept atomically assigns and routes to Active Job; reject/timeout reassigns elsewhere.

#### 9.2.4 Active Job
- **Components:** job + customer detail (name, pickup/drop, vehicle, fare); **navigation** (Google Maps deep link / in-app, traffic-aware); **Booking OTP entry** to start; status actions (arrived / start / complete); continuous live location ping; call/chat; **unable-to-deliver** (customer unavailable / wrong address / refused).
- **States:** navigating to pickup · arrived · awaiting OTP · in progress · completing (fare finalize incl. waiting) · completed.
- **Edge cases:** wrong OTP (retry, capped); customer unreachable → unable-to-deliver flow with reason; GPS drop → buffered pings sync on reconnect (§19).
- **AC:** job cannot start without valid OTP; live location streams to customer + admin within 2s; completion finalizes fare and adds waiting charges.

#### 9.2.5 Earnings & Wallet
- **Components:** balance, per-trip earnings, weekly report, commission visibility, **payout request** (to bank via Route), payout history & status.
- **States:** empty · loading · payout pending/processing/paid/failed.
- **AC:** earnings derived from ledger; payout requests respect minimum threshold + schedule; statuses update in real time.

#### 9.2.6 Account
- Profile, documents (re-upload), ratings, level + thresholds, cancellation/fee visibility, notification prefs, support, legal, logout.

---

### 9.3 TowFleet (Fleet Owner App) — Complexity: HIGH

#### 9.3.1 Onboarding
- **Components:** OTP login; business profile (name, GSTIN optional, address); Fleet Business subscription purchase.
- **AC:** fleet account created; subscription gates fleet features.

#### 9.3.2 Fleet Dashboard
- **Components:** live fleet map (all trucks + active jobs), utilization %, today's revenue, active drivers, **alerts** (expiring docs, idle trucks, non-compliant trucks).
- **States:** loading · empty (no trucks yet → CTA to add) · alerts present.
- **AC:** map updates in real time; alerts deep-link to the relevant truck/driver.

#### 9.3.3 Trucks
- **Components:** truck list; add/edit (type, plate, capacity); **Compliance Checklist** per truck — insurance, RC, PUC, permit (upload + issue/expiry dates); status (active / inactive / non-compliant); **30-day expiry alerts**.
- **States:** compliant · expiring soon (amber) · expired (red, removed from dispatch).
- **Edge cases:** missing doc → truck cannot dispatch; expired mid-day → auto non-compliant + alert.
- **AC:** documents stored encrypted; expiry alerts fire 30 days prior (EventBridge); non-compliant trucks excluded from matching.

#### 9.3.4 Drivers
- **Components:** driver list; onboard/invite (driver completes KYC in TowPartner); assign truck; KYC status; per-driver performance (trips, rating, earnings).
- **AC:** fleet-linked drivers' earnings split per fleet share; KYC still admin-approved centrally.

#### 9.3.5 Jobs
- **Components:** fleet jobs feed, enterprise/corporate contract jobs (basic), assignment view (which driver/truck).
- **AC:** jobs route through the platform dispatch; fleet sees aggregate + per-driver.

#### 9.3.6 Earnings & Payouts
- **Components:** consolidated fleet earnings, **driver–fleet split** breakdown, fleet wallet, payout requests (Route), payout history.
- **AC:** split computed at payout layer; ledgered; statuses real-time.

#### 9.3.7 Account
- Business profile, subscription, reports (per truck/driver/period), support, legal, logout.

---

### 9.4 Towing Admin (Web Dashboard) — Complexity: HIGH

#### 9.4.1 Login & Shell
- **Components:** secure role-based login (email + password + optional 2FA); left nav with pending-count badges; role-aware menu.
- **AC:** RBAC enforced server-side; sessions expire; audit log on sensitive actions.

#### 9.4.2 Dashboard
- **Components:** KPI cards (active rides, online drivers, today's revenue, pending approvals, fill rate); live activity feed; quick links.
- **AC:** real-time via Ably/Socket.io client subscription; cards refresh without full reload.

#### 9.4.3 Verification (Primary Workflow)
- **Components:** KYC queue table (name, phone, vehicle, submitted date, docs preview, status); detail panel (zoomable documents, selfie, vehicle photos, GPS on map, history); actions — **Approve / Reject (reason) / Request Info / Suspend / Reactivate**; bulk approve/reject.
- **States:** empty queue · loading · acting (per-row spinner).
- **AC:** action triggers driver notification (Push+SMS+WhatsApp); decision logged with admin id + timestamp; rejected requires reason.

#### 9.4.4 Users & Drivers
- **Components:** searchable/filterable tables (TanStack Table); detail view (profile, trips, payments, status timeline, notes); suspend/reactivate; impersonation read-only (phased).
- **AC:** server-side pagination/sort/filter; actions audited.

#### 9.4.5 Fleets
- **Components:** fleet accounts, trucks (with compliance state), drivers, consolidated earnings; suspend/reactivate fleet.
- **AC:** compliance oversight visible; non-compliant trucks flagged.

#### 9.4.6 Live Operations
- **Components:** live map (active bookings + driver positions), filter by zone/status, click marker → booking/driver detail.
- **AC:** positions update in real time; selecting a booking opens management actions.

#### 9.4.7 Bookings
- **Components:** tables (active/completed/cancelled), filters (status, date, user, driver, zone), detail (items, parties, address, timeline, payment), actions — view / cancel / reassign / handle dispute / **invoice PDF**.
- **AC:** manual status override available for edge cases; reassign re-runs dispatch or assigns directly; cancel triggers refund logic.

#### 9.4.8 Pricing & Geofencing
- **Components:** editable base-fare matrices (wheel-lift/flatbed slabs), vehicle multipliers, night charge, highway pickup, accident recovery, waiting rate, **surge bands**; **service-zone editor** (draw polygons on map; set surge band, highway flag, active state).
- **States:** editing · validating · saved (versioned).
- **AC:** changes versioned and effective immediately for new bookings; existing locked fares unaffected; zone polygons persisted as geography.

#### 9.4.9 Subscriptions
- **Components:** plan editor (price, commission %, distance/service eligibility, features), per-plan active subscriber count.
- **AC:** changes apply at next renewal (upgrade configurable); audit logged.

#### 9.4.10 Payments & Payouts (Finance)
- **Components:** transactions table, wallet ledger viewer, **payout approval queue** (driver/fleet), refund issuance, reconciliation export.
- **AC:** payouts require Finance/Super Admin; idempotent; ledger immutable; exports (CSV).

#### 9.4.11 Promotions
- **Components:** banner manager (image + CTA + schedule + active), **coupon manager** (percentage/flat/free-delivery, min order, usage limit, expiry).
- **AC:** banners drive customer-app carousel; coupon validation server-side.

#### 9.4.12 Support
- **Components:** ticket list (from customers/drivers/fleets), status workflow, assignment, notes.
- **AC:** tickets link to bookings/users; status transitions audited.

#### 9.4.13 Analytics
- **Components:** revenue/GMV/AOV charts (Recharts), peak-time & demand **heat maps**, subscription revenue, driver activity, fill rate, on-time rate, coupon redemption; date-range filter; export.
- **AC:** queries hit read replica at scale; exports available; no PII in aggregate exports.

---

## 10. Design System

### 10.1 Art Direction
**Concept:** fast, professional, reassuring — Uber/Bolt-grade polish, built for high-stress emergency moments where clarity wins. **Tone:** confident, urgent, trustworthy. **Mood:** fast, reliable, safe, professional, on-its-way. System-wide **dark/light mode**; **WCAG 2.1 AA** target.

### 10.2 Color Tokens
| Role | Name | Light | Dark | Usage |
|---|---|---|---|---|
| Primary | Signal Blue | `#2563EB` | `#3B82F6` | TowGo primary, CTAs, links, platform identity |
| Secondary | Recovery Orange | `#F97316` | `#FB923C` | TowPartner accent, high-visibility actions |
| Enterprise | Fleet Navy | `#1E3A8A` | `#2747B0` | TowFleet identity, enterprise surfaces |
| Base | Near Black | `#0E1116` | `#0E1116` | Dark backgrounds, headers |
| Surface 0 | Snow / Charcoal | `#FAFAFA` | `#15181F` | Page background |
| Surface 1 | Light Grey / Slate | `#F3F4F6` | `#1C212B` | Cards |
| Success | Fresh Green | `#22C55E` | `#34D399` | Online, completed, approved |
| Warning | Amber | `#F59E0B` | `#FBBF24` | Pending KYC, expiring docs |
| Error | Red | `#EF4444` | `#F87171` | Rejected, errors |
| **SOS** | Emergency Red | `#DC2626` | `#DC2626` | **Strictly SOS/critical safety** |
| Text 1 | Ink | `#111827` | `#F3F4F6` | Body |
| Text 2 | Stone | `#6B7280` | `#9CA3AF` | Captions, secondary |

**Per-app accent:** TowGo → Signal Blue · TowPartner → Recovery Orange · TowFleet → Fleet Navy + Orange · Admin → Charcoal + Blue.

### 10.3 Typography
| Role | Font | Weight | Notes |
|---|---|---|---|
| Display/Hero | Clash Display (Fontshare) | 600–700 | App names, hero |
| Body/UI | General Sans (Fontshare) | 400–600 | All UI |
| Numbers/Fare | General Sans (tabular-nums) | 700 | Fares, earnings, timers |
| Labels/Badges | General Sans | 600 uppercase | Status pills, tags |

**Type scale (mobile):** 32 / 24 / 20 / 17 / 15 / 13 / 11. **Line-height:** 1.3 headings, 1.5 body.

### 10.4 Spacing, Radius, Elevation
- Spacing scale: 4 · 8 · 12 · 16 · 20 · 24 · 32. Base unit 4px.
- Radius: 8 (inputs), 12 (cards), 16 (sheets), full (pills/avatars).
- Elevation: subtle shadows; dark mode uses surface tints over shadows.

### 10.5 Core Components (shared library across 3 apps)
Buttons (primary/secondary/destructive/ghost), inputs + OTP input, status pills, driver/trip cards, map + markers, bottom sheets, modals, toasts, skeleton loaders, empty states, fare-breakdown row, rating stars, countdown timer, segmented controls. Reuse cuts UI work ~30%.

### 10.6 Iconography & Motion
- Icon set: a single consistent line/solid family (e.g. Lucide/Phosphor RN).
- Motion: 150–250ms ease; map marker interpolation for smooth movement; SOS button micro-pulse; success checkmark animation. Respect reduced-motion.

### 10.7 Accessibility
- Min 4.5:1 contrast for text; 44×44pt min tap targets; full screen-reader labels; dynamic type support; never color-only state (icon + label). SOS reachable and labeled.

### 10.8 Admin Web Design
Tailwind CSS + shadcn/ui; dense data tables (TanStack Table); Recharts; responsive ≥ 1024px primary, graceful on tablet; same color tokens; dark mode.

---

## 11. Notifications System

### 11.1 Channels
Push (FCM via Expo), SMS (MSG91, DLT templates), WhatsApp (Cloud API / BSP), Email (SES, transactional), In-app (notification center).

### 11.2 Trigger Matrix
| Event | Recipient | Push | SMS | WhatsApp | Email |
|---|---|---|---|---|---|
| OTP (login / booking) | User/Driver | — | ✅ | ✅ (opt) | — |
| KYC approved | Driver | ✅ | ✅ | ✅ | — |
| KYC rejected / request info | Driver | ✅ | ✅ | ✅ | — |
| New job offered | Driver | ✅ (high-priority) | — | — | — |
| Booking confirmed | Customer | ✅ | ✅ | ✅ | — |
| Driver assigned / en route / arrived | Customer | ✅ | — | ✅ | — |
| Job started (OTP verified) | Customer | ✅ | — | — | — |
| Completed + invoice | Customer | ✅ | — | ✅ | ✅ (invoice) |
| Payment success / failure | Customer | ✅ | ✅ (fail) | — | ✅ (receipt) |
| Subscription renewal / failure / expiry | Driver | ✅ | ✅ | ✅ | — |
| Compliance doc expiring (30d) | Fleet | ✅ | — | ✅ | ✅ |
| Payout processed / failed | Driver/Fleet | ✅ | ✅ | — | ✅ |
| **SOS triggered** | Emergency contacts + Ops | ✅ (ops) | ✅ | ✅ | — |
| Dispute update | Customer/Driver | ✅ | — | ✅ | — |

### 11.3 Delivery Rules
- High-priority FCM for job offers and SOS.
- SMS/WhatsApp via DLT-registered templates (MSG91/Cloud API) — content stored as templates in admin.
- Notification fan-out via **SQS** to avoid blocking request paths; retries with backoff; dead-letter queue for failures.
- Per-user notification preferences (channel opt-outs where legally allowed; transactional/safety always on).

---

## 12. Safety & SOS

- **Trigger:** large SOS control in TowGo (2-tap arm to prevent accidents), available during any active booking (and standalone — configurable).
- **Actions on trigger:** (1) live location link to emergency contacts via SMS + WhatsApp; (2) real-time alert to Ops (admin live feed); (3) optional broadcast to nearest available drivers; (4) record `sos_alert` with location + booking ref.
- **Resilience:** if data network is poor, SMS fallback fires; SOS event queued and retried.
- **Ops handling:** acknowledge → contact customer/driver → resolve; full timeline logged.
- **Privacy:** location sharing scoped to the SOS event; contacts pre-saved by the user.
- **AC:** SOS must fire on degraded networks; ops sees alerts within 2s on a healthy network; resolution audited.

---

## 13. Wallets, Payments & Payouts

### 13.1 Ledger Model
- **Append-only `wallet_transactions`** is the source of truth; `wallets.balance` is a derived/cached value reconciled against the ledger.
- Every entry: `wallet_id, type (credit/debit), amount, reason, ref_id (booking/payout/refund), created_at`.
- All money mutations carry an **idempotency key**.

### 13.2 Payment Flow (Razorpay)
1. Fare locked at confirm.
2. On completion, capture via Razorpay (UPI/card/wallet); webhook confirms.
3. On success → booking `PAID`, commission computed, driver/fleet earning credited to wallet ledger, invoice PDF generated.
4. On failure → retry (idempotent); booking remains `COMPLETED` (unpaid) until resolved; ops can intervene.

### 13.3 Commission & Split
- `PlatformEarning = Total × commission%` (plan-driven).
- `DriverPool = Total − PlatformEarning`.
- Independent driver: full `DriverPool` to driver wallet.
- Fleet driver: `DriverPool` split `driver_share` / `fleet_share` (configurable) → two ledger credits.

### 13.4 Payouts (Razorpay Route)
- Driver/Fleet requests payout (min threshold + schedule) → `processing` via Route to linked bank → webhook → `paid`/`failed`.
- Admin Finance approves where required; all idempotent and ledgered.
- **Setup dependency:** Razorpay merchant account + Route onboarding (client business/legal task).

### 13.5 Refunds & Disputes
- Cancellation refunds and dispute resolutions issue ledger entries + Razorpay refunds; reasons recorded; visible in finance + user history.

---

## 14. Technical Architecture (AWS)

Architected around three needs: **relational + spatial** (matching/pricing/money), **high-frequency ephemeral** (live location), **real-time push** (dispatch/status). Best AWS tool per job.

### 14.1 Mobile (all 3 apps)
| Layer | Choice | Why |
|---|---|---|
| Framework | React Native (Expo) | One codebase iOS+Android × 3 apps; OTA updates; strong India dev pool |
| Language | TypeScript | Type-safe gate logic; end-to-end types |
| Navigation | React Navigation v7 | Standard |
| State | Zustand + TanStack Query | UI state + cached server state |
| Local storage | MMKV | ~10× faster than AsyncStorage |
| Maps | Google Maps (react-native-maps) | Best India coverage; Places, Directions, Distance Matrix |
| Realtime | Socket.io client | Dispatch, location, status, chat |
| Payments | Razorpay RN SDK | UPI/cards/wallets |
| Push | Expo Push → FCM | One abstraction, both stores |
| Media | expo-image-picker → S3 pre-signed | KYC docs, photos |

### 14.2 Backend
| Layer | Choice | Why |
|---|---|---|
| Runtime | Node.js + **NestJS** | Modular enterprise structure (auth/booking/pricing/dispatch/payments/notifications modules) |
| API | REST + WebSocket (Socket.io) | CRUD + real-time |
| Compute | **Amazon ECS on Fargate** | Long-running containers for persistent WebSockets + auto-scaling; no servers to patch |
| LB | **Application Load Balancer** | WebSocket upgrade + sticky sessions for Socket.io |
| Registry | Amazon ECR | CI/CD image store |

> **Why not Lambda for the API:** persistent WebSocket connections for dispatch/tracking need long-lived processes; Lambda is request-scoped/timeboxed. (Lambda still used for isolated async via SQS triggers.) **Why not EKS now:** ECS Fargate is simpler ops at launch; EKS is the Phase-3 scale path.

### 14.3 Data Layer
**Amazon RDS for PostgreSQL (+ PostGIS)** — relational + spatial source of truth.
| Why | Detail |
|---|---|
| Nearest-driver | PostGIS KNN `<->` / `ST_DWithin` on `geography(Point)` + GIST index |
| Atomic txns | Booking + fare lock + assignment in one transaction |
| Integrity | FKs across users→bookings→payments→drivers→fleets |
| Analytics | SQL reports, read replicas at scale |
| Gates | Constraints/policies back KYC + subscription gates |
ORM: **Drizzle** (TS-native, fast) or Prisma. Scale: **Aurora PostgreSQL** + read replicas.

**Amazon ElastiCache for Redis** — ephemeral + real-time state.
| Use | Detail |
|---|---|
| Socket.io adapter | Shared pub/sub across Fargate tasks |
| Live location | Short-TTL driver lat/lng/heading, broadcast to subscribers; only path/final persisted to PostgreSQL |
| Sessions/OTP | Refresh tokens, OTP counters, rate limits |
| Hot cache | Pricing config, nearby-driver sets, surge state |

> *(Optional: DynamoDB + TTL for full location history if audit trails are later required.)*

### 14.4 Supporting Services
| Concern | Service | Why |
|---|---|---|
| Files/docs | **S3** (SSE-KMS) + CloudFront | Encrypted KYC docs (private + pre-signed), public thumbnails via CDN |
| Auth | **Custom JWT** (NestJS) + OTP (MSG91) + Google/Apple | Embeds role + `kyc_status` + `subscription.tier` claims; Apple mandatory iOS *(Cognito = alternative)* |
| Payments | **Razorpay + Route** | India coverage + split payouts; PCI handled |
| Maps | **Google Maps Platform** | India coverage *(Amazon Location = alt)* |
| Push/SMS/WhatsApp | FCM · MSG91 · WhatsApp Cloud API | Notifications |
| Email | **Amazon SES** | Invoices, alerts |
| Async/cron | **SQS** + **EventBridge Scheduler** | Fan-out, renewals, 30-day compliance alerts, weekly reports |
| Secrets | **Secrets Manager / SSM** | Keys/env injected to Fargate — none in code |
| Network | **VPC** (+ public/private subnets), **Route 53**, **ACM** | ALB/NAT public; Fargate/RDS/Redis private; TLS via ACM |
| CI/CD | **GitHub Actions → ECR → ECS** | Build/push/rolling deploy |
| Observability | **CloudWatch** + Sentry (+ X-Ray opt.) | Logs/metrics/alarms; crash tracking |
| Admin hosting | **AWS Amplify Hosting** (Next.js SSR) | AWS-native CI/CD *(or ECS + CloudFront)* |

### 14.5 Architecture Diagram
```
┌──────────────────────────────────────────────────────────────┐
│         MOBILE APPS  ·  React Native (Expo) + TypeScript        │
│        TowGo (Customer)   TowPartner (Driver)   TowFleet         │
│   Zustand · TanStack Query · MMKV · Google Maps · Socket.io     │
└───────────────┬──────────────────────────────┬────────────────┘
                │ REST + WebSocket               │
                ▼                                ▼
        ┌───────────────┐              ┌─────────────────────┐
        │  CloudFront    │              │  Application Load    │
        │  (assets/CDN)  │              │  Balancer (WS+sticky)│
        └───────┬────────┘              └──────────┬──────────┘
                │                    ┌─────────────▼──────────────┐
                │                    │  Amazon ECS (Fargate)       │
                │                    │  NestJS API + Socket.io     │
                │                    │  (auto-scaling, private VPC)│
                │                    └──┬────────┬────────┬───────┘
                │              ┌────────▼──┐ ┌───▼─────┐ ┌▼────────┐
                │              │ RDS       │ │ Elasti  │ │  S3 +   │
                │              │ Postgres  │ │ Cache   │ │  KMS    │
                │              │ +PostGIS  │ │ (Redis) │ │ (docs)  │
                │              │ Users·    │ │ Live    │ └─────────┘
                │              │ Bookings· │ │ location│  ┌──────────────┐
                │              │ Payments· │ │ Sessions│  │ SQS +        │
                │              │ Fleets·   │ │ Socket  │  │ EventBridge  │
                │              │ Subs·Zones│ │ adapter │  │ (jobs/cron)  │
                │              └───────────┘ └─────────┘  └──────────────┘
                ▼
┌──────────────────────────────────────────────────────────────┐
│        TOWING ADMIN (Web) · Next.js 15 + Tailwind + shadcn      │
│            AWS Amplify Hosting · Socket.io client               │
└──────────────────────────────────────────────────────────────┘

  External:  Google Maps · Razorpay + Route · MSG91 ·
             WhatsApp Cloud API · FCM (Expo Push) · SES
```

---

## 15. API Specification (REST + WebSocket)

Base: `https://api.towing.app/v1`. Auth: `Authorization: Bearer <JWT>`. All list endpoints paginate (`?page&limit&sort&filter`). Standard error envelope: `{ error: { code, message, details } }`.

### 15.1 Auth
| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/otp/send` | Send OTP (body: phone, role) |
| POST | `/auth/otp/verify` | Verify OTP → JWT + refresh token |
| POST | `/auth/social` | Google/Apple sign-in |
| POST | `/auth/refresh` | Rotate tokens |
| POST | `/auth/logout` | Invalidate session |

### 15.2 Customer (TowGo)
| Method | Path | Purpose |
|---|---|---|
| GET/PUT | `/me` | Profile |
| GET/POST/DELETE | `/me/vehicles` | Saved vehicles |
| GET/POST/DELETE | `/me/addresses` | Saved addresses |
| GET/POST/DELETE | `/me/emergency-contacts` | Contacts |
| GET | `/services` | Service catalog |
| POST | `/pricing/estimate` | Fare estimate (service, vehicle_class, pickup, drop) |
| POST | `/bookings` | Create booking (locks fare, starts dispatch) |
| GET | `/bookings/:id` | Booking detail |
| GET | `/bookings` | History |
| POST | `/bookings/:id/cancel` | Cancel (policy applies) |
| GET | `/bookings/:id/otp` | Booking OTP |
| GET | `/bookings/:id/invoice` | Invoice PDF |
| POST | `/bookings/:id/rate` | Rate driver |
| POST | `/payments/:bookingId/capture` | Capture payment |
| POST | `/sos` | Trigger SOS |
| GET | `/wallet` · `/wallet/transactions` | Wallet & ledger |
| POST | `/coupons/validate` | Validate coupon |

### 15.3 Driver (TowPartner)
| Method | Path | Purpose |
|---|---|---|
| POST | `/driver/kyc/documents` | Upload doc (pre-signed S3) |
| GET | `/driver/kyc/status` | KYC status |
| GET | `/driver/subscription/plans` | Plans |
| POST | `/driver/subscription/subscribe` | Subscribe (Razorpay) |
| GET | `/driver/subscription` | Current subscription |
| POST | `/driver/online` · `/driver/offline` | Toggle (gated) |
| POST | `/driver/location` | Location ping (also via WS) |
| POST | `/jobs/:id/accept` · `/reject` | Offer response |
| POST | `/jobs/:id/arrived` · `/start` · `/complete` | Status |
| POST | `/jobs/:id/unable` | Unable-to-deliver (reason) |
| GET | `/driver/earnings` · `/driver/earnings/weekly` | Earnings |
| POST | `/driver/payouts` | Request payout |

### 15.4 Fleet (TowFleet)
| Method | Path | Purpose |
|---|---|---|
| GET/POST/PUT | `/fleet/trucks` | Trucks CRUD |
| POST | `/fleet/trucks/:id/compliance` | Upload compliance doc |
| GET/POST | `/fleet/drivers` | Manage/invite drivers |
| POST | `/fleet/drivers/:id/assign-truck` | Assign truck |
| GET | `/fleet/dashboard` | Live fleet summary |
| GET | `/fleet/earnings` · `/fleet/earnings/split` | Earnings + split |
| POST | `/fleet/payouts` | Request payout |

### 15.5 Admin (web)
| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/dashboard` | KPIs |
| GET | `/admin/drivers/pending` | KYC queue |
| POST | `/admin/drivers/:id/approve|reject|request-info|suspend|reactivate` | KYC actions |
| GET | `/admin/users` · `/admin/drivers` · `/admin/fleets` | Management |
| GET | `/admin/ops/live` | Live ops feed |
| GET | `/admin/bookings` | Bookings |
| POST | `/admin/bookings/:id/cancel|reassign|dispute` | Booking actions |
| GET/PUT | `/admin/pricing` · `/admin/zones` | Pricing & geofencing |
| GET/PUT | `/admin/subscriptions/plans` | Plans/commission |
| GET | `/admin/finance/transactions` · `/admin/finance/payouts` | Finance |
| POST | `/admin/finance/payouts/:id/approve` | Approve payout |
| GET/POST | `/admin/promos` · `/admin/coupons` | Promotions |
| GET | `/admin/analytics` | Analytics |

### 15.6 WebSocket Events (Socket.io)
**Channels:** `booking:{id}`, `driver:{id}`, `admin:ops`, `fleet:{id}`. Scoped to prevent cross-user leakage.
| Event | Direction | Payload |
|---|---|---|
| `job:offer` | server→driver | booking summary + timeout |
| `job:accept` / `job:reject` | driver→server | booking id |
| `booking:status` | server→customer/admin | status, ts |
| `location:update` | driver→server→customer/admin | lat,lng,heading,ts |
| `eta:update` | server→customer | eta seconds |
| `chat:message` | bi-directional | booking id, text |
| `sos:alert` | server→admin | user, location, booking |
| `ops:metrics` | server→admin | live KPI deltas |

---

## 16. Database Schema (Full)

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
         current_location geography(Point,4326),  -- GIST
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

-- GEOFENCING
service_zones (id, name, area geography(Polygon,4326), surge_band,
               is_highway BOOL, is_active BOOL)
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
          total, commission_pct, commission_amount, driver_payout,
          booking_otp, otp_verified BOOL, otp_expires_at,
          cancelled_by, cancellation_reason, cancellation_fee,
          unable_reason, payment_id FK NULL, payment_method,
          created_at, updated_at)
INDEX idx_bookings_status ON bookings(status);
INDEX idx_bookings_user ON bookings(user_id);
INDEX idx_bookings_driver ON bookings(driver_id);
booking_status_history (id, booking_id FK, status, actor, note, created_at)
booking_location_path (id, booking_id FK, lat, lng, recorded_at)  -- persisted samples

-- PRICING (admin-editable)
pricing_rules (id, vehicle_class, distance_min, distance_max, base_price, is_active)
charge_config (id, key, value, is_percentage, updated_by, updated_at)
                                -- night, highway_min, highway_max, accident, waiting_per_min, surge_band_*

-- SUBSCRIPTIONS & COMMISSION
subscription_plans (id, name, weekly_price, commission_pct,
                    max_distance_km, services JSONB, features JSONB, is_active)
driver_subscriptions (id, driver_id FK, plan_id FK, status,  -- trial|active|grace|expired
                      started_at, expires_at, auto_renew BOOL, razorpay_sub_id)

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

## 17. Real-Time Architecture

- **Transport:** Socket.io over the ALB (WebSocket upgrade + sticky sessions); **Redis adapter** lets all Fargate tasks broadcast consistently.
- **Location pipeline:** driver app emits `location:update` every 3–5s → server writes to Redis (short TTL) and broadcasts to `booking:{id}` + `admin:ops`; periodic samples persisted to `booking_location_path`; only final drop persisted on completion.
- **Dispatch:** server pushes `job:offer` to `driver:{id}` with timeout; driver responds; on accept, assignment is an atomic DB txn then `booking:status` broadcast.
- **Backpressure & reconnect:** clients auto-reconnect; missed events reconciled via REST refetch on reconnect; offers expire server-side regardless of client state.
- **Latency target:** status & location propagate within 2s on a healthy network.

---

## 18. Security, Privacy & Compliance

### 18.1 Data Protection
- **Encryption at rest:** S3 SSE-KMS (AES-256) for all documents/PII; RDS & ElastiCache encryption at rest; KMS-managed keys.
- **Encryption in transit:** TLS 1.2+ everywhere (ACM certs on ALB/CloudFront/Amplify).
- **Sensitive documents (Government ID, licence, RC, insurance):** private S3 buckets; access only via short-lived **pre-signed URLs**; never public; masked in UI where possible.

### 18.2 AuthN / AuthZ
- Custom JWT with role + status claims; **short-lived access tokens + rotating refresh tokens**; refresh tokens stored in Redis and revocable.
- RBAC middleware on every protected endpoint; admin sub-roles enforced server-side (§4.2).
- The supply-side gates enforced at all three layers (§3.1).

### 18.3 Application Security
- Input validation/sanitization (class-validator/zod) on every endpoint; parameterized queries (ORM) — no raw string SQL.
- Rate limiting (OTP, login, booking creation) via Redis; lockouts on abuse.
- Idempotency keys on all money operations.
- Secrets only in Secrets Manager/SSM; no secrets in code or images.
- Dependency scanning + image scanning (ECR) in CI.
- Webhook signature verification (Razorpay).

### 18.4 Privacy & Indian Compliance
- **DPDP Act 2023** alignment: collect only necessary PII; explicit consent at onboarding; clear privacy policy & terms; data-retention policy; user rights (access/correction/deletion within policy).
- **DLT compliance** for SMS (MSG91 registered templates); WhatsApp template approval (Cloud API/BSP).
- **PCI scope** minimized — payment handled by Razorpay hosted/native checkout; no raw card data stored.
- **Document retention:** KYC/compliance docs retained per legal requirement; deletion on account closure per policy.
- **Audit:** `admin_actions` logs all sensitive operations (who/what/when).

### 18.5 Operational Security
- Private subnets for compute/data; security groups least-privilege; no public DB/Redis.
- CloudWatch alarms on anomalies; centralized logs; Sentry for error tracking (PII-scrubbed).
- Backups: RDS automated backups + PITR; S3 versioning; periodic restore drills.

---

## 19. Offline & Resilience

- **Driver offline-accept queue:** if connectivity drops momentarily, "Accept" and status actions are queued locally (MMKV) and synced via WebSocket/REST on reconnect; server-side offer timeouts still apply (a stale accept is rejected gracefully with a clear message).
- **Customer app:** cached service catalog + last booking render offline; booking creation requires connectivity (clear offline banner).
- **Location buffering:** driver location pings buffer locally on signal loss and flush in order on reconnect.
- **Idempotent retries:** all mutating calls are safe to retry (idempotency keys) so flaky networks don't double-book or double-charge.
- **Graceful degradation:** map falls back to last-known position with a "reconnecting" indicator; SOS uses SMS fallback.

---

## 20. Analytics & KPIs

### 20.1 Event Tracking (GA4 / Amazon Pinpoint)
Key events: `app_open`, `signup_start/complete`, `kyc_submit/approved`, `service_selected`, `estimate_viewed`, `booking_confirmed`, `driver_assigned`, `job_started`, `booking_completed`, `payment_success/failure`, `booking_cancelled`, `sos_triggered`, `subscription_purchased/renewed/expired`, `payout_requested`.

### 20.2 Operational Dashboards (Admin)
- **Marketplace:** fill rate, time-to-match, time-to-arrival, active drivers vs demand, cancellation rate.
- **Revenue:** GMV, AOV, commission revenue, active subscriptions, subscription revenue, coupon redemption.
- **Reliability:** on-time arrival %, payment success %, SOS response time, payout SLA.
- **Geographic:** demand heat maps by zone/time; surge effectiveness.
- **Driver:** activity, acceptance/completion rates, ratings distribution, level distribution.

### 20.3 Reporting
Date-range filtering; CSV export (no PII in aggregate exports); read-replica-backed queries at scale.

---

## 21. Non-Functional Requirements

- **Gate enforcement at 3 layers** — KYC + subscription gates in app UI, API middleware (JWT claims + DB check), and database (constraint/policy).
- **Real-time** — status & location update within **2 seconds** end-to-end (healthy network).
- **Time-to-book** — app-open → "Confirm Booking" under **45 seconds** (warm app).
- **Performance** — app cold start < 3s; API p95 < **200ms**; map first paint < 2s.
- **Uptime** — 99.9% during operating hours; RDS Multi-AZ in production.
- **Security** — AES-256 at rest (S3 SSE-KMS, RDS); PCI via Razorpay; JWT refresh rotation; input sanitization; least-privilege RBAC.
- **OTP delivery** — < 10s (Indian numbers).
- **Offline** — driver accept-queue + location buffering; idempotent retries.
- **Safety** — SOS fires on degraded networks (SMS fallback).
- **Accessibility** — WCAG 2.1 AA; dark/light mode.
- **Scalability** — new cities/zones/vehicle-classes without core refactor.
- **Observability** — centralized logs, metrics, alarms, crash tracking.
- **Maintainability** — modular NestJS, typed end-to-end, shared mobile component library, IaC.

---

## 22. Scalability Architecture

### 22.1 Phase 1 — MVP (Single City)
ECS Fargate (1–2 tasks), single RDS PostgreSQL + PostGIS, ElastiCache Redis, manual KYC, basic distance + night + simple surge, manual long-distance quoting, SQS for notifications.

### 22.2 Phase 2 — Multi-City
Geofenced per-zone surge; auto-scaling Fargate (CPU/connection-based policies); RDS read replicas for analytics; SQS at volume with DLQ; **auto-KYC via Amazon Textract** (+ optional Rekognition selfie match); surge tuning from live demand; CDN-cached catalog.

### 22.3 Phase 3 — Enterprise
Service split (auth, booking, dispatch, pricing, notification, payout) on **Amazon EKS**; **Aurora PostgreSQL** + read replicas; event streaming via **Amazon MSK (Kafka)** or EventBridge; multi-region/DR; B2B/insurance portals, garage marketplace, AI chatbot, full loyalty/reward engine, web fleet console.

---

## 23. DevOps, Environments & CI/CD

### 23.1 Environments
| Env | Purpose | Notes |
|---|---|---|
| `dev` | Active development | Smaller RDS/Redis; seeded data |
| `staging` | Pre-prod QA + client UAT | Mirrors prod topology; test payment keys |
| `production` | Live | Multi-AZ RDS; auto-scaling; alarms; backups |

### 23.2 Infrastructure as Code
All AWS resources defined as code (**Terraform** or AWS CDK): VPC, subnets, ECS/Fargate services, ALB, RDS, ElastiCache, S3, IAM roles, SQS, EventBridge, CloudWatch alarms, Secrets. Repeatable, reviewable, environment-parametrized.

### 23.3 CI/CD Pipeline (GitHub Actions)
1. **Lint + type-check + unit tests** on PR.
2. **Build** backend Docker image → push to **ECR**; build admin (Amplify) and mobile (EAS) artifacts.
3. **Deploy to staging** on merge to `main` (ECS rolling update; DB migrations via Drizzle/Prisma migrate).
4. **Smoke/integration tests** on staging.
5. **Manual approval → production** (rolling or blue/green via CodeDeploy).
6. **Mobile:** EAS build → TestFlight / Play Internal → store submission; OTA (Expo Updates) for JS-only fixes.

### 23.4 Secrets & Config
Per-environment values in Secrets Manager/SSM; injected into Fargate task definitions and Amplify; never committed.

### 23.5 Observability & Ops
CloudWatch dashboards (latency, error rate, queue depth, DB connections, WS connections); alarms → email/SMS/Slack; Sentry for backend + mobile crashes; structured JSON logs; X-Ray tracing (optional).

### 23.6 Backups & DR
RDS automated backups + PITR; S3 versioning; documented restore runbook + periodic drills; production Multi-AZ.

---

## 24. Testing & QA Strategy

| Layer | Approach |
|---|---|
| Unit | Jest — pricing engine, commission/split math, gate logic, state transitions |
| Integration | API + DB (test containers / staging) — booking lifecycle, payments, payouts, dispatch |
| Real-time | Socket.io event flows — offer/accept, location broadcast, reconnect/resync |
| E2E (mobile) | Detox / Maestro — onboarding, booking, KYC, subscription, job flow |
| E2E (web) | Playwright — verification queue, pricing edits, finance flows |
| Load | k6 / Artillery — concurrent bookings, location ping throughput, surge scenarios |
| Security | Dependency + image scanning; auth/RBAC tests; webhook signature tests |
| UAT | Client sign-off on staging per module |
| Device matrix | Common Android (low/mid/high) + iOS (last 3 versions); both stores' review readiness |

**Critical test scenarios:** gate enforcement (unverified/unsubscribed driver blocked), atomic assignment (no double-book), fare lock at confirm, cancellation tiers, commission & fleet split correctness, OTP-gated job start, SOS on degraded network, payout idempotency, offline accept-queue resync.

---

## 25. Development Phases & Timeline

Phases overlap (driver app begins while customer app finishes). High build velocity via the Claude Code workflow.

| Phase | Deliverables | Window |
|---|---|---|
| 1 — Foundation | AWS IaC (VPC, ECS, RDS+PostGIS, Redis, S3, SQS, CI/CD), DB schema, auth + OTP, driver KYC, admin verification module, design system (4 interfaces) | Weeks 1–4 |
| 2 — Engine | Dispatch/matching (PostGIS), pricing engine, subscription & commission core, WebSocket real-time, wallet ledger | Weeks 3–7 |
| 3 — TowGo | Customer app: onboarding, booking, live tracking, payments, SOS, trips, account | Weeks 5–9 |
| 4 — TowPartner | Driver app: KYC, subscription paywall, job workflow, navigation, earnings/wallet/payouts | Weeks 8–12 |
| 5 — TowFleet | Fleet app: truck/driver management, compliance checklist + alerts, fleet earnings/payouts, dashboard | Weeks 10–13 |
| 6 — Towing Admin | Web: dashboard, verification, live ops map, pricing/geofencing, subscriptions, finance, promotions, support, analytics | Weeks 12–15 |
| 7 — Integration | End-to-end real-time, payments/payouts wiring, notifications, cross-interface QA on both platforms | Weeks 14–17 |
| 8 — Polish & Launch | Performance, accessibility, security hardening, App Store + Play Store submission (3 apps), admin go-live, production setup | Weeks 17–20 |

**Total:** ~**16–20 weeks** (≈ 4–5 months) for the full four-interface ecosystem.

---

## 26. Cost Estimation

### 26.1 Development Cost (indicative, for discussion)
| Component | Covers | Estimated (INR) |
|---|---|---|
| UI/UX Design (4 interfaces) | Uber-style design system across 3 apps + web admin | ₹45,000 |
| Foundation — AWS Backend, Dispatch & Real-Time Engine | Infra, APIs, matching, pricing, subscriptions, payments, real-time, ledger | ₹1,80,000 |
| TowGo (Customer App) | Booking, live tracking, payments, SOS, ratings | ₹85,000 |
| TowPartner (Driver App) | KYC, dispatch, navigation, subscriptions, earnings | ₹85,000 |
| TowFleet (Fleet App) | Fleet/driver/truck management, compliance, payouts | ₹80,000 |
| Towing Admin (Web Dashboard) | Verification, live ops, pricing/subscription controls, finance, analytics | ₹1,10,000 |
| QA, Builds & Deployment | Testing across both platforms + web; store & web go-live | ₹35,000 |
| **Indicative Total** | | **₹6,20,000** |

> Indicative and adjustable by trimming/staging scope (§27). A formal quotation with payment milestones follows once scope is locked.

### 26.2 Monthly AWS Infrastructure (low–moderate volume)
| Service | Monthly (INR) |
|---|---|
| ECS Fargate (right-sized) | ₹3,500 – ₹8,000 |
| RDS PostgreSQL + PostGIS | ₹5,000 – ₹12,000 |
| ElastiCache Redis | ₹2,500 – ₹5,000 |
| S3 + CloudFront | ₹500 – ₹3,000 |
| Application Load Balancer | ₹1,800 – ₹2,500 |
| NAT / data transfer | ₹2,500 – ₹6,000 |
| SES / SQS / EventBridge / CloudWatch | ₹1,000 – ₹3,000 |
| Amplify Hosting (admin web) | ₹1,200 – ₹4,000 |
| **AWS Subtotal** | **₹18,000 – ₹43,000 / month** |

**Volume note:** at higher scale, add RDS Multi-AZ + read replicas, more Fargate tasks, and larger Redis — budget grows roughly linearly with active drivers/bookings.

### 26.3 Third-Party (client-paid, usage-based)
Google Maps Platform · Razorpay transaction & payout fees · MSG91 SMS · WhatsApp Cloud API · Apple Developer ($99/yr) + Google Play ($25 one-time) · KYC/OCR per-check (when auto-KYC added).

---

## 27. Future Roadmap (Full Detail)

Documented in full so each can be switched on later without rework. Each is a paid module.

### 27.1 Auto-KYC (OCR)
Amazon Textract extracts fields from licence/RC/Government ID; optional Rekognition selfie↔ID face match; rules auto-approve clean cases, route edge cases to manual review. Reduces verification turnaround. *Per-check cost applies.*

### 27.2 Advanced Surge & Geofencing
Weather/traffic/holiday-aware surge bands; toll auto-calculation along route; demand-prediction; per-zone dynamic multipliers tuned from historical data.

### 27.3 Driver Reward Automation
Activate Bronze→Platinum effects: commission reductions, dispatch priority weighting, bonus payouts, faster payout tiers, VIP support routing. (Schema + metrics already present.)

### 27.4 AI Chatbot & Support
Assistant to help book, estimate fares, answer FAQs, guide emergencies, and triage tickets; escalation to human support; WhatsApp + in-app.

### 27.5 Marketplace
Nearby garages/mechanics discovery and booking; service-center listings; take-rate model; ratings.

### 27.6 Corporate & Insurance Portals
B2B job routing, SLAs, bulk dispatch, contract billing, insurer claim integration, dealership partnerships.

### 27.7 Loyalty, Referrals & Coupons (full)
Customer loyalty points/tiers, referral rewards (two-sided), advanced coupon engine, flash sales.

### 27.8 Multi-Language
Hindi + regional languages across all apps; RTL-ready architecture; admin-managed strings.

### 27.9 Web Fleet Console
Richer desktop console for fleet owners (bulk operations, exports, larger maps) complementing the TowFleet app.

### 27.10 Long-Distance Auto-Quoting
Automated quotes for 600 km+ flatbed hauling (route + toll + time modeling) replacing manual quotes.

---

## 28. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Cold-start supply (too few drivers) | Low fill rate, poor CX | Launch one city; seed/onboard drivers first; trial plan to attract supply |
| Payout/legal setup delays (Razorpay Route) | Drivers can't be paid | Start merchant + Route onboarding in week 1; manual payout fallback if needed |
| KYC fraud / fake documents | Safety, trust | Manual review at launch; OCR + face match (Phase 2); suspension tooling |
| WebSocket scaling under surge | Dropped real-time updates | Redis adapter + Fargate auto-scaling; load tested; reconnect/resync |
| Surge mispricing | Lost trips or driver churn | Start simple; tune from real data before advanced engine |
| Map/API cost spikes | Margin pressure | Cache distance/zone results; monitor usage; usage alarms |
| App Store review friction (iOS) | Launch slip | Apple sign-in + privacy disclosures ready; submit early |
| PII/data compliance (DPDP) | Legal exposure | Encryption, consent, retention policy, audit logging from day one |
| Single-region outage | Downtime | Multi-AZ at prod; documented DR; backups + drills |

---

## 29. Key Decisions to Confirm

| Topic | Why It Matters |
|---|---|
| Driver & fleet payouts | Razorpay merchant + Route is a client business/legal setup gating payouts |
| KYC & Government ID handling | Encrypted + privacy-compliant; manual review at launch, OCR later (per-check cost) |
| iOS requirements | Apple Developer account; Apple sign-in mandatory; review adds days |
| Launch region | One city first → expand (keeps pricing/surge/supply manageable) |
| Surge model | Distance + night + basic surge first; advanced later |
| Subscription & commission defaults | Confirm ₹999/₹1,999/₹4,999 and 25%/14% (all admin-editable) |
| Admin: web confirmed | Web admin chosen over mobile for documents/maps/exports/finance |
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

**Sample strings.** Empty trips: "No trips yet — help is one tap away." Searching: "Finding a verified driver near you…" No drivers: "No drivers free right now. Try again or widen your search." Pending KYC (driver): "You're almost set — we're reviewing your documents." Subscription expired: "Renew your plan to start receiving jobs." SOS sent: "Help notified. Stay safe — your location is shared." Payment success: "Paid ₹1,499. Invoice saved to your trips."

---

## Appendix B — Service Catalog

| Service | Description | Typical Vehicle Class |
|---|---|---|
| Car tow | Standard car towing | Wheel-lift / Flatbed |
| Bike tow | Two-wheeler recovery | Wheel-lift |
| Flatbed tow | Luxury/SUV/EV/accident, damage-free | Flatbed |
| Wheel-lift tow | Quick city recovery | Wheel-lift |
| Battery jumpstart | On-site jumpstart | Roadside |
| Flat-tyre support | Tyre change/repair | Roadside |
| Fuel delivery | Emergency fuel | Roadside |
| Breakdown assistance | General on-site help | Roadside |
| Accident recovery | Post-accident recovery (+₹1,500) | Flatbed |

---

## Appendix C — Glossary

- **KYC** — Know-Your-Customer document verification for drivers.
- **Dispatch / Matching** — selecting and offering a booking to the best eligible driver.
- **Geofence / Service zone** — polygon defining where the platform operates and how pricing/surge applies.
- **Surge** — demand/weather/time-based fare multiplier.
- **Commission** — platform's % of gross fare per completed booking.
- **Route (Razorpay)** — Razorpay's split-payout product for paying drivers/fleets.
- **RBAC** — role-based access control.
- **Ledger** — append-only record of money movements; balances derived from it.
- **OTA** — over-the-air JS updates (Expo) without a store release.
- **PostGIS** — PostgreSQL spatial extension for geo queries.
- **DLT** — Distributed Ledger Technology registration required for Indian SMS.
- **DPDP Act** — India's Digital Personal Data Protection Act, 2023.

---

## Appendix D — Fastest Build Approach

1. **Backend & dispatch engine first** — matching, pricing, and the KYC/subscription gates must be stable before consumer features.
2. **Expo (React Native)** — one codebase for all three apps + OTA updates during iteration.
3. **Razorpay + Route** — India payments + payouts integrate in days; start merchant onboarding immediately.
4. **AWS as code from week 1** — VPC, ECS, RDS, Redis, secrets, CI/CD so every later phase deploys cleanly (and env-var/secrets pain is solved from day one).
5. **Shared component library** across TowGo / TowPartner / TowFleet to cut UI ~30%.
6. **Ship admin verification in Phase 1** — without verified drivers, nothing runs.

---

## Appendix E — Assumptions & Dependencies

**Assumptions:** single-city launch; manual KYC and manual long-distance quoting at launch; Indian market (INR, UPI, MSG91, DLT, DPDP); React Native (not Flutter) per existing workflow; web admin (not mobile) for ops.
**Client dependencies (business/legal):** Razorpay merchant account + Route onboarding; Apple Developer account; Google Play account; DLT SMS sender/template registration; WhatsApp Business (Cloud API/BSP) approval; privacy policy & terms content; brand assets/logos; initial pricing/zone/plan confirmation.
**Technical dependencies:** Google Maps API keys; AWS account + billing; domain (Route 53); ACM certificates.

---

*Prepared by Talagana Rajesh · Webcros — Design · Develop · Deliver · webcros.in*

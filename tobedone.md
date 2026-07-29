# TowGo (Moveyo) — To Be Done

Running backlog of everything deferred, stubbed, or suggested during development.
Last updated: 2026-07-19.

> Legend: 🔜 next up · 🧩 screen to build · 🔌 stub/no-op to wire · ⚙️ backend/integration · 📦 native/infra (needs dev build or keys) · ❓ open decision · ✨ polish

---

## ✅ Recently done
- **Booking Details screen** — opens from a My Bookings card. Trip card (route timeline + pickup/drop + Tow Type / Duration / Total), Driver Details, Booking Summary (date/time/distance/payment/total + status note), Help & Support → Contact Us. The **Bookings tab now owns a nested stack** (`BookingsStack`) so the tab bar stays visible on the detail, per the design — this is a new navigation pattern; every other pushed screen still covers the tabs. Along the way, five duplicated pieces were extracted and shared: `BackButton` (was copy-pasted in Tracking/BookTow/Searching), `StatColumn`, `SectionHeading`, `RouteTimeline`, `DateTime`, `STATUS_META`.
- **Account sub-screens** (§9.1.11) — all 8 built + wired off the Profile hub via a shared settings/forms kit (`ScreenHeader`, `SubScreen`, `SettingsList`/`SettingsRow`, `TextField`, `Toggle` in `apps/towgo/src/components/`): **Personal Information** (edits `profileStore`, reflects on hub), **My Vehicles** + **Add/Edit Vehicle** (real, `vehiclesStore`), **Saved Locations** + **Add/Edit Location** (real, `savedLocationsStore`), **Payment Methods** (list + default badge; Add stubbed), **Notifications** (toggles → `notificationPrefsStore`), **Help Center** (searchable FAQ accordion), **Contact Us** (contact rows + message form), **Settings** (Preferences/Legal/About groups). Data is in-memory zustand (resets on reload).
- **Live Tracking screen** (§9.1.7) — built (v1): map card with route (driver → pickup), driver info card (photo/rating/trips/plate/call/chat), "Driver is on the way / ETA" card, Request Details + Cancel, safety banner. Searching auto-advances here on match.

## 🔜 Tracking — remaining pieces (v1 stubs)
- **Live truck movement** — interpolated/animated marker along the route + **ETA countdown** (needs real Maps + Socket.io; currently a static stylized route and "12 min").
- **Booking OTP** — show the one-time code to hand the driver on arrival.
- **Status timeline** — Searching → Assigned → En route → Arrived → In progress → Completed (currently only "Driver is on the way").
- **Share-trip link** — read-only public link via WhatsApp/SMS.
- **Real driver + photo** — from backend (currently `assignedDriverMock` + generic avatar).
- **Call / chat / Cancel** — wire to real calling, in-app chat, and policy-aware cancellation (§3.5).

## 🧩 Customer screens still to build
- **Splash** (§9.1.1) + **Auth / Mobile-OTP** (§9.1.2) + **Profile setup** (§9.1.3).
- **Payments & wallet** (§9.1.9) — Razorpay sheet, fare breakdown, coupons, invoice.
- **SOS** (§9.1.8) — global emergency button, share location, ops alert.
- **Trips extras** — invoice PDF download, rate & review, re-book (the CTAs a details screen would normally host — deliberately absent from the supplied design).
- **Services** — real 9-service catalog (Appendix B) + service → booking entry.

## 🔌 Wired screens — stubbed actions to implement
- **Home**: hamburger menu, notification bell, quick actions (Schedule a Tow, Roadside Assistance, 24/7 Support), Safety banner → all no-op. Only "Book a Tow" is wired.
- **Services**: service cards + "Contact Support" → no-op.
- **Booking Details**: driver Call / Message → no-op (no driver phone in the data model; `expo-linking` isn't a dependency). Only the `completed` status is exercised — the pill and closing note are already status-driven (`statusMeta.ts`), but there are no `cancelled`/`in_progress`/`scheduled` mock rows, and an `in_progress` booking has no "Track" CTA (TrackingScreen reads `useBookingStore`, not a bookingId).
- **Booking flow**: "Select on map", "Add stops", schedule picker ("Pickup now"), "For someone else" (contact entry), tow-type "View All", "Add Note" → no-op.
- **Searching**: "Get help", Call/Message → no-op (Call/Message wait on Tracking).
- **AppHeader** menu/bell across tabs → no-op.
- **Account sub-screens** stubs:
  - **Personal Information / Add Vehicle**: change-photo + "Upload RC" → no-op (needs `expo-image-picker`).
  - **Add Saved Location**: "Select on map" → no-op (needs real Maps).
  - **Payment Methods**: "Add Payment Method" + row tap → no-op (needs Razorpay, §9.1.9).
  - **Contact Us**: Call / Email / WhatsApp rows + "Send Message" → no-op (need `Linking` + support endpoint).
  - **Settings**: Language ("English") + Appearance ("Light") pickers, Privacy Policy + Terms → no-op (dark mode deferred; legal pages pending).
  - **Persistence**: vehicles/locations/profile/notification prefs are in-memory only (reset on reload) — swap to MMKV + real API later.

## ⚙️ Backend & integrations (all data is mocked behind swappable sources)
- **Real REST API** — replace mock data sources (`homeDataSource`, `bookingsDataSource` incl. the new `getBooking(id)`, `bookingsMock`/`bookingDetailsMock`, `towTypes`, `recentLocations`, `nearbyDriversMock`, `useSearchSimulation`) with the NestJS backend. The detail-only fields (`reference`, `towTypeId`, `durationMinutes`, `distanceKm`, `paymentMethod`, `driverPhoto`, `driverTrips`) are invented and await a real API contract; `bookingsMock` is currently an alias of `bookingDetailsMock`, so a list row carries detail fields at runtime that the `Booking` type hides — never cast a `Booking` to a `BookingDetail`.
- **Socket.io** — live dispatch + driver tracking + status events (§6, §11).
- **Fare estimate API** (§7.6) — currently the selected tow-type's static price.
- **Auth** — JWT/refresh, OTP, session (MMKV).
- **Google Places autocomplete** — for the pickup/drop fields (currently plain inputs + mocked recents).
- **Razorpay** — payments/wallet/payouts.
- **Push notifications** — Expo Push → FCM.

## 📦 Native / infra (needs an EAS dev build or API keys — not available in Expo Go)
- **Google Maps** (`react-native-maps`) — drop into the `MapPreview` facade; needs Android/iOS Maps API keys. Today: styled placeholder + stylized route/driver/user markers.
- **MMKV** — persist the TanStack Query cache (storage interface already abstracts it; currently in-memory).
- **Haptics** (`expo-haptics`) — success haptic on match, light tick on search start, etc. (§10.7).
- **Reanimated / Moti** — for gesture-driven bottom sheets and richer motion (currently RN `Animated` — fine for radar/skeletons; sheets are static).
- **EAS dev build** — `eas build --profile development` (project "moveyo", id `55703152-…`) to exercise the above on-device.

## ❓ Open decisions
- **App name**: slug/bundle = **moveyo**, but the logo + spec still say **TowGo**. Finalize the product name, then align logo/spec/workspace folder (`apps/towgo`, pkg `towgo`).
- **Dark mode**: app is locked to light (Figma is light-only). Re-enable `system` when dark designs exist.
- Whether to keep the leftover **nearby-drivers data layer** (`features/home/api`) — retained as the seam for real map markers even though its Home UI was replaced.

## ✨ Polish / fidelity
- Booking Step-2 **map route + drivers** overlay is decorative (fixed positions) until real Maps.
- Services **Support banner** text was bumped up from the Figma's sub-8px values.
- Quick-action / service **icons**: "Towing Services" uses the branded Figma art; the other services use Lucide icons in amber circles (swap for real art if provided).
- Consider enforcing the **no-hardcoded-color ESLint rule** as a CI gate (configured, not gating).
- Add **designed empty/error/offline states** everywhere data loads (done on Home/Bookings; extend as new data screens land).

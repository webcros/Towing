# TowGo (Moveyo) — To Be Done

Running backlog of everything deferred, stubbed, or suggested during development.
Last updated: 2026-08-20, for Track B Phase 17.

> **Read the first bullet of "✅ Recently done" below before anything else.** Phase 12 (10 Aug 2026)
> superseded large parts of this file — real backend, real phone-OTP auth and real on-device storage
> all landed. The rest of the file was *not* swept line by line, so where a later section contradicts
> that note (or [OVERVIEW.md](OVERVIEW.md) / [Detailed-Overview.md](Detailed-Overview.md), which are
> kept current every phase), the note and those two win.

> Legend: 🔜 next up · 🧩 screen to build · 🔌 stub/no-op to wire · ⚙️ backend/integration · 📦 native/infra (needs dev build or keys) · ❓ open decision · ✨ polish

---

## ✅ Recently done
- **Track B Phase 17 (20 Aug 2026) closed the matching loop, and with it several items below.**
  Now real: `useSearchSimulation.ts` — a pure timer that invented a driver after six seconds — is
  **deleted**, and `SearchingScreen` reads actual wave, radius and drivers-contacted off a
  `/customer` socket merged with the REST poll; its retry button, previously `notReady`, posts a real
  re-search. TowPartner gained `OfferTakeoverScreen` (`fullScreenModal`, back gesture disabled,
  countdown ring driven by the server's absolute `expiresAt`, haptics at arrival and at five seconds,
  gross → commission → net) and `AssignedJobScreen`, so **Accept no longer lands on
  `PlaceholderScreen`**; `JobOffer.expiresInSeconds` and its local countdown are gone; the offer's
  single unlabelled fare — which was the gross — is replaced by the earnings triple; `NewJobScreen`'s
  Decline now tells the server instead of hiding the card locally (it was holding the driver's offer
  lock for the full twenty seconds); and `offersDataSource` finally has its REST half.

  **Still true, and the reason nothing has been observed:** no dev-client or EAS build exists for
  either app, so the takeover, the ring, the haptics and the high-priority offer push have **never
  run**, and the two-phone acceptance chain has not been performed. The offer also has **no
  distinctive sound** — deliberately, because Android freezes a notification channel's sound
  permanently on first creation, so a placeholder would be unfixable on every phone that had already
  installed it (`17i` in [ToBeDoneEhsan.md](ToBeDoneEhsan.md)).

- **Track B Phase 16 (19 Aug 2026) gave the platform a supply side, and closed several items below.**
  Now real: the customer home map draws genuinely nearby drivers (anonymised — count and ~100 m
  coarsened positions, no name/plate/rating, because §11.9 forbids identity before assignment);
  `BookLocationScreen` has real debounced autocomplete and "Select on map" opens a new
  `MapPickerScreen`; `MapPreview` renders `react-native-maps` behind its existing prop seam with **no
  consumer changes**; TowPartner's online toggle calls the real backend behind `KycApprovedGuard` and
  starts an Android foreground service / iOS background-mode location task with an MMKV buffer that
  flushes in order on reconnect; `NewJobScreen`'s "Enable Location" button — which flipped a `useState`
  and requested no OS permission at all — asks for real permission; and `driverStatusStore` stopped
  being the source of truth and became a mirror of the server (`toggle()` is gone).

  **Still true, and the reason nothing has been observed:** the maps need a Google Maps SDK key on
  Android (checklist item 7) — without one `<MapPreview />` deliberately keeps the placeholder rather
  than rendering a blank grey grid with a Google watermark, and address search runs on a 21-entry
  local gazetteer instead of Places. iOS renders maps today (Apple Maps needs no key), which nobody
  has seen either: **no dev-client or EAS build has ever been produced for either app**, so
  `react-native-maps`, `expo-location`, `expo-task-manager` and `socket.io-client` are all installed,
  typechecked, bundle-clean and prebuild-clean, and have never executed. The foreground service, the
  Doze behaviour, the tunnel buffer and the §11.10 6–8 %/h battery target are unverified. The Play
  background-location declaration has not been filed (checklist item 3).

- **Track B Phase 13 (10 Aug 2026) landed the notification spine.** Things this file listed as
  stubbed are now real: the bell in `AppHeader` (documented in its own source as a no-op) opens a
  working notification centre; `notificationPrefsStore` — four in-memory booleans that reset on every
  launch — is **deleted**, and the settings screen reads and writes the server. Both apps register a
  device for push on sign-in and unregister on logout. TowPartner has a high-priority Android
  notification channel (`job-offer-v1`), created deliberately unused so Phase 17's 20-second job
  offers are not the first time it runs.

  **Still true, and the reason nothing has been delivered:** push needs a Firebase project (Android)
  and an APNs key (iOS), SMS needs MSG91 + DLT template registration, WhatsApp needs a Meta BSP and
  template approval, email needs SES production access. None exists — every channel runs on a log
  adapter that records what it would have sent. Push additionally needs a dev-client or EAS build,
  because **Expo Go cannot mint a push token at all**, and no build has ever been produced for either
  app (TowPartner does not even have an EAS project id — `npx eas init` is item `0viii` in
  [ToBeDoneEhsan.md](ToBeDoneEhsan.md)). So: written, typechecked, bundle-clean, prebuild-clean,
  covered by 577 backend tests — and never once observed on a phone.

- **Track B Phase 12 (10 Aug 2026) superseded a lot of this file** — real backend, real auth, real
  on-device storage landed for both mobile apps. Specifically: Splash/Auth/OTP/Profile-setup (§9.1.1-3,
  listed below as "still to build") are built; `profileStore`/`vehiclesStore`/`savedLocationsStore`
  (referenced throughout this file) are deleted, replaced by real `/me` API data sources; MMKV
  persistence (listed below as native/infra not yet done) is wired; RC-upload, "Select on map"→GPS,
  Contact Us `Linking`, and Settings' Privacy/Terms rows are real, not no-ops. This file's other
  sections were not swept for every individual line Phase 12 touched — treat anything below that
  contradicts [OVERVIEW.md](OVERVIEW.md)/[Detailed-Overview.md](Detailed-Overview.md) as stale in
  favor of those two, which are kept current every phase.
- **Booking Details screen** — opens from a My Bookings card. Trip card (route timeline + pickup/drop + Tow Type / Duration / Total), Driver Details, Booking Summary (date/time/distance/payment/total + status note), Help & Support → Contact Us. The **Bookings tab now owns a nested stack** (`BookingsStack`) so the tab bar stays visible on the detail, per the design — this is a new navigation pattern; every other pushed screen still covers the tabs. Along the way, five duplicated pieces were extracted and shared: `BackButton` (was copy-pasted in Tracking/BookTow/Searching), `StatColumn`, `SectionHeading`, `RouteTimeline`, `DateTime`, `STATUS_META`.
- **Account sub-screens** (§9.1.11) — all 8 built + wired off the Profile hub via a shared settings/forms kit (`ScreenHeader`, `SubScreen`, `SettingsList`/`SettingsRow`, `TextField`, `Toggle` in `apps/towgo/src/components/`): **Personal Information** (edits `profileStore`, reflects on hub), **My Vehicles** + **Add/Edit Vehicle** (real, `vehiclesStore`), **Saved Locations** + **Add/Edit Location** (real, `savedLocationsStore`), **Payment Methods** (list + default badge; Add stubbed), **Notifications** (toggles → `notificationPrefsStore`), **Help Center** (searchable FAQ accordion), **Contact Us** (contact rows + message form), **Settings** (Preferences/Legal/About groups). Data is in-memory zustand (resets on reload).
- **Live Tracking screen** (§9.1.7) — built (v1): map card with route (driver → pickup), driver info card (photo/rating/trips/plate/call/chat), "Driver is on the way / ETA" card, Request Details + Cancel, safety banner. Searching auto-advances here on match.

## 🔜 Tracking — remaining pieces (v1 stubs)
- **Live truck movement** — interpolated/animated marker along the route + **ETA countdown**. *(Phase 16 supplied the two things this was blocked on — a real map behind `MapPreview` and a live driver position stream — so what remains is genuinely Phase 18's own work: the route polyline, bearing rotation, the pan-pause/re-center camera and the ETA. The tracking screen is still a static stylized route and "12 min".)*
- **Booking OTP** — show the one-time code to hand the driver on arrival.
- **Status timeline** — Searching → Assigned → En route → Arrived → In progress → Completed (currently only "Driver is on the way"). *(Phase 17 made `assigned` real and pushes it over the `/customer` socket; the rest of the timeline is Phase 18's.)*
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
- **Booking flow**: ~~"Select on map"~~ *(real as of Phase 16 — opens `MapPickerScreen`; disabled on Android until a Maps key exists)*, "Add stops", tow-type "View All" → no-op. *(The schedule picker, "For someone else" and "Add Note" became real in Phase 15.)*
- **Searching**: "Get help", Call/Message → no-op (Call/Message wait on Tracking). *(The retry and the wave/radius/count display became real in Phase 17.)*
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
- ~~**Socket.io** — live dispatch~~ *(real as of Phase 17: `/customer` namespace, `search:progress` + `booking:status`, single-use handshake ticket, REST poll behind it)*. Driver tracking and the remaining status events are Phase 18's.
- **Fare estimate API** (§7.6) — currently the selected tow-type's static price.
- **Auth** — JWT/refresh, OTP, session (MMKV).
- **Google Places autocomplete** — for the pickup/drop fields (currently plain inputs + mocked recents).
- **Razorpay** — payments/wallet/payouts.
- **Push notifications** — Expo Push → FCM.

## 📦 Native / infra (needs an EAS dev build or API keys — not available in Expo Go)
- **Google Maps** (`react-native-maps`) — drop into the `MapPreview` facade; needs Android/iOS Maps API keys. Today: styled placeholder + stylized route/driver/user markers.
- **MMKV** — persist the TanStack Query cache (storage interface already abstracts it; currently in-memory).
- **Haptics** (`expo-haptics`) — success haptic on match, light tick on search start, etc. (§10.7). *(Installed and used in both apps since Phase 12/17 — but never felt, because no build exists.)*
- **A licensed job-offer alert sound** — the one asset that cannot be written. Blocked on `17i` in [ToBeDoneEhsan.md](ToBeDoneEhsan.md), and **cheaper before launch than after**, because Android freezes a channel's sound on first creation.
- **Reanimated / Moti** — for gesture-driven bottom sheets and richer motion (currently RN `Animated` — fine for radar/skeletons; sheets are static).
- **EAS dev build** — `eas build --profile development` (project "moveyo", id `55703152-…`) to exercise the above on-device.

## ❓ Open decisions
- **App name**: settled as **MiTow**. Bundle ids are now `in.mitow.customer` / `in.mitow.partner` (renamed 21 Aug 2026, permanent), and the customer app's user-visible strings read MiTow. Still on the old name: the EAS `slug`/`owner`/`scheme` (`moveyo` — renaming makes a *new* EAS project), the driver app's display name (`TowPartner`), the backend/theme strings, and the workspace folder (`apps/towgo`, pkg `towgo`). See the brand section in [ToBeDoneEhsan.md](ToBeDoneEhsan.md).
- **Dark mode**: app is locked to light (Figma is light-only). Re-enable `system` when dark designs exist.
- Whether to keep the leftover **nearby-drivers data layer** (`features/home/api`) — retained as the seam for real map markers even though its Home UI was replaced.

## ✨ Polish / fidelity
- Booking Step-2 **map route + drivers** overlay is decorative (fixed positions) until real Maps.
- Services **Support banner** text was bumped up from the Figma's sub-8px values (now held at the 10dp legibility floor — see the comment in `SupportBanner.tsx`).
- Quick-action / service **icons**: "Towing Services" uses the branded Figma art; the other services use Lucide icons in amber circles (swap for real art if provided).
- Consider enforcing the **no-hardcoded-color ESLint rule** as a CI gate (configured, not gating).
- Add **designed empty/error/offline states** everywhere data loads (done on Home/Bookings; extend as new data screens land).

## 📐 Type & density pass (390dp reference)

Both apps were re-derived against the Figma at a documented **390dp reference width**
(`packages/theme/src/tokens/reference.ts`). Three things worth knowing before touching sizes again:

- **The Figma mixes three authoring conventions.** Most frames are native 390. Customer Home
  (`20:2`) and Book (`31:2`), driver New Job (`78:197`) and *every nav/status bar* are a 430 design
  squashed into a 390 artboard — every number there is an exact ×0.9069767 multiple, so raw values
  render ~9% small and must be multiplied by 1.1026. Driver Jobs (`78:354`) is a genuine 430 frame
  and scales down by 0.907. **Resolve a screen against its group before copying numbers out.**
- **Chrome was copy-pasted unscaled** across every frame — the driver tab bar (352×90), FAB (59⌀ /
  64 overlay), tab icons (16), tab labels (12/18) and all corner radii. Never scale those.
- **10dp is the legibility floor**, and the Figma breaches it in four places: stat labels (9),
  all chart labels (8.3), the Services support banner (7.8) and the driver contact rows (8.3–9.5).
  Each is deliberately overridden upward with a comment at the call site.

The type ramp now runs on a major second (1.125) through the working band, and line heights follow a
wrap rule — text that cannot wrap runs at ~1.2×, text that wraps stays at ~1.4×. The previous
blanket ~1.45× was the single biggest source of vertical bloat.

**Still open:** the driver `FilterTabs` renders free-standing pills, but Figma `78:354` specifies a
bordered segmented control (354×46, r11, item h44, active `#fdba74` on `#fdf6e9`). That is a
structural change, not a sizing one, and was left out of this pass.

### Width-responsive tokens (added after on-device review)

The type/density pass alone was not enough: the tokens are authored at 390dp, and on a narrower
phone the same dp values occupy proportionally more of the screen — which reads as "the text is too
big and everything feels clustered" even when no individual value is wrong.

`packages/theme/src/tokens/scale.ts` now re-scales `spacing`, `typography` and `sizes` to the real
viewport, applied in `ThemeProvider` via `useWindowDimensions`. Clamped to **0.88–1.06**: below that
text stops being comfortably legible, above it a large phone should show *more* content rather than
bigger content.

| viewport | ratio | address 16 | stat label 12 | circle 44 | gutter 20 |
|---|---|---|---|---|---|
| 320 | 0.88 | 14 | 10.5 | 39 | 17.5 |
| 360 | 0.923 | 15 | 11 | 41 | 18.5 |
| 375 | 0.962 | 15.5 | 11.5 | 42 | 19 |
| **390 (reference)** | **1.0** | **16** | **12** | **44** | **20** |
| 412 | 1.056 | 17 | 12.5 | 46 | 21 |

Two things deliberately do **not** scale: **corner radii** (shared literals across every Figma frame
regardless of canvas — a scaled radius reads as a different shape, not a smaller one) and **tap
targets**, which are floored at 44dp however narrow the device.

**This only reaches values that come from the theme.** A hardcoded `fontSize: 16` will not scale.
The Bookings and Booking Details surfaces were migrated onto variants/tokens for exactly this
reason; other screens still hold literals and should be migrated as they are touched. Use
`theme.scale(dp)` for a genuine one-off.

### Booking Details redesigned as a flat list (Uber-style)

The card-stack layout was replaced wholesale. The old screen nested four bordered,
shadowed cards inside a bordered page; every card edge is a line the eye has to parse
before reaching content, which is what made it read as cluttered regardless of type size.

What changed structurally:

| | before | after |
|---|---|---|
| Containers | 4 nested cards, borders + shadows | **none** — flat rows on the page, hairline dividers |
| Icons | amber filled circles (decorative) | monochrome line icons in a fixed 24dp gutter |
| Title | centred, with a floating settings button over it | large, left-aligned; back button on its own line |
| Trip facts | 3-up stat grid + a 5-row table in a card | one list, values right-aligned per row |
| Driver | cramped card, name + vehicle truncating mid-word | `BookingHero` — one 24pt heading, avatar, two full-width action pills |
| Status note | green tinted box | dropped; the status pill already says it |

New components, all in `features/bookings/components/`: `DetailRow` (+ `RowDivider`, and the
`ROW_GUTTER` / `ROW_GAP` constants every row aligns to), `BookingHero`, `RouteRows`.

**Removed as superseded** (recoverable from git): `BookingTripCard`, `BookingSummaryCard`, the
`STATUS_NOTE` map, and the `RouteDot` / `RoutePin` / `RouteDashes` / `ROUTE_RAIL_W` helpers that
only `BookingTripCard` used. `RouteTimeline` stays — the Bookings **list** card still uses it.

Drop-off time is derived, not stored: `addMinutesToTimeLabel(booking.time, durationMinutes)` in
`utils/format.ts`, since the payload carries a pickup label and a duration but no arrival stamp.

**The Bookings list has not been redesigned to match** — it is still a card list. Applying the same
flat treatment there is the obvious follow-up.

### Bottom nav — floating pill with an active chip

Both apps' footers now use the same shape language: a stadium-shaped bar inset from the screen
edges, with a rounded chip behind the active tab.

**Customer (`apps/towgo/src/navigation/TabBar.tsx`)** — rebuilt from a full-width bar with rounded
top corners into a floating pill: `height 64`, `borderRadius 32` (half the height, so the ends are
true semicircles), inset `16` horizontally, 1px border plus a soft drop shadow. The active tab gets
a `54`-tall `brandTint` chip at full pill radius.

The outer container stays **in normal layout flow** rather than absolutely positioned, so the
navigator reserves its height and no screen needs padding to clear it — the floating read comes from
the pill being inset inside a page-coloured container.

Icon-to-label ratio moved from ~2.2 (icon 22 / label 10) to **~1.6** (icon `sizes.icon.lg` 20 /
label variant 12). Shrinking the glyph and growing the label is what stops a labelled tab bar
reading as icon-first-with-a-caption.

**Driver (`apps/towpartner/src/navigation/DriverTabBar.tsx`)** — already a floating notched bar, so
only the active chip was added (soft orange `#FFF1E6` behind `driverColors.accent`). While doing it
the tab items' `paddingTop: 26` was replaced with `justifyContent: 'center'`: the notch only cuts
the middle slot, so the side tabs have the full bar height and the magic number was just eyeballed
centring. The FAB, notch and SVG geometry are untouched.

**Correction — the wrapper must not have a background.** The first version of the customer pill kept
its wrapper *in normal layout flow* with `backgroundColor: surface0`, so the navigator reserved the
wrapper's height and painted a visible band across the foot of every screen. Matching the wrapper
colour to the page does not fix it; the band is the wrapper existing at all.

`TabBar` now mirrors `DriverTabBar`: `position: 'absolute'`, `pointerEvents="box-none"`, **no
background on the wrapper** — only the pill and the active chip are painted. Content scrolls behind
the pill, and the five screens that sit under it (Home, Bookings, BookingDetails, Services, Profile)
reserve room via the exported `useTabBarSpace()`.

Any new screen added under the tab navigator must call `useTabBarSpace()` for its `paddingBottom`,
or its last row will hide behind the bar.

### Floating bar offset — why it looked device-random

`Math.max(insets.bottom, N)` was the wrong formula for a floating bar, in both apps. It conflates
two unrelated quantities and fails in both directions:

- Inset reported correctly (48dp, 3-button nav) → `max(48, 12)` = 48, so the bar sits **flush**
  against the navigation bar with no visual gap.
- Inset wrongly reported as **0** → `max(0, 12)` = 12, and the 24–48dp navigation bar then paints
  over the bar's lower half. A zero bottom inset on Android under edge-to-edge is a known,
  still-open bug in `react-native-safe-area-context`: `getSafeAreaInsets` derives `bottom` from the
  provider view's `getGlobalVisibleRect`, and when that rect falls short of the window the real
  inset is cancelled to 0. Whether it happens depends on the OEM decor hierarchy and startup
  timing — same build, different result per device.

`max()` also *hides* the zero behind a plausible number, so the bug is silent where the gesture bar
is under 12dp and obvious where it is taller. That is the whole "some devices yes, some no".

Both bars now use `useBottomBarOffset()` from `@towing/ui` — **additive**:
`max(insets.bottom, 24 on Android) + 12`. The floor clears the tallest gesture bar even when the
inset lies; the gap is decorative and always applied.

Also corrected: `SafeAreaProvider initialMetrics={initialWindowMetrics}` is now **iOS-only**.
`initialWindowMetrics` is captured when the native module is constructed — before Android applies
edge-to-edge insets — so on Android it manufactures exactly the `bottom: 0` first frame it was meant
to prevent. Without it the provider simply holds the frame until real insets arrive.

**Edge-to-edge is unconditional from SDK 54 onward** (Android 16 removed the opt-out), so every
Android build draws behind the navigation bar and this offset is always load-bearing. Note the
`androidNavigationBar` config key no longer exists in the SDK 57 schema; controlling the navigation
bar's own appearance now needs `expo-navigation-bar` or `react-native-edge-to-edge`, i.e. a native
rebuild — **not available in Expo Go**.

---

## Motion system (customer app) — what is unverified

Reanimated 4.5.1 + worklets 0.10.1 + expo-haptics are installed **in `apps/towgo` only**. All eight
packages typecheck and both apps bundle clean, but **nothing here has been run on a device.**

### Verified mechanically

- The worklets babel plugin genuinely runs: `workletHash` appears 40× in TowGo's Hermes bundle.
  `babel-preset-expo@57.0.3` auto-injects `react-native-worklets/plugin` when the package resolves
  from the project root, and top-level `plugins` run before preset plugins — so `module-resolver`
  runs first and worklets last, which is the required order. **`babel.config.js` and
  `metro.config.js` are unchanged and must stay that way.** Adding the plugin by hand would run it
  twice.
- **TowPartner took on nothing.** `react-native-reanimated` is not resolvable from `apps/towpartner`,
  and `MotionPressable` / `expo-haptics` / `selectionAsync` are all absent from its bundle. Note its
  bundle *does* contain `workletHash` and `reanimated` strings — those ship inside
  `react-native-gesture-handler@2.32` itself (`reanimatedWrapper.js`, `gesture.js`) and predate this
  work. The real guarantee is that the bundle builds at all: Metro resolves statically, so a leaked
  import in `packages/ui` would hard-fail.

### Needs a device

1. **That worklets actually execute.** Bundling proves the transform ran, not that
   `useAnimatedStyle` works at runtime.
2. **Expo Go's SDK version.** Reanimated is bundled in Expo Go for SDK 57, but if the installed Expo
   Go predates it the JS will call a mismatched native module. Fall back to `eas go` or a dev client
   (`expo-dev-client` is already a dependency).
3. **The bottom sheet's scroll↔pan handoff** — the hardest part of the whole system and untestable
   except by hand, on both platforms. Watch specifically: dragging the sheet down from the top snap
   while the inner list is mid-scroll, and swiping the tow-type carousel sideways without dragging
   the sheet (guarded by `failOffsetX`, but the threshold is a guess).
4. **Every spring constant.** Each is physically derived — damping ratio and settle time are in the
   token comments — but they need one tuning pass on real hardware.
5. **`ios_from_right` on the 10 account screens.** A visible change from the previous Android
   default. Look at it before shipping.
6. **The tab pill's first paint.** It is held at `opacity: 0` until the row reports its width; if
   that measurement is ever slow, the pill would visibly pop in.
7. **Haptics** (emulators no-op) and **Reduce Motion** (must be toggled in OS settings).
8. **Memory.** Importing Reanimated costs roughly +25% Hermes memory on RN 0.85+. Matters on low-end
   Android; the documented workaround (Worklets Bundle Mode) is experimental and deliberately not
   used.

### Judgement calls made during implementation

- **Stagger was not applied to rows inside a single card** (`SettingsList`, `AccountMenuCard`,
  Notifications toggles) even though those were on the original list. Rows inside one clipped,
  bordered card read as jitter rather than sequence, and the card already animates in with the
  screen transition. Applied instead to discrete cards: bookings, services, quick actions, FAQs.
- **No `FlatList` conversion.** Every list is 3–10 bounded items inside a shared scroller with
  heterogeneous siblings; converting would mean a VirtualizedList nested in a ScrollView (which RN
  warns about and which breaks scrolling) for no measurable gain at this size.
- **`@gorhom/bottom-sheet` was not used.** Both sheets are non-modal, always-visible and in-screen —
  no backdrop, portal, keyboard avoidance or dynamic sizing — so it would have been ~15% of a
  library plus a new provider, against a visible trail of open Reanimated-4 regressions. The cost
  accepted in exchange is that we own the scroll/pan handoff (see item 3 above).
- **Crossfades are entering-only, never `exiting`.** An exiting layer stays in flow while it fades,
  so the container briefly holds both and the page jumps. Because the skeletons mirror the loaded
  geometry, fading the arriving layer in already reads as a crossfade.

### Do not regress

- `packages/ui` must never import an animation library. It is consumed as TypeScript source and
  compiled by **both** apps, so any such import breaks TowPartner's bundle immediately. Use the
  slots: `PressableSlot.tsx` for press behaviour, `Screen`'s `ScrollComponent` / `scrollProps` for
  scrolling.
- `useTabBarSpace()` and the TabBar's absolutely-positioned, background-free wrapper are unchanged
  and must stay so — that wrapper is the fix for the visible band across the foot of every screen.
  The sliding pill was added as an extra absolutely-positioned child *inside* the existing row.
- Motion tokens are excluded from `scaleTokens()`, exactly like `radii`. A scaled duration reads as
  lag, not as smaller.
- `useReducedMotion` must stay the `AccessibilityInfo`-listener version in `@towing/ui`, **not**
  Reanimated's hook of the same name, which is a snapshot taken at app start and does not re-render.
  Anything driven by React state (the tab scene animation, the Skeleton loop) depends on that.

### Two pre-existing config bugs found along the way (not fixed, not blocking)

- `package.json#pnpm.overrides` and `onlyBuiltDependencies` are **silently ignored by pnpm 11** —
  both moved to `pnpm-workspace.yaml`, and the lockfile confirms no `overrides:` block is applied.
- `.npmrc`'s `node-linker=hoisted` is also ignored by pnpm 11; the layout is genuinely *isolated*,
  not hoisted, and the comment claiming otherwise is wrong. **Do not "fix" this by switching to a
  hoisted linker** — the isolated layout is exactly what makes "installed in TowGo only" a real,
  build-enforced guarantee rather than a convention.

---

## Tab-transition ghosting — removed (after first on-device run)

The first real device run showed severe artifacts when switching tabs: two or three screens visible
through each other, and a grey wash over everything.

**Cause.** The custom `sceneStyleInterpolator` (`forDrift`) in `BottomTabs.tsx` faded the outgoing and
incoming scene at the same time. Bottom-tabs keeps every visited scene mounted, so mid-transition the
user was looking at a stack of semi-transparent screens — the Services headings were legible straight
through the Bookings list, and the blended whites read as grey. This is inherent to dissolving
between mounted, non-opaque scenes; no curve or duration fixes it.

Worth recording because it was misdiagnosed at first: it looked like the well-known Android
`elevation` + animated-opacity artifact, where shadows composite as hard grey blocks. It was not —
the theme's shadows are `elevation: 2` at `shadowOpacity: 0.05`, far too subtle for that, and the
giveaway was that the "grey blocks" contained readable text from the other screen.

**Fix.** `animation` is left unset on the tab navigator, which is v7's `'none'`. Scenes swap
instantly and never overlap, so the bug is gone by construction rather than tuned away. All
tab-change motion now lives in the pill in `TabBar.tsx`, which renders outside the scenes and
therefore cannot blend with them.

### Do not re-add a tab scene animation

Any `animation: 'fade'` / `'shift'`, or any custom `sceneStyleInterpolator` that touches `opacity`,
reintroduces this. If a tab transition is ever wanted again it must be transform-only over opaque
scenes, and it must be checked on a device — this class of bug is completely invisible to
`expo export` and to typecheck.

### Also removed, at the user's request

The list entrance stagger and the skeleton crossfade are gone: `motion/Stagger.tsx` and
`motion/useStagger.ts` deleted, the four `<Stagger>` and two `<Crossfade>` call sites unwrapped, and
the now-unused `stagger` group dropped from the motion tokens. Intent: content appears immediately,
and motion is reserved for things that respond directly to touch.

The FAQ accordion in `HelpCenterScreen` was deliberately kept. It is a response to a tap rather than
an entrance, its `LinearTransition` animates height rather than opacity, and its fade applies only to
the answer text.

### Skeleton is now a shimmer

`packages/ui/src/Skeleton.tsx` sweeps a gradient highlight instead of pulsing opacity, and finally
consumes `theme.colors.skeletonHighlight`, which had been defined and never used.

Two constraints govern that file and must keep holding:

- It is shared with the driver app, so it must **not** import Reanimated. It uses RN `Animated` with
  `useNativeDriver` on `translateX` only.
- The gradient uses `react-native-svg`, which both apps already ship; it was added to `packages/ui`'s
  peer and dev dependencies to make that dependency explicit rather than incidental.

The sweep distance is measured with `onLayout` because most call sites size skeletons in percentages,
so the travel cannot be derived from props.

### The inverse bug: `opacity` and `elevation` on the *same* node

Found by an adversarial review of the ghosting diagnosis above, and separate from it. Where the
tab-transition bug came from an *ancestor* animating alpha, this one comes from alpha sitting on the
very node that carries `elevation`.

The Android mechanism differs in an important way. With alpha on an ancestor, each caster's own
RenderNode alpha stays 1.0, so Skia treats it as opaque and culls the shadow underneath it — the
escaped shadow can only show as a rim outside the outline. With alpha on the *same* node the caster
alpha drops below 1, Skia sets the transparent-occluder flag, stops culling, and draws the full
shadow **including the part under the caster** — which is then visible through the faded surface.

Fixed at six sites, all press/disabled states:

- `packages/ui/src/Card.tsx` — dropped the press `opacity` entirely; `MotionPressable`'s `pressScale`
  already supplies the feedback, so it was redundant.
- `packages/ui/src/IconButton.tsx` — alpha is now scoped to the `plain` variant, which has no
  elevation. `surface` (the notifications bell) dims via `surface1` plus a tertiary glyph.
- `packages/ui/src/map/MapPreview.placeholder.tsx` — recenter FAB dims its glyph instead of itself.
- `apps/towgo/src/features/booking/components/TowTypeCard.tsx` — a disabled card trades its shadow
  for the fade, which is also more honest: a disabled card should not read as raised.
- `apps/towgo/src/features/booking/components/RadarPulse.tsx` — driver markers pop in by `scale`
  rather than fading, so the shadow never shows through during the 400 ms entrance.
- `apps/towpartner/src/features/dashboard/components/OnlineStatusCard.tsx` — **driver app**, and
  pre-existing rather than introduced by this work. It has no `MotionPressable`, so simply deleting
  the alpha would have left no press feedback; it dims by background colour instead.

The invariant is now documented at the top of `packages/theme/src/tokens/shadows.ts`, which is where
anyone reaching for a shadow will actually read it.

### Known, unfixed: first tap on a tab stalls

`lazy` defaults to `true` in bottom-tabs, so the first tap on Bookings, Services or Profile mounts
that entire screen synchronously. This is a genuine hitch, it predates the motion work, and nobody
had flagged it. `navigation.preload(name)` exists and would fix it, but it mounts `BookingsStack`
early and fires its data fetch on app open, which is a product decision rather than a technical one.
Left alone deliberately.

---

## Profile / Account screen — redesigned (superseded flat-list version)

> The flat hairline-list version described below was built, reviewed on device and **rejected**.
> It was replaced by the card-based dashboard documented at the end of this file. The reasoning
> about what was wrong with the ORIGINAL screen still stands and is why both redesigns happened.


Rebuilt as one flat list with inset hairline dividers, matching the Booking Details redesign, so the
app now has a single house style for dense screens instead of two.

**What was wrong.** `AccountMenuItem.subtitle` was a *required* field, so every row carried a second
line and stood ~97dp tall — and most subtitles just restated the title ("Payment Methods / Manage
cards and wallets"). The identity header put `numberOfLines={1}` on the email but not the phone, so
the email shipped a permanent ellipsis. Six static rows were expressed through four artefacts: a
66-line data file, an `AccountMenuItem` type, an 8-member id union, and a 19-line `routeFor` map —
indirection with no second consumer, and a live bug class where an id could exist with no route.

**Structure now:** identity row (avatar · name · phone · chevron, whole row tappable) → ACCOUNT
(Vehicles, Locations, Payments, Settings) → SUPPORT (Help Center, Contact Us) → Log Out → version.

### Decisions worth not re-litigating

- **`DetailRow` moved to `apps/towgo/src/components/`** from `features/bookings/`, because Profile
  must not import from another feature. It stayed app-local rather than going to `packages/ui`: it
  imports `@/icons` and `@/motion`, and `packages/ui` is compiled from source by the driver app and
  is deliberately free of both an icon and an animation library.
- **`Personal Information` is not a row.** The identity header is that entry point, with a chevron to
  the same route. Two rows to one destination is the same defect being removed elsewhere.
- **Notifications kept in Settings, removed from Profile.** It was in both. Keeping the Settings copy
  leaves the `Settings` row with its only live destination, and needs zero edits to `SettingsScreen`.
- **Log Out uses RN `Alert`, not the app's `BottomSheet`.** That sheet is documented as non-modal
  with no backdrop or portal; using it as a dialog means hand-building focus trapping and Android
  back handling, and its `elevation: 16` node would put a fading backdrop straight into the
  alpha-over-elevation invariant. The handler is a documented `TODO(auth)` — there is no auth stack
  to reset to yet.
- **Row labels are `body`/regular 14/20**, down from 15/medium. This is the shipped `DetailRow` style
  and matches iOS Settings and Google Account. If it ever reads thin, add a weight prop to
  `DetailRow` rather than forking it.

### `expo-constants` was added — and why that is safe

The version line reads `Constants.expoConfig?.version`, so it tracks `app.config.ts` instead of the
hardcoded `'1.0.0'` still sitting in `SettingsScreen.tsx`. `expo-constants` did **not** resolve from
`apps/towgo` before this (`MODULE_NOT_FOUND`), despite the assumption that it came in transitively.

It is safe because `expo@57.0.11` already lists `expo-constants@~57.0.9` as a hard dependency, so the
native module was **already autolinked into every build**. Adding it to `package.json` is purely a
module-resolution fix: one symlink, one lockfile entry, no native code, and nothing Expo Go can trip
over.

### Deleted

`AccountMenuCard.tsx` (a ~90% duplicate of `SettingsList` + `SettingsRow`), `LogoutButton.tsx`,
`ProfileHeader.tsx`, `data/accountMenu.data.ts`, the `AccountMenuItem`/`AccountMenuItemId` types, and
the screen-local `SectionHeading` that bypassed the type scale with a hardcoded `fontSize: 17`.

`SettingsList`/`SettingsRow` were **not** touched — seven sub-screens depend on them, and unifying
the three row primitives was explicitly out of scope.

### Still unverified

Nothing here has been seen on a device. Specifically worth checking: the large-title handoff on
Profile (new — it previously had no title), that the title stays optically centred now that both
`AppBar` slots are empty, and that the icon column and divider inset line up pixel-identically with
Booking Details at x=60.

---

## Profile / Account — final design (card dashboard)

The flat hairline list was rejected on sight. The replacement follows a Zomato/Swiggy-style
reference the user supplied: a dark hero, quick-action tiles, standalone status cards, and grouped
cards with an accent-bar heading.

### The content problem, and how it was resolved

The reference is carried by features TowGo does not have — Gold membership, offers, Favourites, a
wallet balance, a user rating, an OTA update check. Copying it literally would have meant six fake
rows that look right in a screenshot and are dead on tap. The user chose **real data only**, so every
number on the screen is computed from something that already exists:

| Slot in the reference | What TowGo shows | Source |
|---|---|---|
| "Gold member / 1 new offer" band | trips · vehicles · saved places, tapping through to Bookings | `useBookings()`, `vehiclesStore`, `savedLocationsStore` |
| "Favourites / Money" tiles | My Vehicles · Payments | real routes |
| "32% completed" badge | profile completion over six real signals | name/phone/email + ≥1 vehicle + ≥1 location + ≥1 payment method |
| "Your rating" badge | Notifications, "3 of 4 on" | `notificationPrefsStore` |
| "App update available" | Version line at the foot | `Constants.expoConfig.version` |

Nothing on the screen is a placeholder. The completion badge flips to a green "Complete" rather than
being hidden at 100%, so the row does not vanish once a user finishes.

### Two new colour tokens

`heroBg` and `heroBand` were added to `ColorTokens` and both themes. The hero needed a real dark
surface and borrowing `textPrimary` as a background would have been a lie about what that token
means. They are deliberately dark in **both** themes — this is a high-contrast feature block, not an
inverse-of-the-page surface, so it must not flip when dark mode eventually ships.

### Components

`features/account/components/ProfileHeroCard.tsx` — dark card, amber-ringed avatar, decorative
concentric rings (`react-native-svg`, `pointerEvents="none"`, clipped by `overflow: hidden`), and a
lighter band below. Identity block and band are **two separate `Pressable`s**, not one nested in the
other, because nested pressables are unreliable on Android and the band needs its own chevron.

`features/account/components/AccountCards.tsx` — `QuickTile`, `StatusCard`, `MenuGroup`, `MenuRow`.
`MenuGroup`'s `title` is optional so a lone destructive action can sit in a bare card with no
heading.

### Notes

- `DetailRow` stays at `apps/towgo/src/components/` (moved there during the flat-list attempt) and is
  still used by Booking Details. The `pressScale.row` fix made to it is kept; the `danger` prop added
  for the flat design was removed again once nothing used it.
- Log Out still uses RN `Alert` with a `TODO(auth)` handler — there is no auth stack to reset to.
- Every text node that can meet user data carries `numberOfLines` plus `minWidth: 0` on its flex
  column, so a long name ellipsises instead of pushing the chevron off the card. That was the
  original screen's bug and it must not come back.

### Unverified

Not seen on a device. Worth checking: contrast of `textTertiary` on `heroBg`, that the decorative
rings clip cleanly to the card radius at all widths, and that the two quick tiles stay equal width at
360dp.

---

## Driver app (TowPartner) — motion ported

The seam built for the customer app paid off: the driver app took the same motion system by mounting
one provider and rewriting one file. `packages/ui` was not touched at all.

### Skeleton shimmer was already done

`Skeleton` lives in `packages/ui` and the driver app compiles it from source, so the gradient sweep
built for TowGo has been rendering in TowPartner since that change landed — seven driver files
consume it (`HomeScreen`, `JobsScreen`, `NewJobScreen`, `EarningsScreen`, `ProfileScreen`,
`JobCard`, `OfferCard`). It deliberately uses RN `Animated` + `react-native-svg` rather than
Reanimated precisely so it worked here before Reanimated existed in this app. **Do not "upgrade" it
to Reanimated** — that would break nothing today but would silently re-couple `packages/ui` to an
animation library.

### Versions were aligned first, deliberately

The driver app was still on `expo ~57.0.6` / `rn 0.86.0` / `screens 4.25.2` — the exact skew that
crashed TowGo in Expo Go once native modules were added. `expo install --fix` ran **before**
Reanimated went in, so the resolved reanimated/worklets versions match the SDK patch Expo Go ships.
Both apps are now identical: expo `~57.0.11`, RN `0.86.2`, screens `4.26.2`, reanimated `4.5.1`,
worklets `0.10.1`.

### The tab bar needed a different solution

TowGo's bar has equal-width flex tabs, so its chip only animates `translateX` at a constant width.
The driver bar's chips **hug their label**, so the chip animates width as well as position and each
tab reports its measured size via `onLayout`. Two consequences worth remembering:

- The **semibold** label is the copy in flow, so the measured width is the widest state. Measuring
  the medium copy would leave the chip visibly tight around the selected tab — the same class of bug
  that truncated TowGo's tab labels.
- The chip hides when the centre FAB tab is selected. The FAB is its own indicator; a chip parked
  under it would read as a second one.

Animating `width` is normally something to avoid, but it is one small view and the alternative
(`scaleX` on a fixed width) would squash the pill's round ends into ellipses.

### Free fix: JobCard finally has press feedback

`JobCard` renders `<Card onPress>`, and `Card` has been passing `pressScale` through the seam all
along — but with no provider mounted the driver app got `DefaultPressable`, which **drops
`pressScale` and `haptic`**. So JobCard had no press feedback at all. Mounting the provider fixed
that without touching the component.

### Also corrected

The FAB's press feedback was `opacity` on an ancestor of a node carrying `elevation: 6` — the
alpha-over-elevation case documented in `shadows.ts`, where the shadow refuses to fade with its
owner. It now scales instead. `SectionHeading` and `FilterTabs`, which previously had **no** press
feedback of any kind, now get it from the shared primitive.

Background-swap press states (`MenuRow`, `OnlineStatusCard`, `OfferCard` decline, `JobsScreen`
filter) were deliberately kept — they sit on elevated nodes where alpha is wrong, and colour is the
correct way to dim those.

### Not ported

`useCollapsingHeader` and `BottomSheet` were left in TowGo. The driver app has no collapsing header
(its screens do not use `Screen`'s `header` slot) and no map sheet, so porting them would be dead
code. Both are a copy away if a driver screen ever needs them.

Tab scene transitions are **off** in the driver app too, with the reasoning recorded in
`BottomTabs.tsx` so nobody re-adds the cross-dissolve that produced the grey wash in TowGo.

### Label wrapping — fixed (pre-existing, not introduced by the motion work)

The driver tab labels shipped wrapped: "Earni/ngs" and "Profil/e". The cause is arithmetic, and it
predates the motion port — the original bar had `paddingHorizontal: 14` inside the chip and **no**
`numberOfLines` on the label.

The bar is `width - 2*H_MARGIN` split five ways: 70dp a slot at the 390dp reference. Fourteen each
side left 42dp of text width, and "Earnings" at 12dp semibold needs ~48dp. It wrapped at every
screen width.

Two changes, both needed:

- **Content padding 14 → 4**, so the text actually fits. Verified: 44dp needed against 56dp
  available at 360dp, 48 against 62 at 390, 51 against 70 at 430.
- **`numberOfLines={1}` on both label copies**, so the failure mode can never be a wrap again. If a
  future label really is too long it truncates, which is visible and obviously wrong, rather than
  silently growing the bar.

The chip also became **slot-derived rather than content-derived** as part of this. A chip that hugs
its label has to be at least as wide as the label, and there is not enough room in a fifth of the bar
for that. Slot-derived means only `translateX` animates (no width animation, so the pill's round
ends cannot distort), and no label can squeeze the chip.

### Unverified

Not run on a device. Specifically: that the chip settles cleanly under each tab, that it stays hidden
while the FAB tab is selected, and that the notch SVG still lines up now that the chip renders behind
the tab row.

### Driver bar shadow — drawn in SVG, not by `elevation`

The driver bar had iOS-only shadow props and **no `elevation`**, so on Android it cast no shadow at
all while the customer pill did. Values are now matched to the customer bar: offset 0/4, black at
0.08, blur radius 14 (as `stdDeviation: 7`, roughly half an RN blur radius).

It could not simply take `elevation`. Android derives an elevation shadow from the view's *outline* —
a rectangle, or a rounded rect when `borderRadius` is set — and this bar is an SVG path with a
circular notch cut out of it. An outline-derived shadow would trace the wrong silhouette and cast
straight across the notch where the FAB sits. The customer bar can use `elevation` precisely because
it really is a plain rounded rect.

So the shadow is a `<Filter><FeDropShadow/></Filter>` applied to the path itself, which operates on
the rendered geometry and therefore includes the notch. Two details that matter:

- **The canvas is padded by `SHADOW_PAD` (24) on every side** and the wrapper offset by the same
  amount, because a blur bleeds outside the path's bounding box and would otherwise be clipped flat
  at the bar's edges. `barPath()` now takes an origin so the shape can be inset into the larger
  canvas; the bar still lands at exactly `left: 0, top: STRIP` in the parent's coordinates.
- **The filter region is set to `-25% / 150%`.** The SVG default is 110% of the bounding box, which
  would cut a 7px blur off.

One path produces both bar and shadow — `FeDropShadow` emits the shadow beneath its source — so the
two cannot drift apart.

`react-native-svg@15.15.4` ships all five native primitives `FeDropShadow` decomposes into
(`FeGaussianBlur`, `FeOffset`, `FeFlood`, `FeComposite`, `FeMerge`) on **both** Android and iOS;
verified in the package's own native source. The View's old iOS-only shadow props were removed so
iOS does not end up with two shadows.

**Fallback if the filter turns out not to render:** put `borderRadius: RADIUS` + `elevation: 8` back
on the wrapper View and accept a rounded-rect silhouette. The FAB's own `elevation: 6` covers the
notch area, so the mismatch is less visible than it sounds.

### Bottom scrim — the Uber effect, and how it differs from the bar shadow

These are two separate things and the first attempt conflated them.

- **Bar shadow** (previous section) — a drop shadow cast *by* the bar, so the pill reads as floating
  above the page. Both apps now have one.
- **Bottom scrim** (this section) — a vertical fade rising from the bottom edge of the screen to a
  little above the bar, so content scrolling *behind* the floating bar dissolves into the page
  background instead of hard-cutting at the bar's edge. This is the effect visible in Uber, where a
  heading part-way under the nav is already faded out.

`packages/ui/src/BottomScrim.tsx` is shared by both apps. It draws with `react-native-svg`, already a
dependency of both, rather than adding `expo-linear-gradient` for a single gradient.

Two things that matter:

- **The stops are non-linear** (0 / 0.35 / 0.65 / 1 at opacity 0 / 0.35 / 0.8 / 1). A straight ramp
  leaves the scrim's top edge visible as a faint horizontal band; holding the opacity low through the
  first third makes the start of the fade impossible to locate.
- **Both tab bars were restructured** so the scrim can be full-bleed. Their roots were inset by
  `H_MARGIN` (16 customer, 20 driver); the root is now full-width at `bottom: 0` with the scrim as a
  sibling of an inner, still-inset bar. The roots stay `pointerEvents="box-none"` and the scrim is
  `pointerEvents="none"`, so nothing new intercepts touches.

Scrim height is `barBottom + barHeight + 32` — the 32 is the fade reaching above the bar. It fades to
`theme.colors.surface0`, which is what `Screen` paints by default on every tab screen in both apps.

### Unverified

Neither the bar shadow nor the scrim has been seen on a device. For the scrim specifically: that its
top edge is genuinely invisible against a scrolling list, and that the fade target still matches on
any screen that overrides `Screen`'s `background` prop (none do today).

### Driver chip — it was an aspect-ratio problem, not a radius problem

Third and final pass. The first two attempts both changed the corner radius and both failed, because
the radius was never the defect.

A stadium radius makes the two ends semicircles of half the height, leaving width minus height of
straight edge in the middle. Run that on both bars:

- **Customer chip** 81 x 54 -> 27dp straight across 81dp of width. A third of the outline is flat, so
  it reads as a proper pill. That is why nobody ever complained about it.
- **Driver chip** 60 x 51 -> 9dp straight across 60dp. 85% of the outline is the two round ends, so it
  renders as an ellipse.

Same radius rule, opposite result, purely because of the proportions. No radius value fixes a wrong
aspect ratio, which is why 0.38 read as square and reverting to a stadium brought the oval back.

The reference sidesteps it by making the chip **square** (~69 x 68) and using a modest radius (~0.29
of height). So the fix is two constants, in this order:

- `CHIP_PAD_V` 6 → 10, making the chip 60 × 59 at 390dp: aspect 1.02 against the reference 1.01.
- radius `chipHeight / 2` → `Math.round(chipHeight * 0.29)` = 17dp, derived from the measured height
  so it survives OS font scaling.

Straight edge goes 9dp -> 26dp. That single number is what decides ellipse versus rounded rect.

The chip does not go all the way to the reference 76% of bar height: our bar has five slots to their
four, so the chip is only 60dp wide, and a 67dp height would make it portrait. 59 keeps it square,
which matches the reference *shape* even though it fills slightly less of the bar.

**The customer bar is deliberately untouched** — aspect 1.50 there means a stadium is correct.

---

### Driver bar + chip roundness — REVERTED and corrected

> The "rounded rect at 0.38" experiment below was **wrong and has been undone**. It was measured off
> an Uber screenshot rather than off this product design. Kept only as a record of what not to redo.

**Corrected values:** chip is a stadium again (`chipHeight / 2`), and the bar radius went 26 → 40.

Measuring the two renders side by side: the design reference has an outer corner radius of ~0.46 of
the bar height, ours was 0.30 (`RADIUS 26` on `BAR_H 88`). So the bar was already visibly squarer
than the design, and squaring the chip on top of that made the whole control read as boxy. 40 is
0.45 of the height, matching the reference; 44 would be a full stadium.

**The lesson worth keeping:** when the product has its own design render, measure against that, not
against whatever third-party app was last used as inspiration. The Uber comparison was a reasonable
source for *motion*; it was the wrong source for *shape*.

---

### Driver chip corner radius — rounded rect, not a stadium

The active chip used `borderRadius: 9999`. At five slots it is only ~60dp wide against ~51dp tall, so
a stadium radius rounded it into an **oval** rather than a button — clearly visible on the "Jobs" tab.

It now derives from the measured height: `Math.round(chipHeight * 0.38)`, giving 18 / 19 / 21dp at
360 / 390 / 430dp against a stadium's 24 / 26 / 27. The 0.38 was measured off the Uber reference,
where the active pill keeps visible straight edges along the top and bottom of its ends.

Deliberately scoped to the driver chip. The customer chip is much wider than it is tall so its
stadium radius does not read as an oval, and the customer *bar*'s pill shape was specifically
requested ("Footer layout and shape like this!"). The driver bar's own radius of 26 on 88dp is
squarer than Uber's ~0.40 and was left alone because it is marked as Figma-derived geometry
(`62:175`) — worth revisiting with the designer rather than silently changing.

---

## Driver dashboard — availability toggle now slides

`features/dashboard/components/OnlineStatusCard.tsx`. The Go Offline / Go Online control was a static
pill; it is now a switch whose gold knob springs between the two ends of the track, with the two
labels crossfading and sliding the opposite way.

**Direction:** Online parks the knob **left**, going offline slides it **right**. This matches the
design render, and was chosen over the more conventional "knob position = state" (online right) after
asking — the render was treated as authoritative.

### Why the label moves too

Laid out online the track is `[inset][knob][gap][label][padEnd]`; offline it becomes
`[inset][padEnd][label][gap][knob]`. So the label's left edge shifts by a **constant**
`PAD_END - KNOB - GAP` = -32, and only the knob's travel needs the measured track width. At the
reference width that is a 136dp track, 90dp of knob travel, and the 10dp knob-to-label gap is
preserved on both sides.

### Two details that keep it stable

- **"Go Offline" is the copy in flow**, "Go Online" is overlaid and crossfaded. "Go Offline" is the
  wider string, so it sets the track width. Sizing to whichever label is currently showing would make
  the track resize as it toggles, which would change the knob's travel *mid-animation*.
- **The knob is absolutely positioned** with a same-width spacer holding its slot in the row. It has
  to be able to cross the label, which an in-flow child cannot do.

First commit adopts the current state without animating, via a `settled` ref — otherwise a driver who
is already offline would watch the knob slide across on every mount.

Reduce-motion needs no handling: `withSpring` honours `ReduceMotion.System` and jumps to the end.

### Also changed

- Knob icon `Power` → **`RadioTower`** (added to the driver icon barrel), matching the render. It also
  says the right thing — going online is broadcasting availability, not switching a device on.
- Truck illustration 42% → 46% width. That narrows the copy column so "You will receive / new tow
  requests" wraps on the same word as the render; at 42% it wrapped a word later.

The pressed state stays a **background-colour swap, not alpha** — the track carries `shadows.card`,
and alpha on an elevated node lets the shadow show through it.

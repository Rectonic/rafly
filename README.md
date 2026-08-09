# LastBite Mobile

Expo/React Native mobile app for the LastBite buyer marketplace and seller pickup workflow.

## Current QA Status

The app launches on iOS Simulator from a no-space path such as `/tmp/lastbite-mobile-clean`.
The Desktop workspace path contains `Useful Materials`, which can make some native and Node tools hang while resolving files. Use the clean path for simulator/Xcode verification on this machine.

Two simulator launch paths are verified:

- Debug preview: keep Metro running while launching the Debug app.
- Standalone preview: install the Release simulator build, which embeds `main.jsbundle` and launches without Metro.

Native iOS UI automation is also wired into the `LastBite` scheme. The current Release simulator UI tests cover buyer feed filtering, Favorites add/remove, offer-card navigation, reservation, pickup-code rendering, reservation-history recovery, pickup reminder status rendering, buyer tab navigation to settings, seller auth entry, an authenticated restaurant seller surface smoke test with setup-checklist and cancelled-order selectors, and a guarded shop Inventory intake/scanner-modal smoke test.

The authenticated seller simulator passes use guarded local E2E seller profiles. They verify routing/rendering/tap-through without a real Supabase seller session, so production seller auth, mutations, inventory CRUD, and backend policies still need real-environment QA before public launch.

Launching an installed Debug app with `simctl` after Metro is stopped can show React Native's `No script URL provided` red screen because Debug apps are not standalone bundled builds.

Physical iPhone build status has also been probed from `/tmp/lastbite-mobile-clean`:

- `npm run pods:ios:device` succeeds with ML Kit/OCR pods linked.
- A signed generic `iphoneos` Release build succeeds when using a temporary team-owned bundle ID override, `com.boiskhonkattakhodjaev.lastbite.dev`.
- The built app contains `main.jsbundle`, OCR resource bundles, `RNMLKitTextRecognition`, and an Apple Development signature for team `NU65C8BNDH`.
- Direct install/run on the paired iPhone is still blocked until the device is unlocked; CoreDevice reports `kAMDMobileImageMounterDeviceLocked` while mounting the developer disk image.
- The committed bundle ID `com.lastbite.app` is not currently provisioned for this Apple team, so production signing needs the correct Apple team/profile or a team-owned bundle identifier.

Backend validation status:

- No real Supabase `.env` is present; only `.env.example` exists.
- Supabase CLI is installed, but local Supabase startup is currently blocked by Docker Desktop/containerd storage state. After freeing disposable Xcode DerivedData from `/tmp`, `supabase start` still fails while pulling Postgres with a containerd metadata write error, and `docker pull hello-world` does not complete cleanly after a Docker restart.
- Production-like seller auth, seller mutations, inventory CRUD, and reservation lifecycle QA still require either working local Supabase containers or real Supabase project credentials.

Latest QA report:

- `docs/mobile-qa/2026-05-27-lastbite-mobile-qa-report.md`

Latest verified standalone Release simulator screenshot:

- `docs/mobile-qa/artifacts/2026-05-27-xcuitest/launch-icons/buyer-feed-multilingual-seed.png`
- 2026-05-28 follow-up buyer-feed screenshot: `docs/mobile-qa/artifacts/2026-05-28-followup/buyer-feed-current.png`
- 2026-05-28 arm64 post-fix buyer-feed screenshot: `docs/mobile-qa/artifacts/2026-05-28-followup/buyer-feed-post-fix-arm64.png`
- 2026-05-28 Phase 1 buyer reservation-history screenshot: `docs/mobile-qa/artifacts/2026-05-28-phase1/buyer-reservation-history.png`
- 2026-05-28 Phase 2 multilingual feed screenshot: `docs/mobile-qa/artifacts/2026-05-28-phase2/app-feed-after-launch.png`
- 2026-05-28 Phase 2 multilingual Settings screenshot: `docs/mobile-qa/artifacts/2026-05-28-phase2/settings-language-ru-app.png`
- 2026-05-28 Phase 3 product-detail screenshot: `docs/mobile-qa/artifacts/2026-05-28-phase3/product-detail-sections.png`
- 2026-05-28 Phase 4 radius discovery screenshot: `docs/mobile-qa/artifacts/2026-05-28-phase4/buyer-radius-filtered-discovery.png`
- 2026-05-28 Phase 4 map-tap selected-card screenshot: `docs/mobile-qa/artifacts/2026-05-28-phase4/buyer-map-selected-after-location-tap.png`
- 2026-05-28 Phase 5 pickup reminder screenshot: `docs/mobile-qa/artifacts/2026-05-28-phase5/buyer-pickup-reminder-scheduled.png`
- 2026-05-28 Phase 6 reliability smoke screenshots: `docs/mobile-qa/artifacts/2026-05-28-phase6/xcresult-smoke/`
- 2026-05-28 Phase 7 seller experience screenshots: `docs/mobile-qa/artifacts/2026-05-28-phase7/xcresult-seller/`

Latest 2026-05-28 UI/language fix:

- Product/offer detail now has a close button.
- Buyer offer detail, reservation copy, map callouts, and offer prices now use the i18n/locale layer instead of mixed English/Russian copy.
- Verified from `/tmp/lastbite-mobile-clean` with focused Jest, full Jest, ESLint, TypeScript, an arm64 Release simulator build/install/launch, and native UI test `LastBiteUITests/testBuyerOfferDetailCloseButtonFlow` passing on `LastBite Release Current iPhone 17`.

Latest Phase 1 reservation-history work:

- Buyer tabs now include a Reservations screen with active, completed, cancelled, and expired filters.
- Successful reservations are persisted to local reservation history immediately; raw pickup codes are stored in SecureStore when available, with a private AsyncStorage fallback for entitlement-less simulator builds. The reservation metadata payload keeps only the final code digits.
- Product detail writes successful reservations into the shared history store and prevents duplicate active reservations for the same offer.
- Seller-backed reservations degrade to recoverable local reservations when Supabase sync is unavailable, instead of losing the pickup code during network/configuration interruptions.
- Focused Phase 1 regression coverage passes in `/tmp/lastbite-mobile-clean`: 5 suites, 18 tests. The full JS suite passes with 33 suites and 92 tests.
- Native Release simulator UI test `LastBiteUITests/testBuyerReservationHistoryRecoveryFlow` passes on `LastBite Release Current iPhone 17`, validating reserve, close/back navigation, Reservations tab rendering, and pickup-code recovery.
- The current Phase 1 implementation is device-local for buyer recovery. Production still needs the reservation RPC described below before public launch.

Latest 2026-05-28 map alignment fix:

- Buyer feed map now renders inside a stable rounded frame while the native map layer absolute-fills that frame.
- Map markers now use a fixed 48 px touch frame with centered anchors, so tapping a location selects the related offer without shifting the marker geometry.
- Map callouts now use an explicit mobile width so longer Russian offer names do not collapse into narrow word-by-word wrapping.
- Selected offer cards now expose a native selected accessibility state, which lets XCTest verify map-tap selection without relying on map callout rendering.
- Focused map/feed regression coverage passes with `npm test -- --runInBand offers-map buyer-feed-screen`, and the full JS suite passes with 33 suites and 94 tests.
- Native Release simulator UI test `LastBiteUITests/testBuyerMapLocationTapSelectsVisibleOffer` passes on `LastBite Release Current iPhone 17`.
- Latest retained simulator screenshot: `docs/mobile-qa/artifacts/2026-05-28-map-fix/buyer-feed-map-aligned.png`.
- Native before/after tap screenshots are exported under `docs/mobile-qa/artifacts/2026-05-28-map-fix/xcresult-attachments/`.

Latest Phase 2 multilingual work:

- Settings now exposes an in-app language switcher; buyer UI text updates between English and Russian without restarting the app.
- Seller profiles and seller-created offers now support structured localized content through `translations` payloads. Seller profile translations cover business name, category, and address; offer translations cover title, restaurant display name, address, and contents text.
- The seller create-offer and profile screens include English/Russian content fields, and published seller offers are localized before rendering in Feed, Favorites, and offer detail.
- Supabase schema now declares `seller_profiles.translations` and `seller_offers.translations` as JSONB columns with empty-object defaults. The migration still needs to be applied and validated against the real Supabase project.
- Focused Phase 2 regression coverage passes in `/tmp/lastbite-mobile-clean`: localized offers, meal package form, buyer feed localization, and dynamic locale provider tests. Full JS validation passes with 34 suites and 98 tests.
- Native Release simulator UI test `LastBiteUITests/testBuyerSettingsLanguageSwitchUpdatesVisibleCopy` passes on `LastBite Release Current iPhone 17`, validating Settings language switching in the built app.
- Retained screenshots show the Russian buyer feed and Settings switcher after launch. The earlier `settings-language-ru.png` artifact captured the iOS home screen after XCTest teardown and should not be used as app evidence.

Latest Phase 3 product-detail work:

- Product detail now renders structured sections for contents, pickup instructions, dietary badges, allergens, and cancellation/refund policy.
- Seed offer localization includes Russian product-detail metadata, so longer translated strings render in the actual product page without layout overlap.
- Seller-created offers now have a typed metadata path for `pickupInstructions`, `dietaryBadges`, `allergens`, and `cancellationPolicy`. The seller package form can capture these fields, the seller store inserts them, marketplace mappers preserve them, and the buyer detail page renders them when present.
- Supabase schema now declares `seller_offers.allergens`, `seller_offers.dietary_badges`, `seller_offers.pickup_instructions`, and `seller_offers.cancellation_policy`. The migration still needs to be applied and validated against the real Supabase project.
- Focused Phase 3 regression coverage passes in `/tmp/lastbite-mobile-clean`: offer detail, seller meal package form, marketplace mapper, and seller screen error tests. Full JS validation passes with 34 suites and 100 tests.
- Native Release simulator UI test `LastBiteUITests/testBuyerOfferDetailCloseButtonFlow` passes on `LastBite Release Current iPhone 17`, validating the product sections and close/back affordance in the built app.

Latest Phase 4 map/discovery work:

- Buyer discovery now has radius filters for 1 km, 3 km, 5 km, and all distances.
- The Near Me action requests device foreground location through `expo-location`, sorts nearby offers by distance, and falls back to saved offer distances when permission is denied or unavailable.
- The feed/map filtering path uses real haversine distance when coordinates are available and keeps a text-distance fallback for seeded or offline data.
- The map includes a user-location marker when permission succeeds, and its initial region includes the user/focus point so the map and list stay in the same discovery context.
- Tapping a map marker selects the matching offer card and scrolls it into view with safe-area-aware clipping. The shared `ScreenScrollView` viewport now starts below the top safe area instead of letting scrolled content render under the status area.
- Focused Phase 4 regression coverage passes in `/tmp/lastbite-mobile-clean`: filters, map region, map rendering, buyer feed, and safe-area scroll tests. Full JS validation passes with 34 suites and 109 tests.
- Native Release simulator UI tests `LastBiteUITests/testBuyerDiscoveryRadiusControlsFilterVisibleOffers` and `LastBiteUITests/testBuyerMapLocationTapSelectsVisibleOffer` pass on `LastBite Release Current iPhone 17`, validating radius filtering, map layout, and marker-to-card synchronization in the built app.

Latest Phase 5 pickup reminder work:

- Buyer reservations now schedule local pickup reminders before the pickup window expires through `expo-notifications`.
- Reminder metadata is persisted with reservation history and survives app relaunches; fulfilled, cancelled, and expired reservations cancel pending reminder records.
- Notification taps route back to the Reservations screen, and foreground notification behavior is configured at app startup.
- The reservation confirmation and reservation-history cards show localized reminder status, including permission failure or scheduling failure states.
- E2E simulator validation uses a deterministic mock reminder mode so Release UI tests are not dependent on OS notification delivery timing.
- Focused Phase 5 regression coverage and full JS validation pass in `/tmp/lastbite-mobile-clean`; the latest full suite is 35 Jest suites and 119 tests, with `npx tsc --noEmit` and `npm run lint` also passing.
- Native Release simulator UI test `LastBiteUITests/testBuyerPickupReminderStatusFlow` passes on `LastBite Release Current iPhone 17`, validating reservation creation, Reservations tab rendering, recoverable pickup code, and scheduled reminder status in the built app.

Latest Phase 6 reliability work:

- Buyer discovery now preserves stale seller-published offers when live marketplace refresh fails, surfaces localized inline loading/error states, and keeps seed discovery usable with a retry action.
- Seller-backed reservation sync now has timeout protection, persisted `syncError` metadata, and a retry path that rebuilds the seller pickup order from the secure local pickup code.
- Offer detail now shows a retryable failed-sync panel for recoverable reservations instead of only generic local/demo copy.
- Seller orders now catch thrown load failures, keep a retryable error state separate from empty state, and disable manual/card verification while pickup verification is in flight.
- Seller Inventory and Create Offer screens now consume store loading/error state, render retryable failed states, and show empty states for tracked stock and published offers.
- Offer detail now includes a localized `View reservation` action from the confirmation panel so buyers with an existing secure-code reservation can jump directly to reservation history for code recovery.
- Focused Phase 6 regression coverage passes in `/tmp/lastbite-mobile-clean`: 10 suites and 50 tests. Full JS validation passes with 36 Jest suites and 132 tests, with `npx tsc --noEmit` and `npm run lint` also passing.
- Native Release simulator smoke passes on `LastBite Release Current iPhone 17`: `testBuyerOfferDetailCloseButtonFlow`, `testBuyerDiscoveryRadiusControlsFilterVisibleOffers`, and `testBuyerPickupReminderStatusFlow` all pass with `passedTests: 3`, `failedTests: 0`, `totalTestCount: 3`.

Latest Phase 7 seller-experience work:

- Seller dashboard now includes a setup checklist that guides restaurants toward profile completion, first package publication, and first verified pickup; shop sellers get the equivalent inventory-first checklist.
- Seller orders now include a Cancelled segment, localized lifecycle labels, visible status badges, normalized manual pickup-code entry, and accessibility selected states on the status filters.
- Pickup verification now updates only pending seller orders and returns a clear error when the order has already been handled.
- Focused Phase 7 regression coverage passes in `/tmp/lastbite-mobile-clean`: 3 suites and 12 tests. Full JS validation passes with 36 Jest suites and 135 tests, with `npx tsc --noEmit` and `npm run lint` also passing.
- Native Release simulator seller smoke passes on `LastBite Release Current iPhone 17` with `passedTests: 1`, `failedTests: 0`, `totalTestCount: 1`. During validation, the long multilingual seller profile pushed the buyer-mode switch below the initial viewport; the XCTest now scrolls before interacting with that bottom action.

Latest Phase 8 reservation lifecycle hardening:

- Buyer cancellation of a synced seller-backed reservation now attempts to mark the matching pending seller pickup order as `cancelled` in Supabase, matching on seller id, offer id, secure pickup code, and `pending` status.
- The buyer reservation remains locally cancelled even when seller-status sync fails, and the reservation keeps a failed sync state/error so the problem is visible instead of silently diverging.
- Focused Phase 8 regression coverage passes in `/tmp/lastbite-mobile-clean`: `__tests__/reservations.test.ts` and `__tests__/reservations-store.test.tsx` pass with 15 tests. Full JS validation passes with 36 Jest suites and 138 tests, with `npx tsc --noEmit --pretty false` and `npm run lint` also passing.
- Native UI was not rerun for Phase 8 because this slice changes shared lifecycle data handling rather than visible navigation/layout; the latest Phase 7 seller smoke remains the current native seller UI validation.

Latest Phase 9 seller order freshness polish:

- Seller Orders now records the timestamp of the latest successful order refresh and shows a localized "last refreshed" label on the Orders screen.
- This makes manual-refresh seller workflows clearer while realtime/polling remains a production follow-up.
- Focused Phase 9 regression coverage passes in `/tmp/lastbite-mobile-clean`: `__tests__/orders-store.test.tsx` and `__tests__/orders-screen.test.tsx` pass with 9 tests. Full JS validation passes with 36 Jest suites and 140 tests, with `npx tsc --noEmit --pretty false` and `npm run lint` also passing.

Latest Phase 10 server-owned reservation lifecycle work:

- Seller-backed reservation creation now uses the Supabase RPC `reserve_seller_offer` instead of direct public `pickup_orders` inserts.
- The RPC contract atomically validates that an offer is published and available, decrements `seller_offers.quantity_available`, marks offers `sold_out` when the last unit is reserved, creates the pickup order, and returns the pickup order id plus remaining quantity.
- Reservation retry is idempotent by pickup code: if the order already exists for the same offer, the RPC returns the existing order without decrementing quantity again.
- Buyer cancellation now uses `cancel_seller_reservation`, which only cancels pending orders, restores quantity once, and republishes a previously sold-out offer when inventory returns.
- The public direct pickup-order insert policy is dropped in `supabase/schema.sql` and the new migration `supabase/migrations/20260529000000_reservation_lifecycle_rpcs.sql`; anon/auth clients execute the lifecycle RPCs instead.
- Focused Phase 10 regression coverage passes in `/tmp/lastbite-mobile-clean`: `__tests__/reservations.test.ts` and `__tests__/supabase-reservation-lifecycle-schema.test.js` pass with 10 tests. Full JS validation passes with 37 Jest suites and 142 tests, with `npx tsc --noEmit --pretty false` and `npm run lint` also passing.
- Real Supabase migration application and backend E2E are still required before calling this production-verified.

## Setup

```sh
npm ci
node scripts/fix-expo-constants-podspec.mjs
```

## iOS Simulator

Simulator builds intentionally disable iOS ML Kit autolinking because the current OCR dependency ships a device-only framework slice that cannot link into an arm64 simulator build.

```sh
npm run pods:ios:sim
npm run ios:sim
```

Verified fallback launch path:

```sh
LASTBITE_DISABLE_IOS_MLKIT=1 xcodebuild -quiet \
  -workspace ios/LastBite.xcworkspace \
  -scheme LastBite \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath /tmp/lastbite-sim-dd \
  CODE_SIGNING_ALLOWED=NO \
  ONLY_ACTIVE_ARCH=YES \
  ARCHS=arm64 \
  EXCLUDED_ARCHS=x86_64 \
  COMPILER_INDEX_STORE_ENABLE=NO \
  build

EXPO_NO_INTERACTIVE=1 npx expo start --localhost --clear --port 8081
xcrun simctl install <device-udid> /tmp/lastbite-sim-dd/Build/Products/Debug-iphonesimulator/LastBite.app
xcrun simctl launch <device-udid> com.lastbite.app
```

Use `npm run ios:sim` for the normal Expo path; it starts Metro for the Debug build.

Standalone Release simulator launch:

```sh
LASTBITE_DISABLE_IOS_MLKIT=1 xcodebuild -quiet \
  -workspace ios/LastBite.xcworkspace \
  -scheme LastBite \
  -configuration Release \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath /tmp/lastbite-sim-release-dd \
  CODE_SIGNING_ALLOWED=NO \
  ONLY_ACTIVE_ARCH=YES \
  ARCHS=arm64 \
  EXCLUDED_ARCHS=x86_64 \
  COMPILER_INDEX_STORE_ENABLE=NO \
  build

xcrun simctl install <device-udid> /tmp/lastbite-sim-release-dd/Build/Products/Release-iphonesimulator/LastBite.app
xcrun simctl launch <device-udid> com.lastbite.app
```

OCR is expected to show an unavailable message on simulator.

## Physical iPhone / OCR

Use the device pod path so ML Kit remains linked:

```sh
npm run pods:ios:device
npm run ios
```

Current verified physical-build command, using a temporary bundle ID override for this local Apple team:

```sh
xcodebuild -quiet \
  -workspace ios/LastBite.xcworkspace \
  -scheme LastBite \
  -configuration Release \
  -sdk iphoneos \
  -destination 'generic/platform=iOS' \
  -derivedDataPath /tmp/lastbite-device-generic-unique-dd \
  -allowProvisioningUpdates \
  CODE_SIGN_STYLE=Automatic \
  DEVELOPMENT_TEAM=NU65C8BNDH \
  PRODUCT_BUNDLE_IDENTIFIER=com.boiskhonkattakhodjaev.lastbite.dev \
  ONLY_ACTIVE_ARCH=NO \
  COMPILER_INDEX_STORE_ENABLE=NO \
  build
```

Camera, barcode scanning, OCR runtime behavior, photo-library permissions, and TestFlight/App Store readiness still require install/launch on an unlocked physical iPhone.

## Validation

Use `/tmp/lastbite-mobile-clean` for final local validation on this machine:

```sh
npm run lint
npm run typecheck
npm test -- --runInBand
npm run pods:ios:sim
```

Targeted native UI workflow validation:

```sh
LASTBITE_DISABLE_IOS_MLKIT=1 xcodebuild -quiet \
  -workspace ios/LastBite.xcworkspace \
  -scheme LastBite \
  -configuration Release \
  -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,id=<device-udid>' \
  -derivedDataPath /tmp/lastbite-ui-test-dd \
  CODE_SIGNING_ALLOWED=NO \
  ONLY_ACTIVE_ARCH=YES \
  ARCHS=arm64 \
  EXCLUDED_ARCHS=x86_64 \
  COMPILER_INDEX_STORE_ENABLE=NO \
  -only-testing:LastBiteUITests/LastBiteUITests \
  test
```

Authenticated seller simulator smoke test:

```sh
EXPO_PUBLIC_LASTBITE_E2E_LOCAL_SELLER=1 LASTBITE_DISABLE_IOS_MLKIT=1 xcodebuild -quiet \
  -workspace ios/LastBite.xcworkspace \
  -scheme LastBite \
  -configuration Release \
  -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,id=<device-udid>' \
  -derivedDataPath /tmp/lastbite-ui-test-dd-e2e-seller \
  CODE_SIGNING_ALLOWED=NO \
  ONLY_ACTIVE_ARCH=YES \
  ARCHS=arm64 \
  EXCLUDED_ARCHS=x86_64 \
  COMPILER_INDEX_STORE_ENABLE=NO \
  SWIFT_ACTIVE_COMPILATION_CONDITIONS=LOCAL_SELLER_E2E \
  -only-testing:LastBiteUITests/LastBiteUITests/testAuthenticatedSellerSurfaceFlow \
  test
```

Authenticated shop Inventory simulator smoke test:

```sh
EXPO_PUBLIC_LASTBITE_E2E_LOCAL_SELLER=1 EXPO_PUBLIC_LASTBITE_E2E_SELLER_TYPE=shop LASTBITE_DISABLE_IOS_MLKIT=1 xcodebuild -quiet \
  -workspace ios/LastBite.xcworkspace \
  -scheme LastBite \
  -configuration Release \
  -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,id=<device-udid>' \
  -derivedDataPath /tmp/lastbite-ui-test-dd-e2e-shop \
  CODE_SIGNING_ALLOWED=NO \
  ONLY_ACTIVE_ARCH=YES \
  ARCHS=arm64 \
  EXCLUDED_ARCHS=x86_64 \
  COMPILER_INDEX_STORE_ENABLE=NO \
  SWIFT_ACTIVE_COMPILATION_CONDITIONS=LOCAL_SELLER_E2E \
  -only-testing:LastBiteUITests/LastBiteUITests/testAuthenticatedShopInventorySurfaceFlow \
  test
```

The current verified clean-copy result is:

- 37 Jest suites passing
- 142 Jest tests passing
- ESLint passing
- TypeScript passing
- arm64 iOS Simulator Xcode build passing
- native iOS buyer reservation, reservation-history recovery, Favorites, product-detail close, map location selection, discovery radius filtering, pickup reminder history flow, Settings language switching, seller-entry, authenticated restaurant seller setup/lifecycle smoke, and guarded shop Inventory UI tests passing
- standalone Release simulator launch passing on an iPhone 17 simulator with Metro stopped
- signed generic `iphoneos` Release build passing with ML Kit linked under the temporary local bundle ID override
- retained screenshots for reservation confirmation, Favorites, authenticated seller surfaces, shop Inventory/scanner modal, map alignment, reservation history, Phase 2 multilingual feed/Settings surfaces, Phase 3 product-detail sections, Phase 4 radius/map-tap discovery flows, Phase 5 pickup reminder status, Phase 6 reliability smoke coverage, and Phase 7 seller setup/lifecycle smoke coverage

Known simulator UI issues still visible in the retained screenshots:

- seller-entered offer/business content now has app-side multilingual fields, but the real Supabase migration, backend write/read validation, and existing-content backfill are still pending
- older retained seller/shop screenshots were captured before the final localization and tab-icon passes; use the Phase 7 seller artifact folder for current seller setup/lifecycle evidence
- manual deep-link product-detail screenshots are blocked by the iOS open-url confirmation prompt; the product-detail close button and back navigation are covered by the native UI test `testBuyerOfferDetailCloseButtonFlow`

Highest-value interface additions before a broader demo:

- apply and validate the multilingual JSONB migration against the real Supabase project
- seller setup checklist for profile, location, first offer, and first inventory item
- server-backed push delivery, notification preferences, and real-device delivery validation for pickup reminders, expiring inventory, and new seller orders
- direct-action polish on the new loading, failed, and empty states across buyer and seller screens

## Supabase

Apply `supabase/schema.sql` to the target Supabase project before testing real seller/buyer data.

Current reservation recovery is device-local. Seller-backed reservations now use the `reserve_seller_offer` and `cancel_seller_reservation` RPC contracts in schema/client code, but those migrations still need to be applied and validated against the real Supabase project. Production still needs buyer-safe server history retrieval across devices plus expiry cleanup.

Local Supabase validation attempt on this machine:

```sh
supabase init --force
supabase start -x studio,storage-api,imgproxy,mailpit,realtime,edge-runtime,logflare,vector,supavisor,postgres-meta
```

Current blocker: Docker Desktop cannot pull images reliably because containerd reports metadata database write failures. Resolve Docker storage/daemon health or provide real Supabase credentials before backend E2E validation.

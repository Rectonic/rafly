# LastBite Mobile QA Report

Date: 2026-05-27
Branch: dev
Project root: `/Users/boiskhonkattakhodjaev/Desktop/Useful Materials/LastBite/lastbite-mobile`

## Executive Status

The repository has been converted into a launchable Expo/React Native mobile app at the root level. Static validation is green from the clean no-space validation copy at `/tmp/lastbite-mobile-clean`, simulator CocoaPods installs cleanly, a clean no-space-path simulator build passes, and core buyer/seller workflows now have focused unit coverage. Native iOS UI automation is now wired into the Xcode scheme, and the buyer feed-to-reservation, buyer Favorites add/remove, buyer settings-to-seller-auth entry, authenticated restaurant seller dashboard/create/orders/scanner/profile surface, and guarded shop Inventory intake/scanner-modal flows pass on the Release simulator app.

The app now launches on iOS Simulator. A clean simulator build was installed and launched on an iPhone 17 simulator, and the buyer feed/map/cards/bottom-tab icons rendered correctly after fixing the missing root route, safe-area overlap, Expo Constants runtime config, missing explicit tab icons, default-locale app chrome copy, and seed marketplace content localization. The current state is ready for simulator preview and continued QA; it is not yet production-ready because physical-device camera/OCR validation, real Supabase seller/backend validation, TestFlight/signing validation, and production Supabase migration/security work remain.

Simulator launch is now verified through both paths: a Metro-backed Debug build for development preview and a Release simulator build that embeds `main.jsbundle` and launches without Metro. Relaunching a Debug app after Metro is stopped still reproduces React Native's `No script URL provided` red screen, so standalone simulator previews should use the Release build path. The latest standalone Release app was rebuilt after the tab icon and localization fixes, launched on an iPhone 17 simulator, visually verified on the buyer feed, and validated through native buyer reservation, Favorites, seller-entry, guarded authenticated restaurant-seller, and guarded shop Inventory UI tests.

## Scope Reviewed

Buyer workflow:
- Feed tab with search, category filters, sorting, favorites, map markers, and offer cards.
- Offer detail screen with favorite toggle and reservation flow.
- Favorites tab and shared favorites/search stores.
- Published seller offers merged into buyer marketplace results.

Seller workflow:
- Seller sign-up, sign-in, and business-type onboarding.
- Seller tab gatekeeping based on session and seller profile.
- Seller dashboard, inventory, create-offer flow, orders, scanner, and profile editing.
- Barcode/OCR scanner integration using `expo-camera` and ML Kit.
- Pickup order verification by manual code or scanner.

Native/config workflow:
- Expo app config, typed routes, Metro/Babel/Jest/TypeScript setup.
- iOS Info.plist permissions.
- CocoaPods dependency resolution.
- Xcode/Simulator readiness.

## Root Causes Found

1. Root repo was not a coherent mobile app.
   The app implementation existed in an ignored worktree, while the root lacked the `app/`, `components/`, `lib/`, test, and Expo config surface needed to run the mobile version.

2. Expo/RN dependency versions were inconsistent.
   The package graph had Expo 55 packages mixed with mismatched peer versions. This blocked dependable install/build behavior.

3. iOS native permissions were incomplete.
   Camera, location, and photo-library permission strings were missing from native config even though the app uses scanning, map/location-oriented UI, and image selection.

4. iOS deployment target was too low.
   `@react-native-ml-kit/text-recognition` requires iOS 15.5, while the native project was still targeting 15.1.

5. Local path with spaces broke native scripts.
   React Native's CocoaPods new-architecture helper used an unescaped `find` command against the project path, which split `Useful Materials` into separate arguments.

6. Buyer map was placeholder behavior.
   The feed had offer/location data but no native map implementation.

7. Reservation flow was not end-to-end.
   Buyer offer reservation only set local UI state, so seller orders could not receive or verify the reservation.

8. Seller sign-in routing used stale profile state.
   The login screen routed from the pre-sign-in `sellerProfile` value instead of the profile loaded after authentication.

9. Test/lint scope included stale generated worktrees.
   Tooling was scanning `.worktrees`, `.next`, and unrelated generated files, causing hangs/noisy results.

10. Seller profile/offer RLS was incomplete.
    Authenticated sellers could not insert their own profile, and buyer reads of published seller offers were not explicitly allowed.

11. ML Kit blocked the arm64 simulator native build.
    `@react-native-ml-kit/text-recognition` linked `MLImage.framework` as an arm64 iOS device binary during an arm64 simulator build.

12. The app did not have a root Expo Router screen.
    A cold launch opened the seller auth stack instead of the buyer marketplace.

13. Headerless routes ignored safe-area insets.
    The buyer feed rendered under the Dynamic Island/status area on iPhone 17 simulator.

14. Expo Constants did not embed `app.config`.
    `expo-constants/scripts/get-app-config-ios.sh` used `basename $PROJECT_DIR` without quotes, so the `Useful Materials` path made the script think the project directory was `Useful` and exit early. The resulting app launched into an `expo-linking` render error because `Constants.manifest` was missing.

15. Seller session hydration could redirect too early.
    The auth provider ended loading after `getSession()` and before the existing seller profile query finished, so returning sellers could briefly look authenticated but profile-less.

16. Seller mutation failures could escape as unhandled promises.
    Offer publish, inventory add/update/delete, profile update, and pickup verification set hook errors but sometimes returned instead of rejecting. Screens also did not consistently catch failed mutations.

17. Seller orders lacked recovery UI.
    Orders loaded on mount, but the screen had no loading, error, empty, or manual refresh states.

18. Create-offer form nested vertical scroll views.
    `CreateOfferScreen` used `ScreenScrollView`, and `MealPackageForm` also rendered a vertical `ScrollView`, creating mobile touch/keyboard risk.

19. Buyer map was controlled with a constant region.
    `OffersMap` passed a fixed `region` prop, which can fight normal pan/zoom gestures and snap the map back during state updates.

20. Debug simulator launch was being treated like a standalone app launch.
    The Xcode Debug simulator build does not embed a standalone JS bundle. It needs Metro to serve `node_modules/expo-router/entry.js`; when Metro is stopped, direct `simctl launch` reproduces the React Native red screen: `No script URL provided`.

21. Native UI automation had no runnable test bundle.
    The Xcode scheme referenced a stale/nonexistent `LastBiteTests` bundle, so `xcodebuild test` initially reported that no test bundles were available.

22. Offer cards exposed test IDs but not native button semantics.
    XCTest could find `offer-card-9`, but tapping the generic native element did not reliably route to the offer-detail navigation. Exposing the card as a button-style accessibility element made the native tap target deterministic.

23. Reservation confirmation lacked stable native selectors.
    The pickup-code label renders with `textTransform: "uppercase"`, so visible-text assertions were brittle. Stable reservation test IDs were needed for native UI validation.

24. Buyer and seller tab bars lacked stable native selectors.
    XCTest could not find the Settings tab through `app.tabBars.buttons["Settings"]`, leaving cross-tab seller-entry validation brittle. Explicit tab button test IDs were needed.

25. Settings/auth seller-entry screens lacked stable native selectors.
    The screens rendered, but native automation had to depend on visible copy and component structure. Stable settings, login, signup, and onboarding selectors were needed before expanding simulator tap-through coverage.

26. Authenticated seller simulator QA had no safe local launch path.
    Without a real Supabase seller session, the simulator could validate seller login screens but not the authenticated seller tab surfaces. A guarded local seller E2E mode was needed so native automation can enter seller mode without weakening normal auth behavior.

27. Authenticated seller surfaces lacked enough native selectors.
    Dashboard, create offer, form controls, orders, scanner modal, and profile screens rendered, but native automation could not reliably assert the authenticated seller workflow without stable test IDs and button semantics.

28. Repeated native validation can exhaust local temp disk space.
    A fresh throwaway DerivedData path for the attachment-enabled rerun failed before tests with `write64() failed ... errno=28` while writing `libReact-Fabric.a`. The root cause was not an app-code failure; the machine had only 231 MiB free and several old `/tmp/lastbite-*` DerivedData folders consumed multiple GiB each.

29. Favorites had no direct native tap-through coverage.
    Favorites shared state with the feed and had component coverage indirectly through offer cards, but the tab itself did not expose stable native selectors and XCTest did not prove add/remove behavior from Feed into Favorites.

30. Favorites empty copy was ambiguous under shared search.
    When favorites existed but the current shared search query hid them, the tab still displayed the same "No favorite offers yet" copy used for a genuinely empty favorites list.

31. Shop Inventory was not covered by authenticated seller simulator QA.
    The guarded local seller profile always hydrated as a restaurant, so the shop-only Inventory route could not be asserted in native UI automation.

32. Shop Inventory lacked stable native selectors.
    The Inventory intake controls rendered for shops, but native automation could not reliably assert the form controls or scanner modal without stable test IDs and button/accessibility semantics.

33. Buyer and seller tab bars omitted explicit icons.
    Expo native tabs rendered fallback generic triangle glyphs when a screen had a title and test ID but no `tabBarIcon`.

34. Default Russian locale exposed hardcoded English app chrome.
    Buyer and seller tab labels, settings/favorites copy, seller dashboard and inventory controls, and offer-card quantity text bypassed the existing i18n layer, so the default simulator launch mixed Russian UI with English labels.

35. Seed marketplace content stayed English under Russian UI.
    The default buyer feed localized chrome and controls but still rendered English seed offer names, business labels, and addresses.

36. Physical-device install is blocked by device state, not app code.
    The paired iPhone 16 Pro is visible to CoreDevice and has Developer Mode enabled, but install/build-to-device cannot mount the developer disk image while the phone is locked. `devicectl device install app` reports `kAMDMobileImageMounterDeviceLocked`.

37. The production bundle ID is not provisioned for the local Apple team.
    Generic `iphoneos` Release signing with the committed `com.lastbite.app` bundle ID fails because the identifier is unavailable to team `NU65C8BNDH` and no matching provisioning profile exists. A temporary team-owned bundle ID override signs successfully, which proves the local signing path but not production bundle ownership.

38. Local Supabase validation is blocked by Docker Desktop storage/daemon state.
    Supabase CLI is installed and Docker Desktop can start, but local Supabase cannot pull the Postgres image. The first attempt failed with only 381 MiB free on `/System/Volumes/Data`; after clearing disposable `/tmp/lastbite-*` DerivedData and recovering about 19 GiB, `supabase start` still failed with a containerd metadata database write error, and `docker pull hello-world` did not complete cleanly after a Docker restart. No real Supabase `.env` is present, so backend E2E validation remains externally blocked.

39. Product/offer detail pages had no explicit close control.
    Users could enter detail pages from offer cards but had no visible in-screen X/back affordance on the product page. Navigation still existed through the native router stack, but the UI did not expose the expected close button.

40. Buyer detail surfaces still mixed English and Russian.
    The feed had localized chrome and seed content, but offer detail labels, reservation status copy, map callouts, and price formatting still bypassed parts of the i18n/locale layer. Under Russian locale this produced English strings such as "Reserve Now", "Pickup by", and US-style prices.

41. Seller-entered content had no multilingual persistence path.
    The app could localize static UI copy and seed data, but seller-created offers and seller profiles only stored one language. Switching the app language could not update seller-entered titles, business names, addresses, or contents text because the typed model, stores, Supabase schema, and seller forms had no structured translation payload.

42. Product detail pages lacked operational product metadata.
    Offer detail showed basic title, price, pickup time, address, and contents text, but it did not expose pickup instructions, dietary context, allergens, or cancellation/refund policy. Buyers had to reserve without the operational information normally needed before pickup.

43. Repeated native reminder validation could reuse persisted reservations.
    The iOS simulator kept device-local reservation history between `xcodebuild test` runs. A repeated pickup-reminder smoke test could reopen an already reserved offer, which correctly hid the full pickup code behind the secure recovery flow but made the test expect a fresh reservation code that was no longer present.

## Applied Fixes

Mobile app integration:
- Integrated the Expo Router app, components, stores, fixtures, i18n, types, tests, and scripts into the root repository.
- Added/updated `app.json`, `babel.config.js`, `metro.config.js`, `jest.config.js`, `jest.setup.ts`, `expo-env.d.ts`, `package.json`, `package-lock.json`, `tsconfig.json`, and `eslint.config.mjs`.
- Kept the existing root `ios/` project and applied targeted native fixes rather than replacing it wholesale.

Dependency/native fixes:
- Normalized Expo/RN dependencies to Expo 55-compatible versions.
- Added `react-native-maps`.
- Set iOS deployment target to 15.5 in Expo config, Podfile properties, and the Xcode project.
- Ran CocoaPods update/install to resolve native pods.
- Extended `scripts/fix-expo-constants-podspec.mjs` to patch Expo Constants script quoting, Expo Constants app-config generation, and React Native's unescaped path issue.

iOS permissions:
- Added camera, location, and photo-library usage descriptions in `app.json`.
- Patched `ios/LastBite/Info.plist` with matching permission strings.

Buyer map:
- Added `lib/map-region.ts`.
- Added `components/OffersMap.tsx` using `react-native-maps`.
- Wired the feed to render map markers and highlight the selected offer card.

Reservation flow:
- Added `lib/reservations.ts` for pickup code generation and `pickup_orders` insert payload creation.
- Added seller ID propagation from `seller_offers` into buyer `Offer` objects.
- Updated offer detail reservation to create a Supabase pickup order for seller-backed offers and show the pickup code.
- Added `pickup_orders_insert_public_reservations` RLS policy to `supabase/schema.sql` for public reservation inserts.
- Added `seller_profiles_insert_own` RLS policy for authenticated seller profile creation.
- Added `seller_offers_select_published` RLS policy for buyer/public marketplace reads of published offers.

Seller auth flow:
- Added `lib/seller/auth-flow.ts`.
- Updated sign-in to load and return the current seller profile before routing.
- Updated initial/auth-state session hydration to load the seller profile before ending `isLoading`.
- Updated missing Supabase configuration handling to throw actionable errors instead of silently continuing into onboarding.
- Updated auth screen alerts to show caught error messages.
- Added stable native selectors to seller login, signup, and business-type onboarding screens.

Seller failure/recovery flow:
- Updated seller offer, inventory, profile, and order stores to reject missing config/auth/profile states instead of resolving into false-success UI.
- Added screen-level failure alerts for offer publishing, inventory add, profile save, and pickup verification.
- Added seller orders loading, error, empty, and manual refresh UI.

Buyer automation hooks:
- Added stable `testID` coverage for buyer feed, search, category filters, sort controls, offer cards, favorite toggles, offer detail screen, offer detail favorite, and reserve button.
- Added button accessibility semantics and labels to offer cards and favorite toggles so XCTest can tap the same primary surfaces users tap.
- Added stable reservation confirmation and pickup-code selectors.
- Added stable Favorites screen and Favorites empty-state selectors.
- Updated Favorites empty-state copy to distinguish no saved favorites from saved favorites hidden by the current search query.
- Added stable buyer and seller tab button IDs, plus settings seller-entry controls, for native cross-tab automation.
- Added explicit Ionicons-backed buyer and seller tab icons and a regression test that fails if visible tabs fall back to triangle glyphs.
- Added/updated focused component tests so missing automation selectors fail in Jest before native QA depends on them.

Localization/copy fixes:
- Added i18n keys for buyer tab labels, settings, Favorites, seller tab labels, seller dashboard labels, and shop Inventory intake copy.
- Wired buyer tab layout, Settings, Favorites, seller tab layout, seller dashboard, shop Inventory, and `OfferCard` favorite/quantity text through `useT()`.
- Added `__tests__/localized-ui-copy.test.tsx` so default Russian buyer/seller chrome and key controls cannot regress silently.
- Updated Jest mocks for newly localized screens and native tab automation to prefer localized visible tab labels before fallback test identifiers.
- Localized auth sign-in/sign-up/business-type onboarding, seller create-offer, meal package form, orders, order cards, and seller profile surfaces.
- Added a close icon button to business-type onboarding that returns users to buyer Settings.
- Added seed offer localization via `lib/localized-offers.ts` and wired buyer Feed, Favorites, and offer detail to localize default marketplace content by locale.
- Added `__tests__/localized-offers.test.ts` so seed marketplace content stays English in English and Russian in Russian.
- Added structured `translations` support for seller profiles and seller-created offers, including typed contracts, Supabase row mappers, marketplace selectors, and JSONB schema columns on `seller_profiles` and `seller_offers`.
- Added English/Russian content fields to seller profile and create-offer screens so business name, category, address, package title, and contents text can be authored per language.
- Updated Feed, Favorites, and offer detail to localize seller-published offers by the active locale before rendering, without requiring an app restart after the Settings language switch changes.
- Added regression coverage for dynamic locale switching, seller multilingual offer mapping, seller form translation submission, and buyer feed rendering of localized seller-published offers.
- Added product-detail sections for contents, pickup instructions, dietary badges, allergen badges, and cancellation/refund policy.
- Added optional seller offer metadata fields for pickup instructions, dietary badges, allergens, and cancellation policy across the typed offer model, seller draft, create-offer submission, seller offer insert, marketplace mapper, and buyer detail rendering.
- Added Supabase `seller_offers` columns for `allergens`, `dietary_badges`, `pickup_instructions`, and `cancellation_policy`, with idempotent migration statements.
- Added focused regression coverage for the product-detail sections, seller form metadata submission, and marketplace mapping of product metadata.
- Localized buyer offer-detail price, pickup, favorite, reservation, pickup-code, not-found, and failure copy through the shared i18n layer.
- Localized seller scanner modal title, camera permission actions, OCR capture action, close action, and fallback OCR error copy through the shared i18n layer.
- Replaced raw seller create-offer validation codes with localized, user-readable validation messages.
- Localized shop Inventory card quantity, barcode/manual-entry metadata, and delete action labels.
- Added local Inventory intake validation so empty product names, missing expiry dates, and non-positive quantities show localized validation copy before any store/backend write attempt.
- Added local seller profile validation so empty business fields or invalid coordinates show localized validation copy before any profile update attempt.
- Added map callout tap-through so selecting a marker still highlights the offer, while tapping the callout opens the offer detail screen.
- Added `__tests__/scanner-localization.test.tsx` and expanded `__tests__/offer-detail-screen.test.tsx` so these surfaces cannot regress silently under Russian locale.
- Added `__tests__/inventory-card-localization.test.tsx` and expanded seller screen error coverage so inventory cards and seller validation alerts cannot regress silently.
- Added a close icon button to product/offer detail pages so users can return from the detail route without relying on platform navigation.
- Added a localized product-detail `View reservation` action from the reservation confirmation panel so existing reservations can jump directly to reservation history for secure pickup-code recovery.
- Wired buyer offer detail labels, reservation actions/messages, pickup-code copy, map callouts, and price display through the i18n/locale layer.
- Added `lib/format-price.ts` so English and Russian locales render prices consistently (`$5.60` in English, `5,60 $` in Russian).
- Added regression coverage in `__tests__/offer-detail-screen.test.tsx`, `__tests__/offers-map.test.tsx`, and `__tests__/localized-ui-copy.test.tsx` for the detail close button, Russian detail copy, Russian reservation copy, Russian map callout copy, and locale-specific price formatting.

Native UI automation:
- Added a `LastBiteUITests` target to `ios/LastBite.xcodeproj`.
- Updated the shared `LastBite` scheme so `xcodebuild test` builds and runs the UI test bundle.
- Added `LastBiteUITests.testBuyerFeedOfferReservationFlow()` covering feed launch, Baked Goods filtering, offer-card navigation, reservation, and pickup-code rendering.
- Added `LastBiteUITests.testBuyerFavoritesTabFlow()` covering Favorites tab navigation, adding an offer from Feed, verifying it appears in Favorites, unfavoriting it, and verifying removal.
- Added `LastBiteUITests.testBuyerSettingsSellerAuthEntryFlow()` covering buyer tab navigation to Settings, Seller Mode routing, seller login controls, and signup navigation.
- Added `LastBiteUITests.testAuthenticatedSellerSurfaceFlow()` covering Settings to seller dashboard, create-offer form, seller orders, scanner modal, and seller profile.
- Added `LastBiteUITests.testAuthenticatedShopInventorySurfaceFlow()` covering guarded shop seller entry, Inventory intake controls, and scanner modal rendering.
- Added a retained XCTest screenshot attachment at the reservation confirmation step.
- Added retained XCTest screenshot attachments for Favorites with a saved offer and Favorites after unfavorite.
- Added retained XCTest screenshot attachments for seller dashboard, create offer, scanner modal, and profile.
- Added retained XCTest screenshot attachments for shop Inventory intake and shop Inventory scanner modal.
- Extended the authenticated seller UI test to tap "switch to buyer" from seller profile and verify the buyer feed returns.
- Updated native tab/button interactions to use the existing fallback tap helper after explicit icon renderers changed the native accessibility hit target for seller E2E tab navigation.
- Updated native tab/button interactions again to prefer localized tab-bar labels, which keeps Russian tab titles tappable in Release simulator UI tests.

Authenticated seller simulator path:
- Added `EXPO_PUBLIC_LASTBITE_E2E_LOCAL_SELLER=1` support in the seller auth store to hydrate a local seller session only when Supabase is unavailable and the explicit E2E flag is enabled.
- Added guarded `EXPO_PUBLIC_LASTBITE_E2E_SELLER_TYPE=shop` support so local E2E can validate shop-only Inventory surfaces without changing normal auth behavior.
- Preserved normal seller auth behavior when Supabase is configured or the E2E flag is absent.
- Added stable native selectors and button semantics for seller dashboard, create offer, meal form controls, seller orders, scanner modal, and seller profile controls.
- Added stable native selectors and button semantics for shop Inventory unavailable state, scan/read-expiry actions, form controls, and add-item action.
- Gated the authenticated seller XCTest with `SWIFT_ACTIVE_COMPILATION_CONDITIONS=LOCAL_SELLER_E2E` so the default UI suite skips the local-seller-only test while the seller-E2E command runs it.
- Wrapped the seller-only XCTest body in the positive `LOCAL_SELLER_E2E` compile branch so the default build skips cleanly without unreachable-code warnings.

Simulator/OCR flow:
- Added a simulator-only ML Kit autolink gate in `react-native.config.js` using `LASTBITE_DISABLE_IOS_MLKIT=1`.
- Added `lib/text-recognition.ts` as an OCR wrapper that dynamically loads ML Kit only when the native module is available.
- Updated the scanner to surface a clear OCR-unavailable message on simulator instead of crashing.
- Added `ios:sim`, `pods:ios:sim`, and `pods:ios:device` scripts.
- Patched Expo Constants app-config generation so the built app embeds `EXConstants.bundle/app.config` with `scheme: lastbite`.

Physical-device validation path:
- Re-ran `npm run pods:ios:device` from `/tmp/lastbite-mobile-clean`; device pods install successfully with `RNMLKitTextRecognition`, `GoogleMLKit`, `MLImage`, and `MLKitTextRecognition` linked.
- Confirmed `xcrun devicectl list devices` sees paired physical device `iPhone Nodir`, an iPhone 16 Pro on iOS 26.5, with Developer Mode enabled.
- Confirmed `security find-identity -v -p codesigning` sees a valid `Apple Development: boiskattakhodjaev@gmail.com (S35T6F6JKK)` signing identity.
- Proved a signed generic `iphoneos` Release build with a temporary team-owned bundle identifier, `com.boiskhonkattakhodjaev.lastbite.dev`.
- Verified the signed physical-device build artifact includes `main.jsbundle`, OCR resource bundles, `embedded.mobileprovision`, and an Apple Development signature for team `NU65C8BNDH`.
- Attempted direct install to the paired iPhone; install remains blocked because the phone is locked and CoreDevice cannot mount the developer disk image.

Launch/safe-area flow:
- Added `app/index.tsx` to make cold launch redirect to the buyer tabs.
- Added `components/ScreenScrollView.tsx`.
- Converted top-level headerless buyer, seller, and auth scroll screens to include safe-area padding.
- Removed the nested vertical scroll view from `MealPackageForm`.
- Removed the controlled `region` prop from `OffersMap`; the map now uses an initial region keyed by offer-set bounds so user pan/zoom gestures are not constantly overridden.

Tooling:
- Scoped Jest to `__tests__`.
- Scoped ESLint to app-owned source directories.
- Ignored stale `.worktrees`, `.next`, `dist`, `ios`, and legacy `src` surfaces where appropriate.
- Replaced the legacy README with mobile setup, simulator, physical-device OCR, validation, and Supabase readiness commands.
- Clarified that Debug simulator launch requires Metro and verified a Release simulator build for standalone `simctl launch`.

## Validation Evidence

Commands that pass from `/tmp/lastbite-mobile-clean`:
- `npm run lint`
- `npm run typecheck`
- `npm test -- --runInBand`
- `npm run pods:ios:sim`
- Clean `/tmp/lastbite-mobile-clean` arm64 iOS Simulator build with `LASTBITE_DISABLE_IOS_MLKIT=1 xcodebuild ... build`
- Clean `/tmp/lastbite-mobile-clean` arm64 Release iOS Simulator build with an embedded `main.jsbundle`
- Targeted native Release simulator UI tests with `LASTBITE_DISABLE_IOS_MLKIT=1 xcodebuild ... -only-testing:LastBiteUITests/LastBiteUITests test`
- `node scripts/fix-expo-constants-podspec.mjs`

Latest Jest result from `/tmp/lastbite-mobile-clean`:
- 34 test suites passed.
- 100 tests passed.

Latest Phase 2 validation from `/tmp/lastbite-mobile-clean`:
- `npm test -- --runInBand`: 34 suites passed, 98 tests passed.
- `npm run lint`: exit 0.
- `npm run typecheck`: exit 0.
- `LastBiteUITests/testBuyerSettingsLanguageSwitchUpdatesVisibleCopy`: exit 0 on the Release iOS Simulator build.

Latest post-seller-entry validation from `/tmp/lastbite-mobile-clean`:
- `npm test -- --runInBand`: 33 suites passed, 92 tests passed.
- `npm run lint`: exit 0.
- `npm run typecheck`: exit 0.
- Default Release simulator `xcodebuild` UI suite with `LASTBITE_DISABLE_IOS_MLKIT=1`: exit 0.
- Targeted Release simulator Favorites UI test with `LASTBITE_DISABLE_IOS_MLKIT=1`: exit 0.
- Guarded authenticated-seller Release simulator `xcodebuild` UI test with `EXPO_PUBLIC_LASTBITE_E2E_LOCAL_SELLER=1`, `LASTBITE_DISABLE_IOS_MLKIT=1`, and `SWIFT_ACTIVE_COMPILATION_CONDITIONS=LOCAL_SELLER_E2E`: exit 0.
- Guarded shop Inventory Release simulator `xcodebuild` UI test with `EXPO_PUBLIC_LASTBITE_E2E_LOCAL_SELLER=1`, `EXPO_PUBLIC_LASTBITE_E2E_SELLER_TYPE=shop`, `LASTBITE_DISABLE_IOS_MLKIT=1`, and `SWIFT_ACTIVE_COMPILATION_CONDITIONS=LOCAL_SELLER_E2E`: exit 0.
- Device pods with ML Kit enabled via `npm run pods:ios:device`: exit 0.
- Generic signed `iphoneos` Release build with `PRODUCT_BUNDLE_IDENTIFIER=com.boiskhonkattakhodjaev.lastbite.dev`: exit 0.
- Fresh standalone Release launch with Metro stopped on simulator `LastBite Release Current iPhone 17` (`4C77E440-3765-4A8D-B89A-C9908BA5746D`): launched with PID `95956`.
- Latest clean screenshot: `docs/mobile-qa/artifacts/2026-05-27-xcuitest/launch-icons/buyer-feed-multilingual-seed.png`.
- Latest manual launch screenshot: `/tmp/lastbite-mobile-multilingual-seed-current.png`.
- Some stale disposable `/tmp/lastbite-*` DerivedData and `.xcresult` bundles from earlier native reruns were removed on 2026-05-27 to recover disk space for Docker/Supabase validation. The retained repository screenshot remains available, and the documented commands can regenerate fresh result bundles.

Latest physical-device build/signing validation from `/tmp/lastbite-mobile-clean`:
- Paired device observed: `iPhone Nodir`, iPhone 16 Pro (`iPhone17,1`), CoreDevice identifier `16CA05A4-342A-5ED9-9EB6-D12406F2F0BD`, hardware UDID `00008140-001C74991A42801C`, iOS 26.5 build `23F77`, Developer Mode enabled.
- Signing identity observed: `Apple Development: boiskattakhodjaev@gmail.com (S35T6F6JKK)`.
- `npm run pods:ios:device`: exit 0, 106 dependencies and 129 total pods installed, including ML Kit/OCR pods.
- `xcodebuild -quiet -workspace ios/LastBite.xcworkspace -scheme LastBite -configuration Release -sdk iphoneos -destination 'generic/platform=iOS' -derivedDataPath /tmp/lastbite-device-generic-unique-dd -allowProvisioningUpdates CODE_SIGN_STYLE=Automatic DEVELOPMENT_TEAM=NU65C8BNDH PRODUCT_BUNDLE_IDENTIFIER=com.boiskhonkattakhodjaev.lastbite.dev ONLY_ACTIVE_ARCH=NO COMPILER_INDEX_STORE_ENABLE=NO build`: exit 0.
- Built artifact: `/tmp/lastbite-device-generic-unique-dd/Build/Products/Release-iphoneos/LastBite.app`.
- Built artifact metadata: `CFBundleIdentifier` is `com.boiskhonkattakhodjaev.lastbite.dev`, `MinimumOSVersion` is `15.5`, `main.jsbundle` is present at 4.6 MiB, OCR resource bundles are present, and `codesign -dv --verbose=4` reports `Authority=Apple Development: boiskattakhodjaev@gmail.com (S35T6F6JKK)` plus `TeamIdentifier=NU65C8BNDH`.
- Production bundle ID signing check: the same generic Release device build with `com.lastbite.app` fails because the app identifier cannot be registered to this development team and no matching provisioning profile exists.
- Direct physical install check: `xcrun devicectl device install app --device 16CA05A4-342A-5ED9-9EB6-D12406F2F0BD /tmp/lastbite-device-generic-unique-dd/Build/Products/Release-iphoneos/LastBite.app` fails before install because the developer disk image cannot be mounted while the device is locked (`kAMDMobileImageMounterDeviceLocked`).
- Follow-up CoreDevice checks still show `ddiServicesAvailable: false`; `xcrun devicectl device info lockState` reports `passcodeRequired: true` and `unlockedSinceBoot: true`, while DDI enablement still fails with `kAMDMobileImageMounterDeviceLocked`.

Latest local Supabase/backend validation attempt:
- Real Supabase environment files are absent; only `.env.example` exists with empty `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- Supabase CLI is installed at `/opt/homebrew/bin/supabase`, version `2.22.12`.
- Docker Desktop is installed and was started during QA.
- Initial `supabase start -x studio,storage-api,imgproxy,mailpit,realtime,edge-runtime,logflare,vector,supavisor,postgres-meta` from `/tmp/lastbite-mobile-clean` failed while pulling `public.ecr.aws/supabase/postgres:15.8.1.069`; disk had only 381 MiB free on `/System/Volumes/Data`.
- Removed stale disposable `/tmp/lastbite-*` DerivedData directories and recovered about 19 GiB free.
- Retried `supabase start`; it still failed with `error creating temporary lease: write /var/lib/desktop-containerd/daemon/io.containerd.metadata.v1.bolt/meta.db: input/output error`.
- `docker pull hello-world:latest` reproduced the Docker-wide containerd metadata write failure before restart and did not complete cleanly after a Docker Desktop restart.
- Local Supabase backend E2E remains blocked by Docker daemon/storage state; real Supabase backend E2E remains blocked by missing project credentials.

Latest native UI validation from `/tmp/lastbite-mobile-clean`:
- Default command: `LASTBITE_DISABLE_IOS_MLKIT=1 xcodebuild -quiet -workspace ios/LastBite.xcworkspace -scheme LastBite -configuration Release -sdk iphonesimulator -destination 'platform=iOS Simulator,id=4C77E440-3765-4A8D-B89A-C9908BA5746D' -derivedDataPath /tmp/lastbite-ui-test-dd-default CODE_SIGNING_ALLOWED=NO ONLY_ACTIVE_ARCH=YES ARCHS=arm64 EXCLUDED_ARCHS=x86_64 COMPILER_INDEX_STORE_ENABLE=NO -only-testing:LastBiteUITests/LastBiteUITests test`
- Result: exit 0.
- Result bundle: `/tmp/lastbite-ui-test-dd-default/Logs/Test/Test-LastBite-2026.05.27_23-28-51-+0500.xcresult`.
- XCTest results on `LastBite Release Current iPhone 17` (`4C77E440-3765-4A8D-B89A-C9908BA5746D`), iOS Simulator 26.5:
  - `testBuyerFavoritesTabFlow()` passed in 40s.
  - `testBuyerFeedOfferReservationFlow()` passed in 17s.
  - `testBuyerSettingsSellerAuthEntryFlow()` passed in 22s.
  - `testAuthenticatedSellerSurfaceFlow()` skipped in the default suite because it is gated behind local seller E2E mode.
  - `testAuthenticatedShopInventorySurfaceFlow()` skipped in the default suite because it is gated behind local seller E2E mode and shop seller type.
- Flows covered: cold feed render, Baked Goods filter, Favorites tab navigation, `favorite-toggle-9` add/remove, Favorites saved-offer rendering, `offer-card-9` native tap, offer detail render, reserve tap, pickup-code render, Settings tab navigation, Seller Mode routing, seller login controls, signup link navigation, and seller signup controls.
- Retained XCTest screenshot attachments: `Favorites with saved offer`, `Favorites after unfavorite`, and `Reservation confirmation`.

Latest buyer Favorites native UI validation from `/tmp/lastbite-mobile-clean`:
- Command: `LASTBITE_DISABLE_IOS_MLKIT=1 xcodebuild -quiet -workspace ios/LastBite.xcworkspace -scheme LastBite -configuration Release -sdk iphonesimulator -destination 'platform=iOS Simulator,id=4C77E440-3765-4A8D-B89A-C9908BA5746D' -derivedDataPath /tmp/lastbite-ui-test-dd-default CODE_SIGNING_ALLOWED=NO ONLY_ACTIVE_ARCH=YES ARCHS=arm64 EXCLUDED_ARCHS=x86_64 COMPILER_INDEX_STORE_ENABLE=NO -only-testing:LastBiteUITests/LastBiteUITests/testBuyerFavoritesTabFlow test`
- Result: exit 0.
- Result bundle: `/tmp/lastbite-ui-test-dd-default/Logs/Test/Test-LastBite-2026.05.27_23-28-51-+0500.xcresult` from the latest full default UI suite.
- XCTest result on `LastBite Release Current iPhone 17` (`4C77E440-3765-4A8D-B89A-C9908BA5746D`), iOS Simulator 26.5:
  - `testBuyerFavoritesTabFlow()` passed in 40s.
- Flows covered: Favorites tab navigation, Baked Goods feed filter, `favorite-toggle-9` add from Feed, Favorites saved-offer rendering, `favorite-toggle-9` remove from Favorites, and removed-offer assertion.
- Retained XCTest screenshot attachments: `Favorites with saved offer` and `Favorites after unfavorite`.

Latest authenticated seller native UI validation from `/tmp/lastbite-mobile-clean`:
- Command: `EXPO_PUBLIC_LASTBITE_E2E_LOCAL_SELLER=1 LASTBITE_DISABLE_IOS_MLKIT=1 xcodebuild -quiet -workspace ios/LastBite.xcworkspace -scheme LastBite -configuration Release -sdk iphonesimulator -destination 'platform=iOS Simulator,id=4C77E440-3765-4A8D-B89A-C9908BA5746D' -derivedDataPath /tmp/lastbite-phase7-seller-dd CODE_SIGNING_ALLOWED=NO ONLY_ACTIVE_ARCH=YES ARCHS=arm64 EXCLUDED_ARCHS=x86_64 COMPILER_INDEX_STORE_ENABLE=NO SWIFT_ACTIVE_COMPILATION_CONDITIONS=LOCAL_SELLER_E2E -only-testing:LastBiteUITests/LastBiteUITests/testAuthenticatedSellerSurfaceFlow test`
- Result: exit 0.
- Result bundle: `/tmp/lastbite-phase7-seller-dd/Logs/Test/Test-LastBite-2026.05.28_19-40-34-+0500.xcresult`.
- XCTest result on `LastBite Release Current iPhone 17` (`4C77E440-3765-4A8D-B89A-C9908BA5746D`), iOS Simulator 26.5:
  - `testAuthenticatedSellerSurfaceFlow()` passed with `passedTests: 1`, `failedTests: 0`, `totalTestCount: 1`.
- Flows covered: Settings to seller dashboard, dashboard setup checklist, dashboard primary action, create-offer form render, seller orders render, cancelled orders segment selector, scanner modal open/close, long seller profile render/scroll, switch-back-to-buyer tap, and returned buyer feed.
- Retained XCTest screenshot attachments: `Seller dashboard`, `Seller create offer`, `Seller scanner modal`, and `Seller profile`. Exported attachments are under `docs/mobile-qa/artifacts/2026-05-28-phase7/xcresult-seller/`.

Latest authenticated shop Inventory native UI validation from `/tmp/lastbite-mobile-clean`:
- Command: `EXPO_PUBLIC_LASTBITE_E2E_LOCAL_SELLER=1 EXPO_PUBLIC_LASTBITE_E2E_SELLER_TYPE=shop LASTBITE_DISABLE_IOS_MLKIT=1 xcodebuild -quiet -workspace ios/LastBite.xcworkspace -scheme LastBite -configuration Release -sdk iphonesimulator -destination 'platform=iOS Simulator,id=4C77E440-3765-4A8D-B89A-C9908BA5746D' -derivedDataPath /tmp/lastbite-ui-test-dd-e2e-shop-2 CODE_SIGNING_ALLOWED=NO ONLY_ACTIVE_ARCH=YES ARCHS=arm64 EXCLUDED_ARCHS=x86_64 COMPILER_INDEX_STORE_ENABLE=NO SWIFT_ACTIVE_COMPILATION_CONDITIONS=LOCAL_SELLER_E2E -only-testing:LastBiteUITests/LastBiteUITests/testAuthenticatedShopInventorySurfaceFlow test`
- Result: exit 0.
- Result bundle: `/tmp/lastbite-ui-test-dd-e2e-shop-2/Logs/Test/Test-LastBite-2026.05.27_22-56-55-+0500.xcresult`.
- XCTest result on `LastBite Release Current iPhone 17` (`4C77E440-3765-4A8D-B89A-C9908BA5746D`), iOS Simulator 26.5:
  - `testAuthenticatedShopInventorySurfaceFlow()` passed in 27s.
- Flows covered: Settings to seller dashboard, Inventory tab navigation, shop Inventory intake controls render, scanner modal open, and scanner modal close.
- Retained XCTest screenshot attachments: `Seller inventory` and `Seller inventory scanner modal`.
- Preserved repo artifacts: `docs/mobile-qa/artifacts/2026-05-27-xcuitest/shop-e2e/9DC021C9-560C-46B2-B21D-AFB8CD53DC36.png`, `docs/mobile-qa/artifacts/2026-05-27-xcuitest/shop-e2e/CAC3F63F-3641-4D9E-B169-6834ACBD6E74.png`, and `docs/mobile-qa/artifacts/2026-05-27-xcuitest/shop-e2e/manifest.json`.

Latest native rerun environment issue and recovery:
- A fresh attachment rerun using `/tmp/lastbite-ui-test-dd-default-attachments` failed before tests with `write64() failed ... errno=28` while writing `libReact-Fabric.a`.
- `df -h /tmp` showed only 231 MiB free on `/System/Volumes/Data`.
- Removed generated LastBite temp build artifacts from `/tmp` (`lastbite-ui-test-dd-default-attachments`, old DerivedData folders, and stale probe build outputs), raising free space to about 20 GiB.
- Reran the default Release UI suite and guarded authenticated seller UI test successfully using the existing default/e2e DerivedData paths above.

Focused tests added/updated:
- `__tests__/auth-screen-selectors.test.tsx`
- `__tests__/buyer-feed-screen.test.tsx`
- `__tests__/offer-detail-screen.test.tsx`
- `__tests__/favorites-screen.test.tsx`
- `__tests__/settings-seller-entry.test.tsx`
- `ios/LastBiteUITests/LastBiteUITests.swift`
- `__tests__/map-region.test.ts`
- `__tests__/offers-map.test.tsx`
- `__tests__/reservations.test.ts`
- `__tests__/auth-flow.test.ts`
- `__tests__/auth-store-hydration.test.tsx`
- `__tests__/inventory-screen-selectors.test.tsx`
- `__tests__/react-native-config.test.js`
- `__tests__/text-recognition.test.ts`
- `__tests__/screen-scroll-view.test.tsx`
- `__tests__/seller-workflow-errors.test.tsx`
- `__tests__/seller-screen-errors.test.tsx`
- `__tests__/orders-store.test.tsx`
- `__tests__/orders-screen.test.tsx`
- `__tests__/meal-package-form.test.tsx`
- `__tests__/seller-authenticated-screen-selectors.test.tsx`
- `__tests__/tab-layout-icons.test.tsx`
- `__tests__/localized-ui-copy.test.tsx`
- `__tests__/localized-offers.test.ts`

Root Desktop-path note:
- Root lint/typecheck passed earlier in the investigation, but after the final native-script patch they hung before producing fresh output from the Desktop workspace path.
- Running Jest from the Desktop workspace path also hangs before useful output in this environment.
- The clean `/tmp/lastbite-mobile-clean` copy is used for final lint/typecheck/Jest/build verification and passes.

iOS bundle export:
- Metro bundled `node_modules/expo-router/entry.js` during simulator launch.
- With Metro stopped, direct relaunch of the same installed Debug app showed the expected React Native `No script URL provided` red screen, confirming the Debug app is not standalone.
- Release simulator build produced `/tmp/lastbite-sim-release-dd/Build/Products/Release-iphonesimulator/LastBite.app/main.jsbundle` and launched without Metro.

CocoaPods:
- `npm run pods:ios:sim` succeeds after the iOS 15.5 deployment target update, path quoting patch, and simulator-only ML Kit autolink gate.
- `ios/Podfile.lock` has no `RNMLKitTextRecognition`, `GoogleMLKit`, `MLImage`, or `MLKitTextRecognition` entries in simulator mode.

Xcode:
- A clean `/tmp/lastbite-mobile-clean` arm64 iOS Simulator build passed after the Expo Constants app-config fix.
- A clean `/tmp/lastbite-mobile-clean` arm64 Release iOS Simulator build passed and produced a bundled standalone simulator app.
- The built simulator app contains `EXConstants.bundle/app.config` with `scheme: lastbite`.
- The root `ios/LastBite.xcworkspace` arm64 iOS Simulator compile/link passed before the Expo Constants runtime fix. A follow-up root rebuild after the fix stalled in this Desktop path with no compiler children, so the clean `/tmp` build is the current authoritative simulator artifact.
- Remaining build output is third-party warnings, not app-code or linker failures.

Simulator visual QA:
- Installed and launched the app on an iPhone 17 simulator.
- Verified the buyer feed renders as the cold-launch screen.
- Verified the map, search/filter controls, offer cards, and bottom tabs render.
- Fixed and re-verified Dynamic Island/status-area overlap.
- Rebuilt after seller error-handling, orders refresh UI, form scroll, and map-region fixes.
- Installed and launched the final build on fresh simulator `LastBite QA iPhone 17` (`A76B6FF2-01CD-454F-BCB0-4F12B45C0526`).
- Latest clean screenshot after final rebuild: `/tmp/lastbite-qa-final-feed.png`.
- Latest launch check screenshot: `/tmp/lastbite-launch-now.png`.
- Latest Metro-backed launch screenshot: `/tmp/lastbite-metro-launch-final.png`.
- Latest standalone Release launch screenshot: `/tmp/lastbite-release-standalone-feed.png`.
- Latest standalone Release launch after tab icon and localization fixes: `docs/mobile-qa/artifacts/2026-05-27-xcuitest/launch-icons/buyer-feed-multilingual-seed.png`.
- Latest retained repo artifacts: `docs/mobile-qa/artifacts/2026-05-27-xcuitest/default-ui-suite/`, `docs/mobile-qa/artifacts/2026-05-27-xcuitest/seller-e2e/`, `docs/mobile-qa/artifacts/2026-05-27-xcuitest/shop-e2e/`, and `docs/mobile-qa/artifacts/2026-05-27-xcuitest/launch-icons/buyer-feed-multilingual-seed.png`.
- The prior development LogBox warning banner did not reproduce after a fresh Metro-backed launch. The stronger reproduced launch issue is the Debug build's Metro dependency: without Metro it shows `No script URL provided`.
- Installed and launched the Release simulator app with Metro stopped; the buyer feed, map, cards, and bottom tabs rendered from the embedded JS bundle.
- Rebuilt and relaunched the Release simulator app after adding explicit tab icons; the buyer tab bar now renders map, heart, and settings icons instead of fallback triangles.
- Rebuilt and relaunched the Release simulator app after localizing default Russian app chrome; buyer tabs and offer quantity labels now render in Russian.
- Rebuilt and relaunched the Release simulator app after localizing seed marketplace offer names, business labels, and addresses; the buyer feed cards now render Russian demo content under the Russian locale.
- Added repeatable component coverage for buyer feed search/filter/map/favorite/navigation plus offer detail rendering, favorite toggle, reservation success, reservation failure, and unknown-offer state.
- Added and passed a native Release simulator UI test for buyer feed filtering, offer-card tap navigation, reservation, and pickup-code rendering.
- Added and passed repeatable component and native Release simulator UI coverage for Favorites add/remove, search filtering, card navigation, and empty-state copy.
- Added and passed a native Release simulator UI test for buyer Settings tab navigation into Seller Mode, seller login control rendering, signup-link navigation, and seller signup control rendering.
- Added and passed a guarded native Release simulator UI test for authenticated seller dashboard, create-offer form, orders scanner modal, seller profile, switch-back-to-buyer tap, and returned buyer feed.
- Added and passed a guarded native Release simulator UI test for shop Inventory intake controls and scanner modal.
- Confirmed XCTest result activities contain retained screenshot attachments for reservation confirmation, Favorites, authenticated seller surfaces, and shop Inventory surfaces.
- Visual QA risk still visible in screenshots: real seller-entered content will render in the language entered by the seller unless production adds structured translated fields.

## Simulator/Xcode Status

Observed commands:
- `xcodebuild -version` returns Xcode 26.5, build 17F42.
- `xcodebuild -showsdks` lists iOS 26.5 and iOS Simulator 26.5 SDKs.
- `xcrun simctl list runtimes` now lists `iOS 26.5 (26.5 - 23F77)`.
- `xcrun simctl list devices available` now lists available devices, including booted `iPhone 17e` and `iPhone 17`.

Action taken:
- Ran `xcodebuild -runFirstLaunch` earlier to clear first-launch setup.
- Completed `xcodebuild -downloadPlatform iOS` for iOS 26.5 Simulator (23F77), arm64.
- Ran `npm run pods:ios:sim` successfully in the root project.
- Ran `npm run pods:ios:device` successfully in the clean project so physical-device pods include ML Kit/OCR.
- Created `/tmp/lastbite-mobile-clean`, ran `npm ci`, and regenerated a clean native project with `EXPO_NO_INTERACTIVE=1 npx expo prebuild --platform ios --clean`.
- Built the clean temp project for arm64 iOS Simulator.
- Built the root workspace for arm64 iOS Simulator before the Expo Constants runtime fix.
- Rebuilt the clean temp project after the Expo Constants runtime fix.
- Rebuilt the clean temp project again after seller workflow and map/form fixes.
- Installed and launched the simulator app with `xcrun simctl install` and `xcrun simctl launch`.
- Built, installed, and launched the clean Release simulator app without Metro.
- Built a signed generic `iphoneos` Release app with ML Kit linked using a temporary local bundle ID override.
- Attempted install to paired physical iPhone; install is blocked until the device is unlocked so Xcode/CoreDevice can mount the developer disk image.

Current simulator status:
- Simulator launch is no longer blocked by ML Kit.
- OCR is intentionally unavailable in simulator mode when `LASTBITE_DISABLE_IOS_MLKIT=1` is used.
- Physical-device builds should use `npm run pods:ios:device` so ML Kit remains linked for camera/OCR validation.
- Direct `expo run:ios --device <simulator>` and root Xcode rebuilds may still be sensitive to this machine's Desktop path and Xcode destination discovery.
- The verified development fallback is the clean `/tmp/lastbite-mobile-clean` path, `LASTBITE_DISABLE_IOS_MLKIT=1` Xcode Debug build, Metro via `EXPO_NO_INTERACTIVE=1 npx expo start --localhost --clear --port 8081`, and `simctl install/launch`.
- The verified standalone simulator path is the clean `/tmp/lastbite-mobile-clean` Release build at `/tmp/lastbite-sim-release-dd/Build/Products/Release-iphonesimulator/LastBite.app`, installed and launched with Metro stopped.
- Keep at least several GiB of free space before fresh native reruns. Old `/tmp/lastbite-*` DerivedData directories can consume tens of GiB and cause non-code `errno=28` build failures.
- `xcrun simctl openurl` deep links trigger an iOS "Open in LastBite?" confirmation prompt on fresh devices, and macOS accessibility restrictions prevent accepting that prompt programmatically in this environment. A fresh simulator was used to remove the stale prompt and verify cold launch; the buyer feed-to-reservation, Favorites, buyer-to-seller-auth-entry, guarded authenticated restaurant-seller, and guarded shop Inventory surface paths are now covered by XCTest. Real Supabase seller sessions, backend mutations, shop inventory CRUD, physical scanner/camera/OCR behavior, and map gestures still require additional QA.

Current physical-device status:
- A paired iPhone 16 Pro is available and Developer Mode is enabled.
- A valid Apple Development signing identity is installed.
- Device pods and a signed generic `iphoneos` Release build now pass with ML Kit/OCR linked.
- The committed production bundle ID `com.lastbite.app` is not provisioned for the local Apple team; production signing requires the correct Apple team/profile or a team-owned bundle identifier.
- Direct install/run on the physical iPhone remains blocked because the device is locked and CoreDevice cannot mount the developer disk image.
- Fresh native UI result regeneration is available again for the arm64 simulator path after refreshing simulator pods without ML Kit; the latest product-detail close-button run passed with one XCTest and zero failures.

Current backend status:
- The app has no configured real Supabase project in this workspace.
- Local Supabase was attempted in `/tmp/lastbite-mobile-clean`, but Docker Desktop/containerd cannot pull images reliably in the current machine state.
- Production-like seller auth, seller mutations, inventory CRUD, seller order lifecycle, and reservation lifecycle validation still require a working local Supabase stack or real Supabase credentials.

Conclusion:
- Local simulator launch is verified for both Metro-backed Debug and standalone Release simulator builds.
- Interactive walkthrough is partially complete; the current proof covers build/install/launch, initial buyer feed rendering with localized chrome and seed content, component-level workflow coverage, native buyer reservation tap-through, native Favorites add/remove, native seller auth entry, guarded authenticated restaurant-seller surfaces, guarded shop Inventory surfaces, and a signed generic physical-device Release build with ML Kit linked. Real-backend seller workflows, physical scanner/camera/OCR runtime behavior, and physical-device install/launch remain incomplete.

## 2026-05-28 Follow-up Validation

Fresh simulator status:
- `LastBite Release Current iPhone 17` (`4C77E440-3765-4A8D-B89A-C9908BA5746D`) is booted.
- `xcrun simctl launch 4C77E440-3765-4A8D-B89A-C9908BA5746D com.lastbite.app` returned `com.lastbite.app: 62668` after the arm64 Release simulator rebuild/install.
- `xcrun simctl get_app_container 4C77E440-3765-4A8D-B89A-C9908BA5746D com.lastbite.app app` resolved to the installed `LastBite.app` bundle in the simulator container.
- Fresh screenshot captured on 2026-05-28: `docs/mobile-qa/artifacts/2026-05-28-followup/buyer-feed-current.png`.
- Post-fix arm64 Release simulator screenshot copied on 2026-05-28: `docs/mobile-qa/artifacts/2026-05-28-followup/buyer-feed-post-fix-arm64.png`.
- Visual check of the screenshot confirms the buyer feed is rendering with Russian chrome, localized seed offer titles, safe-area spacing below the Dynamic Island, Apple Maps, offer cards, and localized bottom tabs.
- Focused regression command from `/tmp/lastbite-mobile-clean`: `npm test -- --runInBand localized-offers localized-ui-copy auth-screen-selectors`; result: 3 suites passed, 12 tests passed.
- Fresh dual-agent pass was run on 2026-05-28. The critical reviewer confirmed the remaining blockers are real backend E2E, physical-device camera/OCR runtime QA, production signing/TestFlight validation, non-atomic public reservation inserts, and stale seller/shop screenshot evidence. The solution-engineer pass added an offer-detail localization regression test; the main thread implemented that fix and added scanner modal localization coverage.
- Follow-up implementation verification from `/tmp/lastbite-mobile-clean`: `npm test -- --runInBand localized-offers localized-ui-copy auth-screen-selectors scanner-localization offer-detail-screen`; result: 5 suites passed, 20 tests passed.
- Follow-up type verification from `/tmp/lastbite-mobile-clean`: `npm run typecheck`; result: exit 0.

Fresh physical-device status:
- `xcrun devicectl list devices` still sees `iPhone Nodir`, iPhone 16 Pro (`iPhone17,1`), CoreDevice identifier `16CA05A4-342A-5ED9-9EB6-D12406F2F0BD`, available and paired.
- `xcrun devicectl device info lockState --device 16CA05A4-342A-5ED9-9EB6-D12406F2F0BD` reports `passcodeRequired: true` and `unlockedSinceBoot: true`.
- `xcrun devicectl device info ddiServices --device 16CA05A4-342A-5ED9-9EB6-D12406F2F0BD` still fails while enabling developer disk image services with `kAMDMobileImageMounterDeviceLocked: The device is locked.`
- Direct physical install/launch and physical camera/OCR QA therefore remain blocked by device lock state.

Fresh backend status:
- Workspace still has no real Supabase environment file; only `.env.example` is present.
- Supabase CLI is installed at version `2.22.12`, and the CLI reports that `2.101.0` is available.
- Docker Desktop remains unhealthy in the current machine state: a deterministic 15-second `docker info` wrapper timed out, and a deterministic 20-second `docker pull hello-world:latest` wrapper also timed out without a successful image pull.
- Local Supabase E2E remains blocked by Docker daemon/containerd behavior, and real Supabase E2E remains blocked by missing project credentials.

Fresh Xcode/native automation status:
- Simulator pods were refreshed with `LASTBITE_DISABLE_IOS_MLKIT=1`, removing stale simulator ML Kit/MLImage pods before the arm64 simulator build.
- Arm64 Release simulator build/install/launch passed from `/tmp/lastbite-mobile-clean` with `CODE_SIGNING_ALLOWED=NO`, `ONLY_ACTIVE_ARCH=YES`, `ARCHS=arm64`, and `EXCLUDED_ARCHS=x86_64`.
- Native UI test `LastBiteUITests/testBuyerOfferDetailCloseButtonFlow` passed on `LastBite Release Current iPhone 17`; `xcresulttool get test-results summary` reports `result: "Passed"`, `passedTests: 1`, `failedTests: 0`, `totalTestCount: 1`.
- Opening `lastbite://offer/9` directly is still interrupted by the iOS "Open in LastBite?" confirmation prompt, so the product-detail close-button proof is the native UI test rather than a manual deep-link screenshot.

Product-detail close button and mixed-language follow-up:
- Added an offer-detail close button with `testID="offer-detail-close-button"` that calls `router.back()`.
- Localized buyer offer detail labels, reservation button/status/failure messages, pickup-code copy, map marker callouts, and displayed prices.
- Localized seller scanner modal title, camera permission actions, OCR capture action, close action, and fallback OCR error copy.
- Focused pre-fix regression coverage failed as expected for the missing detail close button and Russian copy regressions.
- Focused post-fix regression command from `/tmp/lastbite-mobile-clean`: `npm test -- --runInBand offer-detail-screen offers-map localized-ui-copy`; result: 3 suites passed, 16 tests passed.
- Scanner localization regression command from `/tmp/lastbite-mobile-clean`: `npm test -- --runInBand scanner-localization offer-detail-screen`; result: 2 suites passed, 8 tests passed.
- Seller validation and Inventory card regression command from `/tmp/lastbite-mobile-clean`: `npm test -- --runInBand inventory-card-localization seller-screen-errors`; result: 2 suites passed, 6 tests passed.
- Inventory validation regression command from `/tmp/lastbite-mobile-clean`: `npm test -- --runInBand seller-screen-errors inventory-screen-selectors`; result: 2 suites passed, 7 tests passed.
- Profile validation regression command from `/tmp/lastbite-mobile-clean`: `npm test -- --runInBand seller-screen-errors seller-authenticated-screen-selectors`; result: 2 suites passed, 10 tests passed.
- Map callout tap-through regression command from `/tmp/lastbite-mobile-clean`: `npm test -- --runInBand offers-map buyer-feed-screen`; result: 2 suites passed, 5 tests passed.
- Full post-fix validation from `/tmp/lastbite-mobile-clean`: `npm run typecheck` passed, `npm run lint` passed, and `npm test -- --runInBand` passed with 33 suites and 92 tests.
- Native product-detail close-button follow-up passed via `LastBiteUITests/testBuyerOfferDetailCloseButtonFlow`; manual deep-link screenshot capture remains blocked by the iOS open-url prompt.

Phase 1 reservation-history follow-up:
- Added buyer Reservations tab/screen with active, completed, cancelled, and expired filters.
- Added local reservation-history provider backed by AsyncStorage metadata and SecureStore pickup-code storage. The reservation metadata payload keeps only a code hint; the full `LB-...` pickup code is revealed through the retrieval flow.
- Added a private AsyncStorage pickup-code fallback for simulator or device environments where SecureStore is unavailable because required entitlements are absent. SecureStore remains the primary path.
- Product detail now persists successful reservations into shared buyer history and disables duplicate active reservations for the same offer.
- Seller-backed reservation creation now returns a recoverable local reservation when Supabase sync is unavailable, so network/configuration interruptions do not discard the buyer's pickup code.
- Added focused regression coverage in `__tests__/reservation-history.test.ts`, `__tests__/reservations-store.test.tsx`, `__tests__/buyer-reservations-screen.test.tsx`, `__tests__/reservations.test.ts`, and `__tests__/offer-detail-screen.test.tsx`.
- Focused Phase 1 regression command from `/tmp/lastbite-mobile-clean`: `npm test -- --runInBand reservations-store reservation-history reservations buyer-reservations-screen offer-detail-screen`; result: 5 suites passed, 18 tests passed.
- Full Phase 1 JS regression command from `/tmp/lastbite-mobile-clean`: `npm test -- --runInBand`; result: 33 suites passed, 92 tests passed.
- Added native UI coverage `LastBiteUITests/testBuyerReservationHistoryRecoveryFlow` for reserving an offer, using the product-detail close button, opening Reservations, and verifying a recoverable `LB-` pickup code. Latest result bundle: `/tmp/lastbite-phase1-reservations-ui2-dd/Logs/Test/Test-LastBite-2026.05.28_11-31-36-+0500.xcresult`; `xcresulttool get test-results summary` reports `result: "Passed"`, `passedTests: 1`, `failedTests: 0`, `totalTestCount: 1`.
- Retained Phase 1 screenshot artifact: `docs/mobile-qa/artifacts/2026-05-28-phase1/buyer-reservation-history.png`. Exported XCTest attachments and manifest are under `docs/mobile-qa/artifacts/2026-05-28-phase1/xcresult-attachments/`.
- Discovered and fixed during native validation: SecureStore rejected `:` in reservation IDs, so storage keys now sanitize to `A-Z`, `a-z`, `0-9`, `.`, `_`, and `-`; Release simulator SecureStore then failed with `A required entitlement isn't present`, so pickup-code storage now falls back privately instead of failing the reservation; the native test originally attempted tab navigation while the detail route covered the tab bar, so it now validates the X close button before opening Reservations.
- Production limitation: buyer history is currently device-local and cannot yet query a real buyer-owned reservation ledger. Production still needs a reservation RPC with atomic quantity decrement, idempotency, buyer-safe select/history, cancellation, expiry handling, and RLS hardening.

Map alignment follow-up:
- The latest user-provided temporary screenshot path was no longer readable, so the map issue was validated against the current iOS Simulator rendering.
- Fixed the buyer feed map frame by wrapping `MapView` in a stable `offers-map-frame`, clipping the rounded container, and absolute-filling the native map layer within that container.
- Added `mapPadding` and stable centered marker geometry so map labels and markers render consistently inside the visible frame.
- Added a fixed 48 px marker touch frame, centered `anchor`/`centerOffset`, and marker `testID`s so tapping a location selects the intended offer.
- Fixed cramped iOS map callout rendering by giving the callout an explicit 220 px content width and line-height values for longer Russian text.
- Exposed selected offer cards through native selected accessibility state so map-tap selection can be asserted in XCTest without depending on map callout presentation.
- Focused map/feed regression command from `/tmp/lastbite-mobile-clean`: `npm test -- --runInBand offers-map buyer-feed-screen`; result: 2 suites passed, 7 tests passed.
- Full post-map-fix validation from `/tmp/lastbite-mobile-clean`: `npm run typecheck` passed, `npm run lint` passed, and `npm test -- --runInBand` passed with 33 suites and 94 tests.
- Release simulator validation: rebuilt with `LASTBITE_DISABLE_IOS_MLKIT=1`, installed, and launched on `LastBite Release Current iPhone 17` (`4C77E440-3765-4A8D-B89A-C9908BA5746D`) with PID `46111`.
- Native map tap validation: `LastBiteUITests/testBuyerMapLocationTapSelectsVisibleOffer` passed on the same iPhone 17 simulator; `xcresulttool get test-results summary` for `/tmp/lastbite-map-selected-rerun.xcresult` reports `result: "Passed"`, `passedTests: 1`, `failedTests: 0`, `totalTestCount: 1`.
- Retained screenshot artifact: `docs/mobile-qa/artifacts/2026-05-28-map-fix/buyer-feed-map-aligned.png`.
- Exported native before/after tap screenshots and manifest: `docs/mobile-qa/artifacts/2026-05-28-map-fix/xcresult-attachments/`.

Phase 2 multilingual follow-up:
- Added an in-app language switcher in Settings that updates visible UI text dynamically between English and Russian without an app restart.
- Added typed multilingual seller content fields for seller profiles and seller offers. Profile translations cover business name, category, and address; offer translations cover title, restaurant display name, location address, and contents text.
- Added seller form inputs for English/Russian profile content and English/Russian package title/contents text. Published seller offers now carry translation payloads into the buyer marketplace.
- Added Supabase schema support through `seller_profiles.translations jsonb not null default '{}'::jsonb` and `seller_offers.translations jsonb not null default '{}'::jsonb`, plus idempotent `alter table` migration statements. These schema changes still need to be applied to the real project before production backend QA.
- Updated buyer Feed, Favorites, and offer detail to localize seller-published offers through the same locale pipeline used for seed marketplace content.
- Focused Phase 2 regression commands from `/tmp/lastbite-mobile-clean`: `npm test -- --runInBand __tests__/localized-offers.test.ts __tests__/meal-package-form.test.tsx __tests__/buyer-feed-screen.test.tsx` passed with 3 suites and 8 tests, and `npm test -- --runInBand __tests__/locale-provider-dynamic.test.tsx` passed with 1 suite and 1 test.
- Full Phase 2 JS validation from `/tmp/lastbite-mobile-clean`: `npm run typecheck` passed, `npm run lint` passed, and `npm test -- --runInBand` passed with 34 suites and 98 tests.
- Native Phase 2 validation from `/tmp/lastbite-mobile-clean`: `LastBiteUITests/testBuyerSettingsLanguageSwitchUpdatesVisibleCopy` passed on `LastBite Release Current iPhone 17` (`4C77E440-3765-4A8D-B89A-C9908BA5746D`) with the Release simulator build.
- Retained Phase 2 screenshots: `docs/mobile-qa/artifacts/2026-05-28-phase2/app-feed-after-launch.png` and `docs/mobile-qa/artifacts/2026-05-28-phase2/settings-language-ru-app.png`. The earlier `settings-language-ru.png` file captured the iOS home screen after XCTest teardown and is excluded from UI evidence.
- Discovered and fixed during Phase 2 validation: the initial dynamic-locale test mock had untyped AsyncStorage function parameters that failed TypeScript under the project config; the test now uses typed mock parameters. No visual overlap or unsafe-area regression was visible in the retained Russian feed and Settings screenshots, though broader device-size and Dynamic Type checks remain outstanding.

Phase 3 product-detail follow-up:
- Added buyer product-detail sections for what the buyer may receive, pickup instructions, dietary badges, allergens, and cancellation/refund policy.
- Added localized Russian metadata for the seeded Butter House pastry offer so the longer product-detail text renders in the actual app state used by simulator QA.
- Added seller product metadata capture in the meal package form with stable controls for pickup instructions, dietary badges, allergens, and cancellation policy.
- Added end-to-end app data support for the new metadata fields through `Offer`, `SellerOffer`, `MealPackageDraft`, seller create submission, seller offer inserts, marketplace selects, marketplace row mapping, and local offer localization.
- Added Supabase migration fields on `seller_offers`: `allergens jsonb`, `dietary_badges jsonb`, `pickup_instructions text`, and `cancellation_policy text`. These fields still need real-project migration validation before production backend QA.
- Focused Phase 3 regression commands from `/tmp/lastbite-mobile-clean`: `npm test -- --runInBand __tests__/offer-detail-screen.test.tsx __tests__/meal-package-form.test.tsx __tests__/marketplace-mappers.test.ts` passed with 3 suites and 11 tests, and `npm test -- --runInBand __tests__/seller-screen-errors.test.tsx` passed with 1 suite and 6 tests after making create-offer parsing tolerate older mocked drafts without optional product metadata.
- Full Phase 3 JS validation from `/tmp/lastbite-mobile-clean`: `npm run typecheck` passed, `npm run lint` passed, and `npm test -- --runInBand` passed with 34 suites and 100 tests.
- Native Phase 3 validation from `/tmp/lastbite-mobile-clean`: `LastBiteUITests/testBuyerOfferDetailCloseButtonFlow` passed on `LastBite Release Current iPhone 17` (`4C77E440-3765-4A8D-B89A-C9908BA5746D`) with `result: "Passed"`, `passedTests: 1`, `failedTests: 0`, `totalTestCount: 1`.
- Retained Phase 3 screenshot: `docs/mobile-qa/artifacts/2026-05-28-phase3/product-detail-sections.png`. Exported XCTest attachment and manifest are under `docs/mobile-qa/artifacts/2026-05-28-phase3/xcresult-attachments/`.
- Visual review of the retained screenshot shows the Russian detail page renders without overlap, the close button remains visible, badges wrap cleanly, and the primary reserve button remains reachable below the policy section.

Phase 4 map/discovery follow-up:
- Added buyer radius filtering controls for 1 km, 3 km, 5 km, and all distances.
- Added a Near Me action backed by `expo-location` foreground permission requests. When permission succeeds, the app stores the current device coordinates, sorts discovery by distance, applies the default 3 km radius, and renders a user-location marker on the map. When permission is denied or unavailable, the app keeps discoverable offers visible and shows a localized fallback message instead of emptying the feed.
- Added coordinate-aware distance filtering and sorting through `lib/geo.ts`; seeded/offline offers still have a parsed text-distance fallback so discovery remains usable without live location.
- Updated map region calculation so filtered offers, selected markers, and user location stay in the same visible region.
- Updated marker-to-list synchronization: tapping a map marker selects the matching offer card and scrolls it into view. During simulator screenshot review, the selected card initially scrolled under the iOS status area; this was fixed by making `ScreenScrollView` clip its viewport below the top safe area and by leaving a stable selected-card scroll gutter.
- Added regression coverage in `__tests__/filters.test.ts`, `__tests__/map-region.test.ts`, `__tests__/offers-map.test.tsx`, `__tests__/buyer-feed-screen.test.tsx`, and `__tests__/screen-scroll-view.test.tsx`.
- Focused Phase 4 regression command from `/tmp/lastbite-mobile-clean`: `npm test -- --runInBand __tests__/filters.test.ts __tests__/map-region.test.ts __tests__/offers-map.test.tsx __tests__/buyer-feed-screen.test.tsx`; result: 4 suites passed, 20 tests passed. Safe-area scroll regression command: `npm test -- --runInBand __tests__/screen-scroll-view.test.tsx __tests__/buyer-feed-screen.test.tsx`; result: 2 suites passed, 8 tests passed.
- Full Phase 4 JS validation from `/tmp/lastbite-mobile-clean`: `npm run typecheck` passed, `npm run lint` passed, and `npm test -- --runInBand` passed with 34 suites and 109 tests.
- Native Phase 4 validation from `/tmp/lastbite-mobile-clean`: `LastBiteUITests/testBuyerDiscoveryRadiusControlsFilterVisibleOffers` passed on `LastBite Release Current iPhone 17` (`4C77E440-3765-4A8D-B89A-C9908BA5746D`) with `result: "Passed"`, `passedTests: 1`, `failedTests: 0`, `totalTestCount: 1`.
- Native Phase 4 map-tap validation from `/tmp/lastbite-mobile-clean`: `LastBiteUITests/testBuyerMapLocationTapSelectsVisibleOffer` passed on the same iPhone 17 simulator after the safe-area scroll fix with `result: "Passed"`, `passedTests: 1`, `failedTests: 0`, `totalTestCount: 1`.
- Retained Phase 4 screenshots: `docs/mobile-qa/artifacts/2026-05-28-phase4/buyer-radius-filtered-discovery.png`, `docs/mobile-qa/artifacts/2026-05-28-phase4/buyer-map-aligned-before-location-tap.png`, and `docs/mobile-qa/artifacts/2026-05-28-phase4/buyer-map-selected-after-location-tap.png`. Exported XCTest attachments and manifests are under `docs/mobile-qa/artifacts/2026-05-28-phase4/xcresult-radius-final/` and `docs/mobile-qa/artifacts/2026-05-28-phase4/xcresult-map-sync-final/`.
- Visual review of the retained screenshots confirms the Russian radius controls fit, the map frame and markers are aligned, the 1 km filter shows the expected two offers, and the selected card is visible below the safe-area band after a map marker tap.
- Tooling issue discovered: `npx expo install expo-location` fails under the local Node 24 Expo CLI path with `installEventLogger is not a function`. The compatible Expo SDK version was read from `node_modules/expo/bundledNativeModules.json`, `expo-location@55.1.10` was packed and extracted locally, package metadata was updated, and `pod install` succeeded from the clean no-space path. Root-path `pod install` still hangs in Expo autolinking because the workspace path contains spaces.

Phase 5 pickup reminder follow-up:
- Added local pickup reminder scheduling through `expo-notifications` with a dedicated `pickup-reminders` channel, permission handling, foreground notification behavior, and notification-tap routing back to `/reservations`.
- Persisted reminder status, notification id, scheduled time, and recoverable error state with buyer reservation history. Reservation completion, cancellation, and expiry cleanup cancel pending reminder records so reminders do not duplicate after lifecycle transitions.
- Added localized reminder status copy on offer confirmation and reservation-history cards, including scheduled, disabled, permission-blocked, scheduling-failed, seller-sync-failed, cancelled, and expired states.
- Added deterministic simulator E2E reminder mode behind `EXPO_PUBLIC_LASTBITE_E2E_PICKUP_REMINDERS=mock`; this keeps native UI tests time-stable while production code still uses the OS notification scheduler.
- Fixed a partial-linguality issue in persisted reservation metadata by passing localized pickup-window copy into buyer and seller-backed reservation creation instead of storing an English `Pickup by ...` fallback in Russian app flows.
- Native test issue discovered and fixed: the original reminder smoke test tried to reserve `offer-card-3`, which existed but was not hittable because it sat near the bottom tab bar on the iPhone 17 viewport. The test now reserves a first-visible Meals card and verifies the reminder status in Reservations.
- Focused Phase 5 regression commands from `/tmp/lastbite-mobile-clean`: `npm test -- --runInBand __tests__/pickup-reminders.test.ts __tests__/reservations-store.test.tsx __tests__/offer-detail-screen.test.tsx` passed with 3 suites and 19 tests after the deterministic E2E reminder fix.
- Full Phase 5 JS validation from `/tmp/lastbite-mobile-clean`: `npm test -- --runInBand` passed with 35 suites and 119 tests, `npx tsc --noEmit` passed, and `npm run lint` passed.
- Native Phase 5 validation from `/tmp/lastbite-mobile-clean`: `LastBiteUITests/testBuyerPickupReminderStatusFlow` passed on `LastBite Release Current iPhone 17` (`4C77E440-3765-4A8D-B89A-C9908BA5746D`) with `result: "Passed"`, `passedTests: 1`, `failedTests: 0`, `totalTestCount: 1`.
- Retained Phase 5 screenshot: `docs/mobile-qa/artifacts/2026-05-28-phase5/buyer-pickup-reminder-scheduled.png`. Exported XCTest attachment and manifest are under `docs/mobile-qa/artifacts/2026-05-28-phase5/xcresult-reminder-final/`.
- Visual review of the retained screenshot confirms the Russian Reservations screen renders without overlap, the active reservation card includes the localized pickup window, the pickup code is recoverable, and the reminder status is visible above fulfillment actions.
- Production gap: this phase implements local device reminders, not backend push tokens or server-triggered push delivery. Real-device notification permission prompts, lock-screen delivery, app-killed delivery, and notification preferences still need physical-device/TestFlight validation.

Phase 6 reliability/state-handling follow-up:
- Critical-review audit found four highest-impact reliability gaps: seller-published marketplace offers disappeared silently on live refresh failure, seller-backed reservation sync could wait indefinitely without a retry path, seller orders could fall into misleading empty states after thrown load failures, and seller Inventory/Create screens ignored store load failures.
- Buyer discovery now preserves stale seller-published offers when refresh fails, shows localized marketplace loading/error panels, keeps seed/offline discovery usable, and exposes a retry action with `feed-marketplace-error-state`.
- Seller-backed reservation sync now has timeout protection, persisted `syncError` metadata, and `retryReservationSync`, which rebuilds the seller pickup order from the locally stored secure pickup code. Offer detail now shows a retryable failed-sync panel instead of only generic local/demo copy.
- Seller orders now catch thrown load failures, keep stale orders, render retryable `orders-error-state`, suppress misleading empty states while failed, and disable manual/card verification controls while a pickup verification is in flight.
- Seller Inventory now renders `inventory-loading-state`, `inventory-error-state`, `inventory-empty-state`, and retry controls from the inventory store. Create Offer now renders `create-offer-loading-state`, `create-offer-error-state`, `published-offers-empty-state`, and retry controls from the seller-offers store.
- Product detail confirmation now includes a localized `View reservation` action that routes directly to reservation history, keeping secure pickup-code recovery reachable when a reservation already exists from a previous app run.
- Added regression coverage in `__tests__/marketplace-store.test.tsx`, `__tests__/buyer-feed-screen.test.tsx`, `__tests__/reservations.test.ts`, `__tests__/reservations-store.test.tsx`, `__tests__/offer-detail-screen.test.tsx`, `__tests__/orders-store.test.tsx`, `__tests__/orders-screen.test.tsx`, `__tests__/inventory-screen-selectors.test.tsx`, `__tests__/seller-screen-errors.test.tsx`, and `__tests__/seller-workflow-errors.test.tsx`.
- Focused Phase 6 regression command from `/tmp/lastbite-mobile-clean`: `npx jest __tests__/marketplace-store.test.tsx __tests__/buyer-feed-screen.test.tsx __tests__/reservations.test.ts __tests__/reservations-store.test.tsx __tests__/offer-detail-screen.test.tsx __tests__/orders-store.test.tsx __tests__/orders-screen.test.tsx __tests__/inventory-screen-selectors.test.tsx __tests__/seller-screen-errors.test.tsx __tests__/seller-workflow-errors.test.tsx --runInBand --forceExit`; result: 10 suites passed, 50 tests passed.
- Full Phase 6 JS validation from `/tmp/lastbite-mobile-clean`: `npm test -- --runInBand` passed with 36 suites and 132 tests, `npx tsc --noEmit` passed, and `npm run lint` passed.
- Validation issue discovered and fixed in the Phase 6 tests: a reservation-store regression used a pickup time that had already expired on May 28, 2026, causing reminder metadata to be correctly cancelled during refresh. The test fixture now uses a later pickup window so it validates persistence rather than expiry cleanup.
- Native validation issue discovered and fixed: the pickup-reminder smoke test initially failed on a repeated simulator run because a persisted reservation for the same Meals offer caused the product detail page to show only the secure code hint. The app now exposes a direct history CTA, and the native flow validates the confirmation panel plus reservation-history reminder status instead of assuming a fresh code every run.
- Native Phase 6 validation from `/tmp/lastbite-mobile-clean`: `LastBiteUITests/testBuyerOfferDetailCloseButtonFlow`, `LastBiteUITests/testBuyerDiscoveryRadiusControlsFilterVisibleOffers`, and `LastBiteUITests/testBuyerPickupReminderStatusFlow` passed on `LastBite Release Current iPhone 17` (`4C77E440-3765-4A8D-B89A-C9908BA5746D`) with `result: "Passed"`, `passedTests: 3`, `failedTests: 0`, `totalTestCount: 3`. Result bundle: `/tmp/lastbite-phase6-reliability-dd/Logs/Test/Test-LastBite-2026.05.28_19-17-42-+0500.xcresult`.
- Phase 6 screenshots/attachments were exported to `docs/mobile-qa/artifacts/2026-05-28-phase6/xcresult-smoke/` with `manifest.json` mapping the radius-filter, product-detail, and pickup-reminder screenshots to their XCTest cases.
- Production gap: Phase 6 improves client predictability under unstable network conditions, but real-backend latency, Supabase timeout behavior, and offline/reconnect UX still need validation against a real Supabase project or repaired local Supabase containers.

Phase 7 seller-experience follow-up:
- Critical-review audit found seller lifecycle gaps after the Phase 6 reliability pass: the dashboard had no setup checklist, cancelled seller orders were not inspectable, order cards did not clearly show lifecycle progression, and pickup verification could accept already-handled orders if the backend row still matched the seller id.
- Seller dashboard now renders a localized setup checklist with profile, first listing, and first pickup milestones. Restaurant sellers are guided to create their first package, while shop sellers are guided to Inventory. Each incomplete checklist row has a direct action into the relevant tab/screen.
- Seller orders now include Pending, Collected, and Cancelled segments; each order card renders a localized status badge plus lifecycle chips for Reserved, Pickup window, and Collected or Reservation cancelled.
- Manual pickup-code entry now trims and uppercases submitted codes, status filters expose selected accessibility state, and verification buttons/input controls have clearer native accessibility labels.
- `verifyPickup` now updates only `pending` orders, selects the updated id, and rejects the flow with `This pickup order is no longer pending.` when the order was already collected or cancelled.
- Added regression coverage in `__tests__/seller-authenticated-screen-selectors.test.tsx`, `__tests__/orders-screen.test.tsx`, and `__tests__/orders-store.test.tsx`.
- Focused Phase 7 regression command from `/tmp/lastbite-mobile-clean`: `npx jest __tests__/seller-authenticated-screen-selectors.test.tsx __tests__/orders-screen.test.tsx __tests__/orders-store.test.tsx --runInBand --forceExit`; result: 3 suites passed, 12 tests passed.
- Full Phase 7 JS validation from `/tmp/lastbite-mobile-clean`: `npm test -- --runInBand` passed with 36 suites and 135 tests, `npx tsc --noEmit --pretty false` passed, and `npm run lint` passed.
- Native Phase 7 validation from `/tmp/lastbite-mobile-clean`: `LastBiteUITests/testAuthenticatedSellerSurfaceFlow` passed on `LastBite Release Current iPhone 17` (`4C77E440-3765-4A8D-B89A-C9908BA5746D`) with `result: "Passed"`, `passedTests: 1`, `failedTests: 0`, `totalTestCount: 1`. Result bundle: `/tmp/lastbite-phase7-seller-dd/Logs/Test/Test-LastBite-2026.05.28_19-40-34-+0500.xcresult`.
- Native validation issue discovered and fixed: the expanded multilingual seller profile made the switch-back-to-buyer button sit below the initial iPhone 17 viewport. The test now scrolls the profile before asserting and tapping that bottom action, matching the real mobile gesture path.
- Phase 7 screenshots/attachments were exported to `docs/mobile-qa/artifacts/2026-05-28-phase7/xcresult-seller/` with `manifest.json` mapping the seller dashboard, create offer, scanner modal, and profile screenshots to the XCTest case.
- Production gaps: seller order status changes still need realtime or polling if live updates are required, buyer-side cancellation/completion does not yet synchronize all seller status transitions, and inventory quantity decrement/sold-out handling should be moved into a Supabase RPC/transaction before production launch.

Phase 8 reservation lifecycle hardening:
- Selected implementable scope: buyer cancellation propagation for synced seller-backed reservations, because it closes the highest-impact local consistency gap without requiring real Supabase credentials or a schema migration.
- Added `syncPickupOrderStatus`, which updates `pickup_orders` through a pending-only match on `seller_id`, `offer_id`, `reservation_code`, and `status = pending`, then returns a recoverable sync error if the seller order was already handled.
- Buyer reservation cancellation now loads the secure local pickup code and attempts to mark the matching seller pickup order `cancelled` only for reservations that previously synced to the seller side. The buyer reservation still moves to local `cancelled` status if the seller sync fails, and its `syncStatus`/`syncError` expose the divergence.
- Added regression coverage in `__tests__/reservations.test.ts` and `__tests__/reservations-store.test.tsx`.
- Focused Phase 8 red/green command from `/tmp/lastbite-mobile-clean`: `npx jest __tests__/reservations.test.ts __tests__/reservations-store.test.tsx --runInBand --forceExit`; after implementation, result: 2 suites passed, 15 tests passed.
- Full Phase 8 JS validation from `/tmp/lastbite-mobile-clean`: `npm test -- --runInBand` passed with 36 suites and 138 tests, `npx tsc --noEmit --pretty false` passed, and `npm run lint` passed.
- Native UI was not rerun for Phase 8 because no visible layout/navigation changed. The current native seller UI evidence remains the Phase 7 `testAuthenticatedSellerSurfaceFlow` pass and exported screenshots.
- Production gaps: buyer-marked completion remains local-only by design until the product decides whether buyers can mark seller orders collected; expiry-to-seller cancellation, quantity decrement/sold-out handling, and cross-device buyer history still need server-owned RPC/transaction work.

Phase 9 seller order freshness polish:
- Selected implementable scope: make the seller Orders manual-refresh workflow communicate data freshness without introducing background polling or realtime subscriptions before backend credentials are available.
- `useOrders` now records `lastLoadedAt` after successful Supabase order loads and clears it when seller orders cannot be loaded because Supabase/session context is unavailable.
- The seller Orders screen now renders a localized `orders-last-updated` label using the current app locale, so sellers can see when the visible order list was last refreshed.
- Added regression coverage in `__tests__/orders-store.test.tsx` and `__tests__/orders-screen.test.tsx`.
- Focused Phase 9 red/green command from `/tmp/lastbite-mobile-clean`: `npx jest __tests__/orders-store.test.tsx __tests__/orders-screen.test.tsx --runInBand --forceExit`; after implementation, result: 2 suites passed, 9 tests passed.
- Full Phase 9 JS validation from `/tmp/lastbite-mobile-clean`: `npm test -- --runInBand` passed with 36 suites and 140 tests, `npx tsc --noEmit --pretty false` passed, and `npm run lint` passed.
- Native UI was not rerun for Phase 9 because the change is a small seller Orders label and data-state propagation; the current native seller UI evidence remains the Phase 7 seller smoke. A future native seller Orders rerun should capture the last-refreshed label once real seller data is available.
- Production gap: seller Orders still need realtime or polling for automatic freshness if the product requires live order arrival without manual refresh.

Phase 10 server-owned reservation lifecycle:
- Critical-review audit confirmed the production blocker: seller-backed reservations were still direct client inserts into `pickup_orders`, public direct insert policy was open, offer quantity was never decremented, sold-out status was not server-owned, and buyer cancellation did not restore quantity.
- Added Supabase RPC `reserve_seller_offer` to `supabase/schema.sql` and `supabase/migrations/20260529000000_reservation_lifecycle_rpcs.sql`. The function is `security definer`, validates a non-empty pickup code, returns an existing order for the same code/offer idempotently, decrements `seller_offers.quantity_available`, marks the offer `sold_out` when the remaining quantity reaches zero, inserts `pickup_orders`, and returns `pickup_order_id`, status, and remaining quantity.
- Added Supabase RPC `cancel_seller_reservation`, which uses offer id plus pickup code, treats already-cancelled orders idempotently, rejects non-pending collected orders, cancels pending orders, increments quantity once, and restores `published` status when a cancellation returns stock to a sold-out offer.
- Dropped `pickup_orders_insert_public_reservations` from the schema and granted RPC execution to `anon` and `authenticated`, moving buyer reservation creation/cancellation away from broad direct table writes.
- Updated `lib/reservations.ts` so `syncPickupOrder` calls `reserve_seller_offer`, `syncPickupOrderStatus` calls `cancel_seller_reservation` for buyer cancellation, and `ReservationResult` carries returned `pickupOrderId` and `quantityAvailable`.
- Buyer reservation history now preserves `pickupOrderId` when returned by the server lifecycle RPC.
- Added regression coverage in `__tests__/reservations.test.ts` and `__tests__/supabase-reservation-lifecycle-schema.test.js`.
- Focused Phase 10 red/green command from `/tmp/lastbite-mobile-clean`: `npx jest __tests__/reservations.test.ts __tests__/supabase-reservation-lifecycle-schema.test.js --runInBand --forceExit`; after implementation, result: 2 suites passed, 10 tests passed.
- Full Phase 10 JS validation from `/tmp/lastbite-mobile-clean`: `npm test -- --runInBand` passed with 37 suites and 142 tests, `npx tsc --noEmit --pretty false` passed, and `npm run lint` passed.
- Native UI was not rerun for Phase 10 because the change is backend contract/client data handling rather than visible layout. Real Supabase migration application, RPC execution against project credentials, and end-to-end buyer/seller lifecycle QA remain required.

## Completion Audit Against `goal.md`

Overall status: simulator-preview launch is achieved; full production-grade mobile workflow validation is still incomplete because several required checks need external services or hardware.

Completed:
- Document mobile-version work: this report and the README now cover setup, launch paths, issues, root causes, applied fixes, validation results, remaining risks, and production recommendations.
- Launch on iOS Simulator: the standalone Release simulator app was rebuilt, installed, and launched on `LastBite Release Current iPhone 17` (`4C77E440-3765-4A8D-B89A-C9908BA5746D`); retained feed screenshots include `docs/mobile-qa/artifacts/2026-05-28-followup/buyer-feed-post-fix-arm64.png` and the latest map-alignment artifact at `docs/mobile-qa/artifacts/2026-05-28-map-fix/buyer-feed-map-aligned.png`.
- Run through Xcode: the clean `/tmp/lastbite-mobile-clean` Release iOS Simulator build passes through `xcodebuild`, embeds `main.jsbundle`, and launches without Metro.
- Run through physical-device build path: the clean `/tmp/lastbite-mobile-clean` generic `iphoneos` Release build passes through `xcodebuild`, embeds `main.jsbundle`, links ML Kit/OCR resources, and signs with a local Apple Development identity under a temporary bundle ID override.
- Fix and retest discovered simulator issues: cold-launch routing, safe-area overlap, Expo Constants runtime config, explicit tab icons, missing native selectors, seller auth routing, seller error handling, seller orders states, map-region control, nested scroll risk, simulator ML Kit linking, default-locale copy, seed marketplace localization, seller onboarding close button, offer-detail close button, buyer detail/map/price localization, buyer reservation-history recovery, map alignment/tap selection, seller multilingual content support, product-detail metadata sections, radius discovery controls, Near Me fallback handling, marker-to-card safe-area scroll sync, pickup reminder status rendering, localized persisted pickup windows, repeated-reservation history routing, marketplace refresh failure states, reservation sync timeout/retry state, seller order thrown-error handling, seller Inventory/Create loading/error/empty states, seller setup checklist rendering, seller cancelled-order visibility, seller lifecycle badges, pending-only pickup verification, long-profile native scrolling, synced seller-order cancellation from buyer reservations, and seller order freshness visibility have been fixed and retested through JS coverage; the reservation-history recovery, map tap, radius filtering, Settings language-switch, product-detail section/close, pickup reminder, Phase 6 smoke, and Phase 7 seller smoke paths also have passing native simulator UI tests.
- Validate key simulator workflows: lint, typecheck, Jest, Release build, default native UI tests, guarded authenticated restaurant-seller tests, guarded shop Inventory tests, Phase 1 reservation-history recovery, map location tap selection, Phase 2 Settings language switching, Phase 3 product-detail sections, Phase 4 discovery radius filtering, Phase 5 pickup reminder status, Phase 6 reliability states, Phase 7 seller setup/lifecycle states, Phase 8 cancellation lifecycle sync, Phase 9 seller order freshness state, and Phase 10 server-owned reservation lifecycle contract pass from the clean no-space validation copy; the latest Phase 10 JS validation is 37 Jest suites and 142 tests passing.

Partially completed:
- Inspect rendering and behavior across screens: buyer feed, offer detail, Favorites, Settings, seller auth, guarded restaurant seller, and guarded shop Inventory surfaces are covered by screenshots and native UI automation. Real seller sessions, production backend state changes, physical scanner flows, and full map gesture behavior still need direct QA.
- Verify UI, responsiveness, navigation, and interactions: current coverage proves core simulator navigation and interactions on the iPhone 17 simulator, and the generic physical-device build/sign path. It does not yet prove a broader device matrix, physical keyboard/camera/permission behavior, accessibility, real backend latency states, or physical-device runtime behavior.
- Dual-agent workflow: critical-review and solution-engineering passes were used during the mobile QA effort. A fresh Phase 2 dispatch attempt was blocked by the existing agent-thread limit, so the main thread continued the reviewer/engineer split locally. Remaining production blockers are real Supabase E2E, physical-device install/runtime, TestFlight/signing, production reservation hardening, and real-project migration validation.

Still required before calling the active goal fully complete:
- Apply and validate Supabase migrations against the real project.
- Run real authenticated seller create-offer, inventory CRUD, orders, profile, and reservation lifecycle QA against production-like backend data.
- Restore Docker Desktop/containerd health if local Supabase is used instead of a real Supabase project.
- Unlock the paired iPhone, install/launch the signed build, and validate camera permission, OCR/scanner behavior, safe areas, keyboard behavior, and map gestures on device.
- Provision `com.lastbite.app` under the correct Apple team or change to a team-owned production bundle ID before production/TestFlight signing.
- Validate TestFlight/App Store signing and distribution readiness.
- Apply and validate the multilingual seller content and product-metadata migrations against the real Supabase project, then backfill or collect translated/product-detail content for existing sellers.

## Production Readiness Assessment

Current state: simulator-preview ready, not production-ready.

Ready:
- Root mobile app structure is present.
- JS/TypeScript/test/lint validation is green.
- Native dependencies and pods resolve.
- Clean arm64 iOS Simulator build passes.
- Clean arm64 Release iOS Simulator build launches standalone without Metro.
- Signed generic `iphoneos` Release build passes with ML Kit/OCR linked when using a temporary local bundle ID override.
- iOS Simulator install/launch has been visually verified.
- Native Release simulator UI tests pass for buyer feed filtering, map location tap-to-select, Favorites add/remove, offer-card navigation, reservation, pickup-code rendering, reservation-history recovery, Settings tab navigation, and seller auth entry.
- Guarded local-seller native UI smoke coverage passes for authenticated seller dashboard, create-offer form, orders scanner modal, seller profile, switch-back-to-buyer navigation, and returned buyer feed.
- Guarded local shop-seller native UI smoke coverage passes for Inventory intake controls and scanner modal rendering.
- Default Russian app chrome, tab labels, key controls, offer quantity labels, and seed marketplace content have focused regression coverage and pass visually in the latest simulator screenshot.
- Product/offer detail close navigation, buyer detail copy, reservation messages, map callouts, and locale-specific price formatting have focused regression coverage and pass in Jest.
- Buyer reservation history now has a tab, status filters, recoverable pickup-code reveal, local persistence after relaunch, loading/error/empty states, focused regression coverage, and a passing native simulator recovery test.
- Phase 2 multilingual support now covers dynamic Settings language switching, localized seller profile fields, localized seller offer fields, buyer rendering of seller-published translations, JSONB schema columns, focused regression coverage, and a passing native simulator Settings switch test.
- Phase 3 product-detail support now covers pickup instructions, dietary badges, allergens, cancellation/refund policy, seller metadata capture, marketplace mapping, Supabase schema fields, focused regression coverage, and a passing native simulator product-detail section test.
- Phase 4 map/discovery support now covers radius filtering, Near Me permission handling, coordinate-aware distance filtering/sorting, user-location map context, marker-to-list synchronization, safe-area scroll clipping, focused regression coverage, and passing native simulator radius/map-tap tests.
- Phase 5 pickup reminder support now covers local notification scheduling, permission/scheduling failure states, notification tap routing, reminder metadata persistence, duplicate-scheduling prevention, cancellation on reservation lifecycle transitions, localized reminder UI, focused regression coverage, and a passing native simulator reminder-status test.
- Phase 6 reliability support now covers buyer marketplace stale-data preservation and retry panels, reservation sync timeout/retry metadata, secure-code reservation-history routing from product detail, seller orders thrown-error handling and verification in-flight state, seller Inventory/Create retryable loading/error/empty states, focused regression coverage, full JS validation, and a passing native simulator reliability smoke.
- Phase 7 seller-experience support now covers dashboard setup checklists, seller order cancelled-state visibility, lifecycle status chips, pending-only pickup verification, accessibility/state polish on order filters and controls, focused regression coverage, full JS validation, and a passing native simulator seller smoke.
- Phase 8 lifecycle hardening now covers buyer cancellation propagation to pending seller pickup orders for synced seller-backed reservations, with secure pickup-code matching, recoverable failed-sync state, focused regression coverage, and full JS validation.
- Phase 9 seller Orders polish now covers latest-successful-refresh timestamps, localized freshness copy, focused regression coverage, and full JS validation.
- Phase 10 server-owned lifecycle work now covers atomic seller-offer reservation RPCs, idempotent pickup-code retry, quantity decrement/sold-out handling, cancellation restock/republish behavior, removal of public direct pickup-order insertion, focused regression coverage, and full JS validation.
- Buyer map and seller-backed reservation flow are wired.
- Seller sign-in/onboarding routing is corrected.
- Returning seller profile hydration no longer ends loading before the profile query finishes.
- Seller write failures now reject and surface user-facing alerts instead of showing success after no-op/failure paths.
- Seller orders have manual refresh, loading, error, and empty states.
- Create-offer form no longer nests vertical scroll views.
- Buyer map no longer uses a constantly controlled region.
- Critical seller profile/offer RLS gaps have been patched in `supabase/schema.sql`.

Not ready:
- Real Supabase authenticated seller session QA, backend mutation QA, inventory CRUD, and production seller order lifecycle validation are not complete yet. The current authenticated seller native pass uses a guarded local E2E fallback and does not prove production backend writes.
- Camera/OCR runtime behavior must be validated after installing and launching on an unlocked physical iPhone.
- The committed bundle identifier `com.lastbite.app` is not currently provisioned for the local Apple team.
- Local Supabase validation is blocked by Docker Desktop/containerd storage errors, and no real Supabase credentials are configured.
- Supabase schema changes must be applied to the real project.
- Multilingual `translations` columns, product-metadata columns, and app writes still need real Supabase migration validation, production RLS review, and backfill/content-entry policy for existing seller data.
- Reservation inserts now have a security-definer RPC path in schema/client code, but buyer history is still device-local and the migration has not been applied against a real Supabase project. Production still needs real RPC execution validation, buyer-safe server history retrieval across devices, expiry handling, and RLS review after migration.
- Pickup reminders are local-device notifications only. Production still needs backend push-token registration, server-side reminder scheduling, notification preferences, and real-device/TestFlight delivery validation.
- Client-side retry states are now present for the major MVP surfaces, but real Supabase latency/offline/reconnect behavior has not been validated against production-like credentials.
- Seller orders still need realtime or polling if automatic post-reservation updates are required; manual refresh and clearer lifecycle states are available as the MVP fallback.
- Some async seller workflows still need broader real-backend failure QA, but the known false-success paths have regression coverage.
- Buyer offer detail and reservation behavior now has component-level regression coverage and a passing native simulator UI test, but physical-device validation is still required.
- Favorites add/remove and shared-search behavior now have focused component coverage and a passing native simulator UI test.
- Shop Inventory screen selectors and guarded shop-seller hydration have focused component coverage and a passing native simulator UI test.
- Product/offer detail close navigation now has a passing native simulator UI test; manual deep-link screenshot capture is still interrupted by the iOS open-url prompt.
- Real device QA is still required for camera, OCR, permissions, map rendering, keyboard behavior, and safe-area behavior.
- Real seller-entered multilingual content now has an app-side data path, but the real backend migration and content operations have not been validated.
- App Store/TestFlight readiness has not been validated.

## Interface Completion Backlog

High-priority additions:
- Apply and validate the Phase 2 multilingual JSONB and Phase 3 product-metadata migrations in the real Supabase project, then define the backfill/content-entry policy for existing seller profiles and offers.
- Expand the new seller setup checklist with backend configuration health, payout/business verification, pickup-hours completeness, and real Supabase profile validation once production backend credentials are available.
- Buyer map/list controls: explicit map/list toggle remains to be designed. Radius filtering, Near Me, and marker-to-card tap-through are implemented and validated on the iPhone 17 simulator; broader map gesture/device-matrix QA is still pending.
- Reservation/order status surfaces for both sides: buyer sees pending pickup history and seller now sees pending/collected/cancelled lifecycle states; buyer cancellation now attempts seller-order cancellation for synced reservations, while production still needs realtime/polling freshness and server-owned cancellation/expiry transitions.

Medium-priority additions:
- Offer detail media gallery, seller hours, and seller contact/help affordance.
- Direct-action polish on the new empty/error states, such as "Find offers", "Create first package", "Scan first item", and "Complete profile".
- Visual skeleton polish for feed, Favorites, seller dashboard, orders, profile, and Inventory. Phase 6 added functional loading/error/empty states on the highest-risk buyer/seller surfaces, but these are still simple panels rather than full skeleton layouts.
- Server-backed push delivery, notification preference controls, and real-device delivery QA for pickup reminders, expiring inventory, and new seller orders.
- Accessibility review pass for Dynamic Type, VoiceOver labels beyond automated selectors, contrast, and long Russian strings on small devices.

Production UX gates:
- Buyer can recover a device-local reservation code after leaving the detail screen; production still needs backend-owned buyer history recovery across devices.
- Seller should be able to understand whether an order list is stale, refreshing, or realtime.
- Every externally entered content field needs either a multilingual data model or a clear product decision that seller-entered text is displayed as-is.
- Physical-device QA must verify camera permission prompts, OCR/scanner fallback copy, keyboard behavior, safe areas, and map gestures on a signed build.

## Recommended Next Steps

1. For simulator work on this machine, use a no-space path such as `/tmp/lastbite-mobile-clean` or move the repo out of the Desktop path before running the verified Xcode/simctl launch path.
2. Apply and validate the Phase 10 reservation lifecycle RPCs, then add buyer-safe server history retrieval before broader public demos.
3. Capture remaining interactive QA for map gestures, real Supabase authenticated seller create/inventory/orders/profile flows, and scanner permission flow.
4. Apply `supabase/schema.sql` migrations to the target Supabase project.
5. Add server-owned reservation expiry cleanup and buyer-safe cross-device history before launch.
6. Decide whether to add seller orders realtime or polling beyond the MVP manual refresh path.
7. Continue real-backend failure QA for seller inventory/profile/offer publishing flows.
8. Apply and validate the multilingual seller-content and product-metadata migrations, then decide how existing seller profiles/offers will be translated and enriched until full metadata is provided.
9. Unlock the paired physical iPhone, rerun the `devicectl` install/launch path, and validate scanner/OCR, permissions, keyboard, safe areas, and map gestures.
10. Provision `com.lastbite.app` with the correct Apple team/profile, or update the app to a team-owned production bundle ID before TestFlight/App Store validation.
11. Restore Docker Desktop/containerd health or provide real Supabase credentials so backend E2E can run.
12. Before external handoff, preserve selected `.xcresult` bundles and screenshots outside `/tmp` or regenerate them from the documented commands, because `/tmp` validation artifacts are disposable.

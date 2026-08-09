# Mobile State, Navigation, And UI

## Navigation Model

Expo Router is the navigation system.

Buyer tabs:

- Feed: `app/(tabs)/index.tsx`
- Favorites: `app/(tabs)/favorites.tsx`
- Reservations: `app/(tabs)/reservations.tsx`
- Settings: `app/(tabs)/settings.tsx`

Seller tabs:

- Dashboard: `app/(seller-tabs)/index.tsx`
- Create: `app/(seller-tabs)/create.tsx`
- Inventory: `app/(seller-tabs)/inventory.tsx`
- Orders: `app/(seller-tabs)/orders.tsx`
- Profile: `app/(seller-tabs)/profile.tsx`

Auth/onboarding:

- Login: `app/auth/login.tsx`
- Signup: `app/auth/signup.tsx`
- Business type: `app/auth/business-type.tsx`

Offer detail:

- `app/offer/[id].tsx`

## Provider Stack

`AppProviders` nests:

1. Locale
2. Auth
3. Favorites
4. Search
5. ReservationHistory
6. Marketplace

This makes locale/auth available to all downstream buyer/seller stores.

## Buyer State

Locale:

- Default: Russian.
- Persisted in AsyncStorage.
- Dynamic UI update without restart.

Favorites:

- Local list of offer ids.
- Drives favorites tab and favorite button state.

Search:

- In-memory query shared by buyer surfaces.

Marketplace:

- Loads published seller offers from Supabase if configured.
- Keeps seed offers as fallback discovery content.
- Exposes loading/error/retry state.

Reservation history:

- Persists reservations locally.
- Stores raw pickup codes privately.
- Computes expired status.
- Cancels reminders when reservations complete/cancel/expire.
- Supports pickup-code reveal and failed sync retry.

## Seller State

Auth:

- Supabase Auth with SecureStore session persistence.
- Missing seller profile routes to business-type onboarding.
- Explicit local E2E seller fallback only when Supabase is unavailable and E2E flags are set.

Seller offers:

- Loads current seller's offers.
- Publishes offers with seller profile location/business metadata.
- Merges seller profile translations into offer translations.
- Refreshes buyer marketplace offers after publishing/deleting.

Inventory:

- Loads and mutates seller-owned inventory.
- Used only for Shop Sellers.

Orders:

- Loads pickup orders and seller offer titles.
- Tracks loading/error/last refresh.
- Verifies pending pickup orders only.
- Guards duplicate in-flight verification.

Profile:

- Updates seller profile and localized content.

## UI Design Principles In Current App

- Mobile-first, direct app screens rather than marketing pages.
- Dense enough for operational seller use, but still simple.
- Buyer feed uses full-width cards and a stable map frame.
- Map markers use fixed 48 px frames to prevent tap/anchor misalignment.
- Product details use plain sections and wrapped badges.
- Cards use small radii and simple borders.
- Native tab bar with Ionicons.
- Safe area handled through `ScreenScrollView`.
- Loading/error/empty/retry states exist on critical flows, though many are simple panels rather than polished skeletons.

## Accessibility And Testability

The app uses test IDs and accessibility labels heavily for native UI tests:

- Tab buttons.
- Seller auth entry.
- Offer cards and favorite toggles.
- Map markers and selected offer accessibility state.
- Reservation cards and pickup-code recovery.
- Seller setup checklist.
- Inventory scanner controls.
- Orders status filters and actions.

Known accessibility/product gaps:

- Broader Dynamic Type validation is still needed.
- Larger device matrix and orientations need more QA.
- Some UI states are functionally accessible but visually basic.

## Scanner/OCR

Scanner surfaces use camera/image/OCR dependencies. Simulator builds disable ML Kit to avoid device-only framework slice issues. Physical iPhone validation is still required for:

- Camera permission prompt behavior.
- Barcode scanning.
- OCR expiry parsing.
- Photo-library permission.
- App killed/background/foreground scanner behavior.

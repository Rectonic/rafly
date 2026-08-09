# System Architecture

## Current Architecture

LastBite Mobile is an Expo/React Native application using file-based Expo Router navigation. The current runtime source is rooted in `app/`, `components/`, `lib/`, `i18n/`, `data/`, and `types/`.

There is also older Next.js/web scaffolding under `src/`. That code is useful historical context for backend/auth decisions, but the iOS mobile app runs through Expo Router from `app/`.

## Major Runtime Layers

App shell:

- `app/_layout.tsx` wraps the app in gesture handling, safe area, status bar, notification response handling, and all context providers.
- Notification taps route to `/reservations`.

Providers:

- `LocaleProvider`
- `AuthProvider`
- `FavoritesProvider`
- `SearchProvider`
- `ReservationHistoryProvider`
- `MarketplaceProvider`

Buyer routes:

- `app/(tabs)/index.tsx`: Marketplace Feed.
- `app/(tabs)/favorites.tsx`: Favorites.
- `app/(tabs)/reservations.tsx`: Buyer reservation history.
- `app/(tabs)/settings.tsx`: Settings and language switcher.
- `app/offer/[id].tsx`: Offer detail and reservation flow.

Seller routes:

- `app/auth/login.tsx`: Seller login.
- `app/auth/signup.tsx`: Seller signup.
- `app/auth/business-type.tsx`: Seller business type onboarding.
- `app/(seller-tabs)/_layout.tsx`: Guarded seller tab layout.
- `app/(seller-tabs)/index.tsx`: Seller dashboard/checklist.
- `app/(seller-tabs)/create.tsx`: Meal package publishing.
- `app/(seller-tabs)/inventory.tsx`: Shop inventory and scanner/OCR entry.
- `app/(seller-tabs)/orders.tsx`: Seller pickup orders.
- `app/(seller-tabs)/profile.tsx`: Seller profile/localized content.

## Data Flow Overview

Buyer discovery:

1. `MarketplaceProvider` loads published seller offers from Supabase when configured.
2. Seed offers from `data/offers.ts` are always available.
3. `localizeOffers` applies locale-specific copy.
4. `filterAndSortOffers` applies search, category, radius, favorite mode, and sort mode.
5. Feed passes results to `OffersMap` and `OfferCard`.

Buyer reservation:

1. Offer detail calls `createPickupReservation`.
2. If the offer is a seller-backed offer, the app calls Supabase RPC `reserve_seller_offer`.
3. The reservation is persisted locally via `ReservationHistoryProvider`.
4. The private pickup code is stored in SecureStore, with AsyncStorage fallback for simulator entitlement gaps.
5. Reservation metadata stores only a code hint.
6. A local pickup reminder is scheduled through `expo-notifications`.
7. Failed sync remains visible and retryable.

Seller auth/profile:

1. `AuthProvider` creates a Supabase client when `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` exist.
2. Supabase Auth sessions persist via SecureStore.
3. A signed-in seller without a `seller_profiles` row is routed to business type onboarding.
4. Business type onboarding upserts the fallback seller profile.
5. Seller tabs are hidden or shown based on business type.

Seller supply:

1. Restaurant sellers publish offers through `useSellerOffers`.
2. Shop sellers add inventory through `useInventory`.
3. Seller orders load from `pickup_orders` and join seller offer titles client-side.
4. Pickup verification updates only pending orders.

## Backend Shape

Supabase is the intended shared backend:

- Supabase Auth for seller identity.
- Postgres for seller profiles, inventory items, seller offers, and pickup orders.
- Row Level Security for seller-owned writes and public published-offer reads.
- Security-definer RPCs for buyer reservation creation and cancellation.

## Current Offline/Local-First Shape

- Seed offers keep buyer discovery usable without backend data.
- Favorites, locale, reservation metadata, and some code fallback data persist locally.
- Seller authenticated simulator smoke tests use an explicit local E2E seller only when Supabase is unavailable and E2E env flags are enabled.
- Seller production flows require Supabase configuration.

## Architecture Tension To Preserve In Research

Early architecture notes recommended SwiftUI plus a shared backend as the production end state. The implemented MVP uses Expo/React Native because it was faster to build, test, and iterate with existing TypeScript data models. Future research should explicitly evaluate whether to continue with Expo/React Native, move to SwiftUI, or keep Expo for MVP while hardening native modules and backend contracts.

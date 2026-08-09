# Product Purpose And Strategy

## Purpose

LastBite exists to reduce food waste by turning near-expiry or surplus food into time-sensitive local pickup offers. The product should make it easy for buyers to find affordable nearby food and easy for sellers to recover value from inventory that would otherwise be discarded.

## Product Thesis

Food waste is an operational and liquidity problem. Sellers need simple tools to publish available surplus at the right time, with enough detail to make pickup trustworthy. Buyers need clear price savings, location, pickup timing, contents, allergy/dietary information, and a reliable code they can recover later.

The app is intended to be pragmatic rather than heavy: quick discovery, quick reservation, recoverable pickup, and seller operations that do not require a full enterprise POS integration for the first useful version.

## Primary Markets And Local Assumptions

- The app has strong Tashkent assumptions in seed data, map defaults, and Russian default language.
- Current languages are English and Russian.
- The buyer UX assumes mobile-first local discovery.
- The seller UX assumes small business operators who need fast package/inventory entry rather than complex catalog management.

## Core Product Loops

1. Buyer opens app, sees nearby discounted offers, filters by category/radius/sort, and reserves a pickup.
2. Buyer can recover the pickup code from reservation history after relaunch or network interruption.
3. Seller signs in, completes business type/profile setup, publishes offers or tracks inventory, and fulfills pickup orders.
4. Seller fulfillment creates more supply, which improves buyer discovery and marketplace liquidity.

## Product Boundaries

Currently in scope:

- Buyer discovery, favorites, reservations, pickup-code recovery, local reminders.
- Seller onboarding, seller profile, restaurant offer publishing, shop inventory intake, seller order management.
- Multilingual UI and multilingual seller content fields.
- Supabase-backed seller/profile/offer/order data when configured.
- Device-local fallback/recovery for buyer reservations and pickup codes.

Currently out of scope or not production-complete:

- Payments and refunds as financial transactions.
- Buyer accounts and server-side buyer reservation history across devices.
- Server-side push notification scheduling.
- TestFlight/App Store distribution readiness.
- Full compliance/regulatory workflow for food safety.
- POS integration, seller payouts, and business verification.
- Production analytics, fraud prevention, and marketplace trust operations.

## Product Success Criteria

Near-term MVP success:

- Buyer can reliably find and reserve a relevant offer on iPhone.
- Buyer can recover the pickup code after app restart.
- Seller can publish a valid offer and see/manage pickup orders.
- App works in English and Russian without mixed-language surfaces.
- Product detail page provides enough information to reduce pickup uncertainty.
- Network/configuration failures do not destroy buyer reservation state.

Production success:

- Seller-backed reservation lifecycle is server-owned, atomic, and validated against real Supabase.
- Buyer history is available across devices after auth is introduced.
- Seller order status is fresh enough for real pickup operations.
- Notifications work on physical devices and TestFlight.
- Real sellers can onboard without support intervention.
- The product has a clear policy for cancellations, missed pickups, allergens, and seller content quality.

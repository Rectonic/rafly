# Product Surface And Features

## Buyer App Surface

Marketplace Feed:

- Search input.
- Category filters: All, Meals, Baked Goods, Groceries, Vegan, Surprise Bags.
- Sort modes: expiring soon, lowest price, biggest discount, closest first.
- Radius filters: 1 km, 3 km, 5 km, all distances.
- Near Me action using foreground location permission.
- Map with fixed marker touch frames, callouts, and selected-card synchronization.
- Inline loading/error/retry panels for live seller offers.
- Empty states for no matches.

Offer Detail:

- Close button for returning from product page.
- Seller/restaurant name, title, category, price, pickup deadline, address.
- Contents section.
- Pickup instructions.
- Dietary badges.
- Allergen badges.
- Cancellation/refund policy.
- Favorite toggle.
- Reserve button with in-flight protection and duplicate-reservation protection.
- Reservation confirmation panel with pickup code or hidden-code hint.
- Sync failure panel with retry.
- View Reservation action.

Favorites:

- Stores buyer favorite offer ids locally.
- Uses the same filter/sort/localization path as feed.
- Provides empty and no-search states.

Reservations:

- Status filters: active, completed, cancelled, expired.
- Reservation card shows seller, pickup window, price, sync state, reminder state, and code hint.
- Pickup code can be recovered securely.
- Active reservation actions include mark picked up and cancel.
- Failed states include retry for loading history.

Settings:

- Language switcher inside Settings.
- Opens seller access/login.
- About/build copy.

## Seller App Surface

Auth:

- Seller login.
- Seller signup.
- Business type onboarding.
- Close/back affordances on auth and onboarding screens.
- Missing Supabase configuration and missing backend schema are turned into actionable errors.

Seller Dashboard:

- Business name and type.
- Stats for active offers, pending pickups, and tracked inventory.
- Setup checklist:
  - Complete profile.
  - Publish first offer or add first inventory item, depending on business type.
  - Complete first pickup.
- Primary action routes to create offer or inventory.

Create Offer:

- Restaurant-oriented meal package creation.
- Captures price, quantity, pickup window, contents, product metadata, image, surprise-bag flag, and localized fields.
- Publishes to Supabase seller_offers when auth/profile are available.

Inventory:

- Shop-only surface.
- Manual item entry: product name, barcode, expiry date, quantity.
- Barcode scanner and OCR scanner modal.
- Loading, error, retry, and empty states.
- Restaurant sellers see an unavailable message.

Orders:

- Seller pickup order list.
- Status segments including cancelled.
- Lifecycle badges.
- Manual pickup-code verification.
- Pending-only collection updates.
- Last refreshed timestamp.
- Loading, empty, retry, and in-flight verification states.

Profile:

- Seller business profile editing.
- Localized profile content for English/Russian business name, category, and address.
- Buyer-mode switch.

## Multilingual Product Behavior

- Current locales: English and Russian.
- Default locale: Russian.
- Locale is persisted in AsyncStorage.
- Dynamic UI text updates without app restart.
- Seller profile translations cover business name, category, and address.
- Seller offer translations cover title, restaurant/business display, address, contents, and product metadata.
- Seed offers include localized content so the product can be QA'd without backend content.

## Reliability Behavior

- Buyer seed discovery remains usable if seller-offer refresh fails.
- Seller-backed reservation sync has timeout protection.
- Failed reservation sync is visible and retryable.
- Local reservation history survives app relaunch.
- Pickup code recovery avoids storing the raw code in normal reservation metadata.
- Reminder scheduling failures and permission denial are represented in UI.
- Seller load failures have retryable states rather than silent empty screens.

## Current Product Limitations

- Buyer reservation history is device-local.
- Buyer accounts are not modeled in the mobile app yet.
- Pickup reminders are local notifications, not server push.
- Real seller auth and writes need real Supabase QA.
- The marketplace does not yet include payments, payouts, commissions, or refunds.
- Seller inventory is not yet deeply connected to offer generation.
- Real-world content moderation, allergen safety, and seller verification policies are undefined.

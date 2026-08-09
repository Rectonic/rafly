# LastBite Domain Context

LastBite is a surplus-food marketplace for discounted pickup offers. The domain connects buyers who reserve nearby food with sellers who publish surplus meals, groceries, and pickup orders.

## Language

**Buyer**:
A person using the marketplace to discover, reserve, and pick up discounted surplus food.
_Avoid_: Customer, consumer, user when the marketplace role matters

**Seller**:
A business account that publishes surplus food offers and fulfills pickup orders.
_Avoid_: Vendor, merchant

**Restaurant Seller**:
A Seller that primarily creates meal packages or surprise bags for same-day pickup.
_Avoid_: Restaurant account

**Shop Seller**:
A Seller that primarily tracks packaged goods inventory and expiry dates before publishing offers.
_Avoid_: Grocery account, store account

**Offer**:
A buyer-visible discounted food listing with pickup timing, location, price, availability, and product details.
_Avoid_: Product, deal, listing when the reservation flow matters

**Seed Offer**:
A built-in Offer bundled with the app for prototype and offline discovery.
_Avoid_: Demo deal

**Seller Offer**:
An Offer created by a Seller and read from the shared backend when Supabase is configured.
_Avoid_: Published package when buyer discovery is the focus

**Meal Package**:
A Seller-created food package, usually from a Restaurant Seller, that becomes a Seller Offer once published.
_Avoid_: Box, bundle unless used in user-facing copy

**Inventory Item**:
A Shop Seller stock item with product name, barcode, expiry date, quantity, and intake source.
_Avoid_: SKU when LastBite has not modeled catalog identity

**Reservation**:
A Buyer-held claim on an Offer for a pickup window, with a recoverable Pickup Code and lifecycle status.
_Avoid_: Purchase, order when payment is not modeled

**Pickup Code**:
The buyer's private code used to recover or verify a Reservation at pickup.
_Avoid_: QR token when the current mobile flow displays text codes

**Pickup Order**:
The seller-facing backend record created for a synced Reservation.
_Avoid_: Reservation when discussing seller fulfillment state

**Pickup Window**:
The time range or deadline during which a Buyer can collect a reserved Offer.
_Avoid_: Expiry time when referring to pickup logistics

**Reservation Sync**:
The state of whether a local Reservation has been written to the seller-backed Supabase lifecycle.
_Avoid_: Upload, save

**Pickup Reminder**:
A local notification scheduled before a Reservation pickup window expires.
_Avoid_: Push notification when the current implementation is device-local

**Seller Profile**:
The backend-owned business identity for a Seller, including business type, location, category, and localized content.
_Avoid_: Account profile when auth identity and business profile must be distinct

**Marketplace Feed**:
The buyer discovery surface that merges Seller Offers and Seed Offers, then applies localization, search, filters, distance, and sorting.
_Avoid_: Home page when discussing product mechanics

**Business Type**:
The Seller onboarding choice between Restaurant Seller and Shop Seller.
_Avoid_: Category, role

**Local E2E Seller**:
A guarded test-only Seller session hydrated locally when Supabase is unavailable and explicit E2E flags are set.
_Avoid_: Mock seller in product documentation

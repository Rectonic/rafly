# Data, Backend, And Security

## Supabase Environment

Mobile runtime expects:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Backend smoke/E2E additionally uses:

- `LASTBITE_BACKEND_E2E_SUPABASE_URL`
- `LASTBITE_BACKEND_E2E_SUPABASE_ANON_KEY`
- `LASTBITE_BACKEND_E2E_SELLER_EMAIL`
- `LASTBITE_BACKEND_E2E_SELLER_PASSWORD`

The Supabase URL must be the project root URL, not `/rest/v1`.

## Tables

`seller_profiles`:

- One row per seller auth user.
- Owns business type, business name, category, address, coordinates, rating/reviews, and localized profile translations.
- Primary key references `auth.users(id)`.

`inventory_items`:

- Shop seller stock records.
- Product name, barcode, expiry date, quantity, source, optional OCR text.
- Owned by `seller_id`.

`seller_offers`:

- Published/draft/sold-out offers created by sellers.
- Includes price, discount, quantity, pickup timing, location, product metadata, translations, and status.
- Read publicly when status is `published`.
- Managed by owner seller.

`pickup_orders`:

- Seller-facing reservation fulfillment records.
- Stores seller id, offer id, customer name, reservation code, pickup window, total, status.
- Status is `pending`, `collected`, or `cancelled`.

## Row Level Security

Current schema enables RLS on all core tables.

Policies:

- Sellers can select/insert/update their own `seller_profiles`.
- Sellers can manage their own `inventory_items`.
- Sellers can manage their own `seller_offers`.
- Anonymous and authenticated clients can read published `seller_offers`.
- Sellers can manage their own `pickup_orders`.
- Public direct insert into `pickup_orders` has been removed in favor of RPCs.

## Reservation RPCs

`reserve_seller_offer`:

- Security definer.
- Accepts offer id, pickup code, pickup window, and customer name.
- Validates non-empty pickup code.
- Idempotently returns an existing order for the same code and offer.
- Rejects a reused code for a different offer.
- Atomically decrements `seller_offers.quantity_available`.
- Marks offer `sold_out` when last unit is reserved.
- Inserts `pickup_orders`.
- Returns pickup order id, seller id, offer id, code, pickup window, total, status, remaining quantity.

`cancel_seller_reservation`:

- Security definer.
- Accepts offer id and pickup code.
- Finds matching order.
- Treats already-cancelled orders idempotently.
- Cancels only pending orders.
- Restores quantity once.
- Restores `published` status if a sold-out offer gets stock back.

## Client Reservation Sync

The mobile client calls RPCs through `lib/reservations.ts` with timeout protection.

Sync outcomes:

- `synced`: server lifecycle succeeded.
- `failed`: server lifecycle failed but local reservation remains recoverable.
- `local`: no server-backed offer or backend unavailable.
- `syncing`: reserved for in-flight state in the reservation model.

## Local Persistence

AsyncStorage:

- Locale.
- Favorites.
- Buyer reservation metadata.
- Fallback pickup codes when SecureStore is unavailable in simulator-like environments.

SecureStore:

- Supabase Auth session.
- Raw pickup codes when available.

Reservation metadata stores only a code hint, not the raw pickup code.

## Security Posture

Implemented or partially implemented:

- Supabase Auth for sellers.
- SecureStore-backed auth persistence.
- Seller-owned RLS policies.
- Public reservation insert removed from direct table access.
- Server-owned reservation/cancellation lifecycle through RPCs.
- Pending-only pickup verification updates.
- Backend auth smoke and lifecycle E2E harnesses.

Still required before production:

- Apply and verify schema/migrations on the real Supabase project.
- Full RLS review after real project setup.
- Real authenticated seller CRUD QA.
- Buyer auth or buyer-safe server reservation history if cross-device recovery is required.
- Backend push-token storage and server-side notification scheduling.
- CSP/domain policy for any web deployment.
- Explicit policy for food safety, allergens, seller verification, refunds, and missed pickups.
- Avoid attaching `.env` or private credentials to any model review.

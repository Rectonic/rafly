# Users And Workflows

## Buyer

The Buyer wants discounted food nearby with low friction and low risk. The buyer workflow is:

1. Open Marketplace Feed.
2. Search or filter by category.
3. Use radius filters or Near Me.
4. Compare offer price, distance, pickup deadline, contents, seller, and dietary/allergen badges.
5. Reserve an offer.
6. View confirmation and pickup code.
7. Recover the pickup code later from Reservations.
8. Mark picked up, cancel, or let the reservation expire.

Buyer concerns:

- Is the offer close enough?
- What exactly might I receive?
- Can I eat it safely?
- When do I need to pick it up?
- Can I recover the code if I close the app?
- What happens if the seller/backend is unavailable?

## Restaurant Seller

The Restaurant Seller wants to publish meal packages quickly and fulfill pickups. The restaurant workflow is:

1. Register or sign in.
2. Choose Restaurant as business type.
3. Complete seller profile and localized content.
4. Create a meal package with title, price, quantity, pickup window, contents, pickup instructions, allergens, dietary badges, and cancellation policy.
5. Publish the offer.
6. Watch pickup orders arrive.
7. Verify pending pickup orders and mark collected.
8. Review completed, cancelled, and pending orders.

Restaurant Seller concerns:

- Can the seller publish without entering too much data?
- Is pickup status clear?
- Can already-handled orders be accidentally verified again?
- Does the buyer see enough information to reduce questions and cancellations?

## Shop Seller

The Shop Seller wants to track expiring packaged goods and publish surplus inventory. The shop workflow is:

1. Register or sign in.
2. Choose Shop as business type.
3. Complete seller profile and localized content.
4. Add inventory manually or with scanner/OCR assistance.
5. Track product name, barcode, expiry date, quantity, and intake source.
6. Use inventory as the operational base for future offers.
7. Manage pickup orders after offers exist.

Shop Seller concerns:

- Does barcode/OCR reduce typing?
- Are expiry dates parsed reliably?
- Is scanner permission behavior clear?
- Is inventory limited to authenticated seller ownership?

## Operator / Project Owner

The operator needs to validate market fit, production readiness, and operational risk before public launch.

Operator concerns:

- Is the product solving a marketplace liquidity problem or just a demo flow?
- Which side of the marketplace should be acquired first?
- Which seller categories generate repeat supply?
- What trust/safety policies are required before launch?
- Which backend and QA gaps block production?

## Critical Journey Map

Buyer reservation journey:

1. Discovery: seed and seller offers are merged in the feed.
2. Selection: map/card/list synchronize selected offer.
3. Reservation: seller-backed offers attempt Supabase RPC sync; seed/local offers create local reservations.
4. Recovery: metadata persists in AsyncStorage; private pickup code persists in SecureStore with AsyncStorage fallback.
5. Reminder: local notification is scheduled before pickup window when possible.
6. Lifecycle: active reservations become completed, cancelled, or expired.

Seller fulfillment journey:

1. Auth: seller signs in through Supabase when configured.
2. Profile: missing seller profile routes to business-type onboarding.
3. Supply: restaurant publishes offers; shop tracks inventory.
4. Reservation: server RPC creates seller pickup orders for buyer reservations.
5. Fulfillment: seller orders screen shows pending, collected, and cancelled states.
6. Verification: pending-only updates prevent already-handled pickup orders from being verified again.

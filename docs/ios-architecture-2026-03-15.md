# iOS Architecture - 2026-03-15

## Goal

Define how LastBite should evolve from the current web prototype into a production iOS app without creating a separate product architecture for mobile.

## Recommended Production Shape

### Clients

1. Web app
- Next.js for buyer web and seller web CRM

2. iOS app
- SwiftUI
- `NavigationStack` for app flow
- `MapKit` for buyer discovery map
- `VisionKit` / `DataScannerViewController` for barcode and QR scanning
- `Vision` text recognition for expiry OCR fallback if needed outside live scanner flows

### Shared backend

The iOS app should not depend on Next-only route handlers as the long-term source of truth. Both web and iOS should use the same backend services:

1. Auth service
- seller and buyer identity
- session issuance
- role separation

2. Application API
- offers
- meal packages
- reservations
- pickup verification
- inventory tracking

3. Database
- Postgres

4. Storage
- package photos
- shop item label photos if OCR images are retained

5. Realtime or notifications
- reservation updates
- pickup reminders
- seller nudges

## Suggested Domain Split

### On device

Keep these on iOS:

1. Camera capture
2. Barcode decoding
3. QR pickup scanning
4. Fast OCR prefill for expiry dates
5. Cached map and offer browsing state

The app should send structured results to the backend after local recognition instead of uploading raw video frames.

### On server

Keep these on the backend:

1. Auth and authorization
2. Inventory persistence
3. Offer publishing rules
4. Reservation creation and locking
5. Pickup verification audit trail
6. Pricing, discount, and expiry validation
7. Notification triggers

## Recommended iOS Module Layout

```text
LastBiteApp/
  App/
  Core/
    Networking/
    Auth/
    Storage/
    Location/
    DesignSystem/
  Features/
    BuyerHome/
    OfferDetails/
    Reservations/
    SellerDashboard/
    SellerInventory/
    SellerPackages/
    SellerPickup/
  Services/
    BarcodeScanning/
    ExpiryOCR/
    Maps/
```

## Data Flow Example

### Seller inventory intake

1. Seller opens stock intake on iPhone or iPad.
2. `DataScannerViewController` reads barcode on device.
3. OCR reads expiry label on device or from a captured still image.
4. App sends validated item payload to backend.
5. Backend stores inventory item and exposes it to seller CRM and analytics.

### Meal package publishing

1. Seller composes package in CRM.
2. Client sends package payload to backend.
3. Backend validates pricing, quantity, pickup window, and business ownership.
4. Backend writes package to Postgres.
5. Buyer web and iOS surfaces query the same published package record.

### Pickup verification

1. Buyer receives reservation code / QR token.
2. Seller scans QR with iPhone camera.
3. App sends token to backend.
4. Backend verifies order is pending and owned by that seller.
5. Backend marks reservation as collected and records timestamp/device/operator.

## Backend Recommendation

For a shared web + iOS system, the cleanest direction is:

1. Auth: Supabase Auth or Clerk
2. Database: managed Postgres
3. Storage: Supabase Storage or equivalent
4. Web: Next.js as presentation layer
5. Shared API: server actions for web convenience, but a stable API or shared backend service for mobile consumption

If the team wants one minimal stack, Supabase is the most direct fit for iOS plus web because it gives:

1. Swift client support
2. Auth
3. Postgres
4. Storage
5. Realtime

## Migration Path From Current Repo

### Phase 1

1. Replace `localStorage` seller workspace with Postgres-backed records.
2. Add seller auth and role checks.
3. Move meal package publishing and pickup verification into server-side mutations.

### Phase 2

1. Extract stable offer, inventory, reservation, and pickup APIs.
2. Add image upload flow for label/package photos.
3. Add audit tables for scans and pickup events.

### Phase 3

1. Build SwiftUI buyer app on the shared backend.
2. Add seller iPhone/iPad operational app if needed.
3. Use MapKit on iOS while web keeps Leaflet or moves to Apple maps separately.

## Immediate Technical Guidance

The current web seller CRM already proves the UX flow. The next engineering step should be backend unification, not duplicating logic per client. Web and iOS should share one source of truth for:

1. inventory items
2. published offers
3. reservations
4. pickup verification

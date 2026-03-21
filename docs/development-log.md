# Development Log

## 2026-02-27

### Goal
Ship a working interactive map with usable filters and synced offer data for the LastBite home experience.

### Work Completed
1. Added real map support with `react-leaflet` + `leaflet`.
2. Replaced the mock map background/pins with live OpenStreetMap tiles and clickable markers.
3. Added map auto-fit behavior so the viewport updates based on active filtered offers.
4. Introduced a typed offer model in `src/types/offer.ts`.
5. Moved sample data into `src/data/offers.ts` with categories and geolocation data.
6. Implemented functional category filters with active state and per-category counts.
7. Synced map and feed interactions:
- Hovering/clicking markers highlights corresponding offers.
- Hovering offer cards highlights corresponding markers.
8. Fixed homepage layout sizing to avoid forcing extra vertical scroll under the persistent navbar.
9. Added mobile map visibility (map now renders on both mobile and desktop layouts).
10. Added Leaflet-specific global styling and imported Leaflet CSS.

### Validation Run
1. `npm run lint`
2. `npx tsc --noEmit`

### Manual QA Checklist
1. Open home page and verify OpenStreetMap tiles render.
2. Click each category chip and confirm map markers and cards update together.
3. Hover a card and confirm marker highlight.
4. Hover/click a marker and confirm card highlight.
5. Test mobile viewport and verify map appears above filters/feed.

### Follow-up: Map Styling Update
1. Added map style presets in the Leaflet map component:
- `clean` (CARTO light base map, default)
- `standard` (OpenStreetMap standard)
- `dark` (CARTO dark base map)
2. Added a map style switcher in the home feed controls.
3. Wired selected style to both desktop and mobile map instances.
4. Added implementation note: true Apple Maps visuals require MapKit JS setup with Apple Developer credentials and token provisioning; this is a separate integration path from Leaflet tile providers.

## 2026-03-15

### Goal
Turn the seller dashboard into a working CRM flow for stock intake and customer-visible package publishing.

### Work Completed
1. Added a shared client-side marketplace store in `src/lib/marketplace-store.ts`.
2. Extended offer types to support seller-published meal packages and richer metadata.
3. Updated the buyer home page to merge seller-published packages into the marketplace feed and map.
4. Replaced the seller dashboard stub with:
- live barcode camera scanning
- barcode image decoding fallback
- OCR expiry-date extraction from uploaded label images
- tracked inventory queue for shop goods
- restaurant meal-package builder
- pickup verification via QR/reservation-code scanning
- published package list that is immediately visible on the buyer marketplace
5. Updated offer details so seller-published package contents and pickup windows render in the buyer dialog.
6. Ran `npm audit fix` and cleared previously reported transitive vulnerabilities.
7. Added a dedicated security review document in `docs/security-review-2026-03-15.md`.

### Validation Run
1. `npm audit`
2. `npm run lint`
3. `npx tsc --noEmit`
4. `npm run build`

### Architecture Notes
1. Added `docs/ios-architecture-2026-03-15.md`.
2. Defined the recommended production split between on-device scanning/OCR and shared backend responsibilities.
3. Documented the migration path from the current web prototype to a shared web + iOS backend.

### Runtime Fix
1. Fixed Next.js 16 hydration/runtime loops caused by unstable `useSyncExternalStore` server snapshots in the favorites, search, and seller workspace stores.
2. Replaced inline fallback snapshot lambdas with stable module-level snapshot functions/constants so `Navbar` and the home page stop re-rendering indefinitely during hydration.
3. Re-validated with `npx tsc --noEmit`, `npm run lint`, and `npm run build`.

### Seller Navigation Update
1. Replaced the seller sidebar placeholder rows with real button-based navigation.
2. Added scroll-linked sections for dashboard, meal packages, stock intake, order history, insights, and settings.
3. Added a mobile quick-navigation bar so seller navigation works on smaller screens as well.
4. Connected the top notification button to the settings section instead of leaving it inert.

### Backend Auth Foundation
1. Added Supabase SSR auth helpers, middleware, and env-aware setup so `/seller` can be protected once project credentials are configured.
2. Added seller login, sign-up, callback, and logout flows under `src/app/auth/*`.
3. Updated the global navbar to reflect authenticated seller state and expose seller access directly.
4. Added shared backend contracts for seller profile, inventory, offers, and pickup orders.
5. Added a Postgres schema with RLS policies in `supabase/schema.sql`.
6. Documented setup and current limitations in `docs/backend-auth-setup-2026-03-15.md`.

### Backend Workspace Migration
1. Replaced the buyer home page dependency on seller local state with a published-offers store that reads `/api/offers` when Supabase is configured.
2. Added authenticated seller API routes for workspace loading, storefront profile updates, inventory intake, meal-package publishing, and pickup verification.
3. Added a server-side seller repository and automatic seller-profile bootstrap on first authenticated access.
4. Updated the seller CRM settings section to edit business metadata that now feeds published offers and remote workspace records.
5. Kept local fallback behavior so the prototype still works without Supabase credentials.

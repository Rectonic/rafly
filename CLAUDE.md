# LastBite — Architectural & Systematic Decisions

## App Model

LastBite is a **frontend-only** surplus food marketplace. There is no backend, no API server, no authentication, and no payment processing. All data is either static seed data or ephemeral localStorage state. The two surfaces are:

- `/` — Buyer feed (discovery, filtering, reservation)
- `/seller` — Seller CRM workspace (inventory intake, meal package publishing)

---

## State Management

**Pattern: `useSyncExternalStore` + module-level store functions.** There is no global state library (no Redux, no Zustand, no Context). Each domain gets its own store file in `src/lib/` that follows the same structure:

1. A module-level read function that reads from localStorage or an in-memory variable
2. A `subscribe` function that listens for a custom DOM event + the native `storage` event
3. A `write` function that updates the source of truth and dispatches the custom event
4. A React hook that wires everything together via `useSyncExternalStore`

**Why:** Avoids adding a state library for what amounts to three small stores. The `storage` event listener also gives cross-tab sync for free.

**The three stores:**

| Store | File | Persistence | Scope |
|---|---|---|---|
| Seller workspace (inventory + published offers) | `src/lib/marketplace-store.ts` | localStorage key `lastbite-seller-workspace` | Cross-tab synced |
| Favorites | `src/lib/favorites-store.ts` | localStorage key `lastbite-favorites` | Cross-tab synced |
| Search query | `src/lib/search-store.ts` | In-memory module variable only | Single tab, ephemeral |

**Seller → Buyer data flow:** The seller publishes a package → it is written to `publishedOffers` in localStorage → the buyer home page reads it via `useSellerWorkspace()` → the offer appears on the map and card grid. This is the only "real-time" integration between the two surfaces.

---

## Routing

Next.js **App Router** only. Two routes exist:

- `src/app/page.tsx` — buyer home
- `src/app/seller/page.tsx` — seller dashboard

All pages are `"use client"` because they depend on browser APIs (localStorage, Leaflet, camera). There are no server components that fetch data.

---

## Data

**Seed data** lives in `src/data/offers.ts` as a static `OFFERS` array. It is never mutated. Seller-published offers are merged with seed data at render time in `page.tsx`:

```ts
const marketplaceOffers = useMemo(
  () => [...publishedOffers, ...OFFERS],
  [publishedOffers]
);
```

Seller-published offers always appear first. The seed cap is 10 offers; the seller store caps published offers at 24 and inventory at 20 items.

---

## Map

The map (`src/components/map/OffersMap.tsx`) is **always loaded client-side only** via `next/dynamic` with `ssr: false`. This is required because Leaflet directly accesses `window` and `document` at import time — it will throw during SSR.

Map tiles use **OpenStreetMap/CARTO** (no API key required). Three themes are supported: `clean` (CARTO Light), `standard` (OSM default), `dark` (CARTO Dark).

The map and the offer card grid maintain **bidirectional hover sync** via a shared `activeOfferId` state lifted to the page component. Hovering a card highlights its map marker; clicking a map marker highlights its card.

---

## UI Component System

**shadcn/ui pattern:** UI primitives are copied into `src/components/ui/` and fully owned by the project. They are not an installed npm package. The underlying primitive layer is Radix UI (imported from the `radix-ui` monorepo package). Do not install `@shadcn/ui` — add components by copying them into `src/components/ui/` directly or using the shadcn CLI.

**Icons:** Lucide React only. Do not introduce a second icon library.

**Animations:** Framer Motion only. Used for staggered card entry (`motion.div` with `initial/animate/transition`) and metric card reveals in the seller dashboard. Do not use CSS keyframe animations for component-level motion.

---

## Seller-Side Hardware Features

The seller dashboard integrates two hardware-adjacent browser APIs:

- **Barcode scanning:** `@zxing/browser` (`BrowserMultiFormatReader`). Supports live camera scanning via `decodeFromVideoDevice` and static image scanning via `decodeFromImageUrl`. The camera stream must be explicitly stopped — the `useEffect` cleanup and `stopCameraScanner()` function handle this.
- **OCR expiry detection:** `tesseract.js` (`Tesseract.recognize`). Runs entirely in the browser (WASM). It is slow (~2–5s) — always show a loading state before calling it.

Both are triggered from hidden `<input type="file">` refs or camera button clicks. Neither requires a backend.

---

## TypeScript

Strict mode. All domain types live in `src/types/`:

- `src/types/offer.ts` — `Offer`, `OfferCategory`, `OfferFilterCategory`, `OfferLocation`
- `src/types/seller.ts` — `SellerInventoryItem`, `SellerPickupOrder`, `SellerWorkspaceState`, `MealPackageDraft`

The `Offer` type is shared between buyer and seller surfaces. Seller-published offers are full `Offer` objects — the seller store does not have a separate offer type.

Path alias `@/` maps to `src/`. Always use it for imports.

---

## Styling

**Tailwind CSS v4** with CSS custom properties as design tokens. The full token set (light + dark mode) is defined in `src/app/globals.css` under `@layer base`. Do not hardcode colors — always use semantic tokens (`text-primary`, `bg-muted`, `border-border`, etc.).

**Primary:** `#16C79A` (teal-green) — CTAs, active states, map markers
**Secondary:** `#FF8C42` (warm orange) — discount badges, star ratings
**Destructive:** `#FF6B6B` (coral) — Surprise Bag badges, errors

Dark mode tokens are defined and must be kept in sync if new tokens are added.

Custom Leaflet styles are scoped under `@layer components` in `globals.css` — keep all map overrides there.

---

## External Services (Mock)

| Service | Usage | Note |
|---|---|---|
| `api.qrserver.com` | QR code image in reservation confirmation | Mock data only — passes `{offerId}-mock` as payload |
| Unsplash | All food and profile images via URL | No API key; uses public resize URLs |
| OpenStreetMap / CARTO | Map tiles | No API key required |

No real payment, auth, or order management exists. "Reserve Now" sets local React state only.

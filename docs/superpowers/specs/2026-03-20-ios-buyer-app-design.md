# LastBite iOS Buyer App — Design Spec

## Overview

A native iOS buyer app built with **Expo (managed workflow)** and **React Native**. Scope is **buyer-only**: discover offers, filter/sort, view on a map, favorite, and reserve with a local pickup reminder. No seller surface, no auth, no backend. Russian is the default language.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Framework | Expo managed (React Native) | Fastest to build, OTA updates, TS/i18n/types port directly from web |
| Map | Apple Maps (MapKit via react-native-maps) | No API key, native iOS feel, follows system dark mode |
| Map themes | None — follow device light/dark mode | MapKit doesn't support custom JSON styles; system theme is expected on iOS |
| Data | Local-first, Supabase-ready later | Bundle seed data, AsyncStorage for state, structure for future sync |
| Notifications | Local only (expo-notifications) | 30-min pickup reminder on reserve, no server needed |
| Navigation | 3-tab bar (Feed, Favorites, Settings) | Room to grow, clean separation of concerns |
| Default language | Russian (`"ru"`) | Primary user base is in Tashkent |

---

## 1. Project Structure

```
lastbite-mobile/
  ├── app/                          # expo-router file-based routes
  │   ├── (tabs)/
  │   │   ├── _layout.tsx           # tab bar config (3 tabs)
  │   │   ├── index.tsx             # Feed screen (map + cards)
  │   │   ├── favorites.tsx         # Favorites list
  │   │   └── settings.tsx          # Language, about, version
  │   ├── _layout.tsx               # root layout
  │   └── offer/[id].tsx            # offer detail (full-screen modal)
  ├── components/
  │   ├── OfferCard.tsx             # offer card for FlatList
  │   ├── OffersMap.tsx             # Apple Maps with markers
  │   └── ui/                       # Badge, Button, Card primitives
  ├── lib/
  │   ├── favorites-store.ts        # AsyncStorage, React Context
  │   ├── search-store.ts           # in-memory, React Context
  │   ├── marketplace-store.ts      # AsyncStorage (read-only buyer side)
  │   ├── filters.ts                # shared filtering/sorting logic
  │   └── notifications.ts          # schedule/cancel local notifications
  ├── i18n/
  │   ├── types.ts                  # buyer-only subset of web Translations
  │   ├── en.ts                     # English dictionary
  │   ├── ru.ts                     # Russian dictionary (with pluralRu)
  │   └── index.ts                  # useT hook via React Context
  ├── data/
  │   └── offers.ts                 # same 10 seed offers as web
  ├── types/
  │   └── offer.ts                  # Offer, OfferCategory, OfferFilterCategory, OfferLocation
  ├── constants/
  │   └── colors.ts                 # design tokens (light + dark)
  └── assets/                       # app icon, splash screen
```

### Shared code from web (copy directly)

These files are plain TypeScript with no React/Next.js dependencies:

- `types/offer.ts` — `Offer`, `OfferCategory`, `OfferFilterCategory`, `OfferLocation`
- `data/offers.ts` — `OFFERS` array, `OFFER_FILTERS` array
- `i18n/types.ts` — `Translations` interface (strip `seller`, `auth`, `nav` namespaces; add `mobile` namespace)
- `i18n/en.ts` and `i18n/ru.ts` — buyer-relevant keys only, plus new `mobile` keys
- `pluralRu` helper from `ru.ts`

---

## 2. Navigation

### Tab Bar

| Tab | Icon | Route | Content |
|-----|------|-------|---------|
| Feed | `Utensils` | `(tabs)/index` | Map + filter chips + sorted offer cards |
| Favorites | `Heart` | `(tabs)/favorites` | Favorited offers grid, empty state prompt |
| Settings | `Settings` | `(tabs)/settings` | Language toggle, about, version |

- Active tab color: `#16C79A` (primary teal)
- Inactive: muted foreground
- White background, top border

### Offer Detail Modal

Route: `offer/[id]`. Presented as a full-screen modal that slides up from bottom. Dismiss via swipe-down or X button. Contains: image, restaurant info, countdown, portions bar, contents list, impact teaser, reserve button.

---

## 3. Feed Screen Layout

Top to bottom:

1. **Header bar** — "LastBite" branding + search input
2. **Map section** — 250px height, Apple Maps, circular teal markers, tap-to-select
3. **Filter chips** — horizontal `ScrollView`: All, Meals, Baked Goods, Groceries, Vegan, Surprise Bags
4. **Sort pill** — dropdown: Expiring Soon, Lowest Price, Biggest Discount, Closest First
5. **Offer cards** — vertical `FlatList`, full-width cards, tap → offer detail modal

### Bidirectional sync (card ↔ map)

- Tap a marker → `FlatList` scrolls to card, card gets highlight ring
- Tap a card → map animates to marker, marker scales up
- No hover interaction (mobile has no cursor)

---

## 4. Data Layer

### Stores

All stores use **React Context + useReducer**. AsyncStorage replaces localStorage. No cross-tab sync needed.

| Store | Persistence | Key | Default | API |
|-------|------------|-----|---------|-----|
| Favorites | AsyncStorage | `lastbite-favorites` | `[]` | `useFavorites()`, `toggleFavorite(id)` |
| Search | In-memory | — | `""` | `useSearchQuery()`, `setSearchQuery(q)` |
| Marketplace | AsyncStorage | `lastbite-seller-workspace` | `{ publishedOffers: [] }` | `usePublishedSellerOffers()` |

### Data merge

```ts
const marketplaceOffers = useMemo(
  () => [...publishedOffers, ...OFFERS],
  [publishedOffers]
);
```

For MVP, `publishedOffers` is empty (no cross-platform sync). Buyer sees seed data only. When Supabase is added later, published seller offers flow in through the same interface.

### Filtering & sorting (`lib/filters.ts`)

Identical algorithms to web `page.tsx`:

1. Filter by category (or show all)
2. Filter by favorites toggle
3. Filter by search query (case-insensitive match on title, restaurant, category)
4. Sort by mode:
   - `expiry`: parse `"HH:MM"` → minutes from now → ascending
   - `price`: `newPrice` ascending
   - `discount`: `discount` descending
   - `distance`: parse `"X.X km"` → float → ascending

Extracted into a reusable utility so both Feed and Favorites screens share the same logic.

---

## 5. Map

- **Provider:** Apple Maps (MapKit) via `react-native-maps` default provider
- **No API key required**
- **Default region:** lat `41.3111`, lng `69.2797` (Tashkent), delta `0.08`
- **Auto-fit:** `fitToCoordinates` with padding when offers change
- **Themes:** None — follows device light/dark mode automatically

### Markers

- Circular teal markers (`#16C79A`), white border
- Active state: larger radius, darker teal (`#0f766e`)
- Tap marker → highlights corresponding card in FlatList

### Callout

Native MapKit callout on tap:
- Offer title (bold)
- Restaurant name
- "Save X% · Collect by HH:MM"
- Tap callout → opens offer detail modal

---

## 6. OfferCard Component

### Card State (in FlatList)

- 200px image with overlay badges:
  - Top-right: discount badge (`-X%`, orange) + surprise badge (if applicable, red)
  - Top-left: favorite heart button (tap to toggle)
  - Bottom-left: countdown badge (black/60 normal, red/80 if <30min)
- Card body:
  - Restaurant name (uppercase, small, muted)
  - Star rating
  - Title (semibold, single line)
  - Stock progress bar (if `quantityAvailable` set): red ≤2, amber ≤4, teal ≥5
  - Price row: new price (teal) + old price (strikethrough) + distance badge

### Detail Modal (`offer/[id]`)

- Full image (250px) with share + favorite buttons
- Restaurant name, title, rating + reviews + distance
- Countdown alert box (amber or red if urgent)
- Pickup window: "Between HH:MM and HH:MM"
- Portions available row with stock indicator
- "What you might get" — contents list or surprise bag description
- Impact teaser (green banner): CO2 + water savings
- Sticky bottom bar: price + savings + "Reserve Now" button

### Reservation flow

1. Tap "Reserve Now" → local state `isReserved = true`
2. Schedule local notification for `endTime - 30 minutes`
3. Show confirmation: QR code image, pickup instructions, impact stats (CO2, water, money saved)
4. Dismiss modal → resets reservation state (same ephemeral behavior as web)

---

## 7. i18n

### Architecture

- **Locale store:** AsyncStorage key `"lastbite-locale"`, default `"ru"`
- **Hook:** `useT()` returns `Translations` object for current locale (React Context)
- **Setter:** `setLocale("en" | "ru")` updates context + AsyncStorage
- **Switching:** Instant re-render of entire app via context update

### Translation scope (buyer-only)

Namespaces copied from web:
- `home` — feed screen strings
- `offer` — card and detail modal strings
- `categories` — filter chip labels

New `mobile` namespace:
- Tab labels: Feed / Favorites / Settings
- Settings screen: Language / About / Version
- Notification text: pickup reminder message
- Empty states, search placeholder

### Russian pluralization

```ts
function pluralRu(n: number, one: string, few: string, many: string): string
```

Same helper as web. Handles Russian 3-form plural rules (mod 10/100 logic).

### Language picker (Settings tab)

Pill toggle matching web navbar style: `RU | EN`. Active language gets primary background, inactive is muted.

---

## 8. Local Notifications

- **Library:** `expo-notifications`
- **Trigger:** On "Reserve Now", schedule notification for `endTime - 30 minutes`
- **Content (localized):**
  - EN: `"Your pickup at {restaurant} ends in 30 minutes!"`
  - RU: `"Самовывоз в {restaurant} заканчивается через 30 минут!"`
- **Permission:** Request on first reserve attempt (iOS requires explicit opt-in)
- **Cancellation:** Cancel scheduled notification if user dismisses the reservation
- **Storage:** Notification IDs stored in AsyncStorage keyed by offer ID
- **Cleanup:** On app launch, remove references to expired notifications

---

## 9. Styling & Design Tokens

### Colors

| Token | Light | Dark |
|-------|-------|------|
| Primary | `#16C79A` | `#16C79A` |
| Secondary | `#FF8C42` | `#FF8C42` |
| Destructive | `#FF6B6B` | `#FF6B6B` |
| Background | `#FFFFFF` | `#09090B` |
| Foreground | `#09090B` | `#FAFAFA` |
| Muted | `#F4F4F5` | `#27272A` |
| Muted Foreground | `#71717A` | `#A1A1AA` |
| Card | `#FFFFFF` | `#09090B` |
| Border | `#E4E4E7` | `#27272A` |

### Dark mode

`useColorScheme()` from React Native. Token values swap based on system setting. Defined in `constants/colors.ts` as a `Colors.light` / `Colors.dark` object.

### Typography

System font (San Francisco on iOS). No custom fonts.

- Card title: 16px semibold
- Restaurant name: 11px uppercase, muted
- Price: 20px bold, primary color
- Badge text: 12px medium

### Spacing

8px base grid. Card border radius 16px. Card image height 200px. Map height 250px.

### Animations

- `react-native-reanimated` for card entrance: staggered fade-up (delay `index * 40ms`, duration 250ms)
- Shared element transition: card image → detail modal image (scales up smoothly)

### Component primitives

No external UI library. Build lightweight:
- `Badge` — small colored pill with text
- `Button` — primary (teal), outline, ghost variants
- `Card` — rounded container with shadow
- `IconButton` — circular tap target for favorites, share

---

## 10. Future Sync Path (not in MVP)

When adding Supabase later:

1. Replace AsyncStorage reads in `marketplace-store.ts` with Supabase queries
2. Add auth flow (new tab or modal)
3. Persist reservations server-side
4. Switch local notifications to push notifications via Expo + Supabase Edge Functions

The store interfaces (`useFavorites()`, `usePublishedSellerOffers()`) remain the same — only the backing implementation changes. This is why the local-first architecture was chosen.

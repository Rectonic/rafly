# LastBite Web

LastBite is a surplus-food marketplace UI where users discover discounted offers nearby.

## Tech Stack
- Next.js 16 (App Router)
- React 19
- Tailwind CSS 4
- shadcn/ui primitives
- Framer Motion
- React Leaflet + OpenStreetMap
- Supabase SSR Auth scaffold + Postgres schema

## Run Locally
```bash
npm install
npm run dev
```

## Auth Setup
```bash
cp .env.example .env.local
```

Required env vars:
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Database bootstrap:
- Run [`supabase/schema.sql`](/Users/boiskhonkattakhodjaev/Desktop/Useful%20Materials/LastBite/lastbite-web/supabase/schema.sql) in your Supabase SQL editor.
- Add `http://localhost:3000/auth/callback` as an allowed auth callback URL during local development.

## Quality Checks
```bash
npm run lint
npx tsc --noEmit
```

## Main App Surface
- Home feed: `src/app/page.tsx`
- Offer card: `src/components/OfferCard.tsx`
- Map: `src/components/map/OffersMap.tsx`
- Offer data: `src/data/offers.ts`
- Offer types: `src/types/offer.ts`
- Seller CRM: `src/app/seller/page.tsx`
- Shared seller marketplace store: `src/lib/marketplace-store.ts`
- Supabase auth helpers: `src/lib/supabase/*`
- Shared backend contracts: `src/lib/backend/contracts.ts`
- Seller repository + API routes: `src/lib/backend/seller-repository.ts`, `src/app/api/*`

## Development Notes
- Dated implementation notes and QA checklist live in `docs/development-log.md`.
- Current map supports style switching (`clean`, `standard`, `dark`) from the home UI.
- True Apple Maps requires MapKit JS credentials/token and a dedicated integration flow.
- Security review notes live in `docs/security-review-2026-03-15.md`.
- iOS production architecture notes live in `docs/ios-architecture-2026-03-15.md`.
- Backend auth and schema notes live in `docs/backend-auth-setup-2026-03-15.md`.
- Seller workspace migration notes live in `docs/development-log.md`.

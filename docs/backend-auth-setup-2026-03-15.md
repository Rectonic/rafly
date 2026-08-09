# Backend Auth Setup - 2026-03-15

## Goal
Add a real backend/auth foundation without breaking the current front-end prototype.

## What Was Added
1. Supabase SSR auth scaffolding for Next.js App Router.
2. Middleware-based route protection for `/seller` when Supabase env vars are present.
3. Server-rendered auth awareness in the global navbar.
4. Email/password seller login, sign-up, callback, and logout flows.
5. Shared backend contracts for seller profiles, inventory, offers, and pickup orders.
6. A Supabase/Postgres schema file with row-level security policies in `supabase/schema.sql`.
7. Authenticated API routes for seller profile, inventory, offers, pickup verification, and public published offers.
8. A client store that uses the backend path when Supabase is configured and falls back to local prototype state otherwise.
9. Automatic seller-profile bootstrap plus editable storefront settings in the seller CRM.

## Current Behavior
1. If `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are configured, `/seller` requires authentication.
2. If those env vars are configured, seller inventory, seller-published offers, pickup verification, and storefront settings are persisted through authenticated API routes.
3. The buyer home feed reads published seller offers from the backend route when Supabase is configured.
4. If the env vars are missing, the app stays in prototype mode and keeps the current local-state seller workflow.

## Required Setup
1. Copy `.env.example` to `.env.local`.
2. Fill in `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. Create a Supabase project and run `supabase/schema.sql` in the SQL editor.
4. In Supabase Auth settings, add the site URL and callback URL: `http://localhost:3000/auth/callback` for local development.

## Mobile App Setup
1. Set `EXPO_PUBLIC_SUPABASE_URL` to the Supabase project root URL, not the `/rest/v1` URL.
2. Set `EXPO_PUBLIC_SUPABASE_ANON_KEY` to the public anon key.
3. For backend smoke testing, set `LASTBITE_BACKEND_E2E_SELLER_EMAIL` and `LASTBITE_BACKEND_E2E_SELLER_PASSWORD` to a known test seller account.
4. Run the SQL in `supabase/schema.sql` from the Supabase SQL editor before expecting mobile seller login to complete. Password auth can succeed while the app still fails if `public.seller_profiles` has not been created.
5. Verify the read-only auth/schema path with:

```bash
npm run backend:auth-smoke -- --require
```

The expected production-ready result is `status: "passed"` for a seller with an existing profile, or `status: "auth_ok_profile_missing"` for a valid seller account that still needs onboarding. `status: "schema_missing"` means the SQL schema has not been applied or PostgREST has not reloaded its schema cache.

## Next Backend Step
Replace the seeded pickup-order placeholder flow with real buyer reservations and connect order creation to the marketplace checkout path.

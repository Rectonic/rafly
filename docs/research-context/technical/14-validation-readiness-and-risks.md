# Validation, Readiness, And Risks

## Current Readiness

Current state: simulator-preview ready, not production-ready.

Strongly validated:

- Jest coverage for buyer feed, reservations, favorites, localization, map region, seller auth screens, seller stores, inventory, orders, Supabase schema, and backend smoke/E2E harness logic.
- TypeScript and ESLint validation in recent phases.
- Release simulator builds that embed `main.jsbundle`.
- Native simulator UI tests on iPhone 17 simulator for buyer reservation recovery, favorites, offer-detail close/product sections, map tap selection, radius filtering, language switching, pickup reminder status, reliability smoke, seller dashboard/checklist/order lifecycle, and shop inventory/scanner surface.
- Generic signed physical iPhone Release build and install using a team-owned bundle id override.

Not production validated:

- Real Supabase migrations and RLS in the target project.
- Real authenticated seller create/inventory/orders/profile flows.
- Full reservation lifecycle E2E against real Supabase credentials.
- Physical iPhone camera/OCR/scanner behavior.
- Real-device notification permissions and delivery.
- TestFlight/App Store signing/distribution.
- Buyer cross-device history.
- Server-side push reminders.
- Broader device sizes, orientation, keyboard behavior, Dynamic Type, and accessibility audit.

## Latest Backend Smoke Status

Recent `backend:auth-smoke` no longer freezes because the script uses direct HTTPS calls with timeouts instead of loading `@supabase/supabase-js` in the iCloud-backed workspace.

Recent observed result:

```json
{
  "status": "auth_ok_profile_missing",
  "authOk": true,
  "profileQueryOk": true,
  "hasProfile": false
}
```

Interpretation: credentials work, schema is reachable, but the seller account still needs onboarding/profile creation.

## Key Production Blockers

1. Apply `supabase/schema.sql` and migration files to the target Supabase project.
2. Run `npm run backend:auth-smoke -- --require --timeout-ms=10000`.
3. Complete seller onboarding for the test seller so `seller_profiles` exists.
4. Run backend lifecycle E2E against a clearly marked test seller and non-production target.
5. Validate buyer reserve/cancel/retry and seller order fulfillment against real Supabase.
6. Install and launch on an unlocked physical iPhone.
7. Validate scanner/OCR/permissions on physical device.
8. Validate TestFlight signing with production bundle id/profile.
9. Add buyer-safe server history if cross-device reservation recovery is required.
10. Add production notification strategy beyond local reminders.

## Known Environment Risks

- The Desktop workspace path can cause Node/native tools to hang because it is iCloud-backed and contains spaces.
- Use `/tmp` mirrors for heavy Xcode/Jest/native validation when the workspace hangs.
- Local Supabase via Docker was previously blocked by Docker/containerd storage errors.
- Physical launch through `devicectl` can be blocked when iOS reports the device locked.
- The committed bundle id may not be provisioned for the current Apple team.

## Recommended Validation Order

1. Backend schema smoke with real Supabase.
2. Create/complete a test seller profile.
3. Real seller login on mobile.
4. Seller publish offer.
5. Buyer feed sees seller offer.
6. Buyer reserves seller offer.
7. Seller order appears pending.
8. Seller verifies pickup.
9. Buyer cancellation and retry scenarios.
10. Physical scanner/OCR validation.
11. Notification permission and delivery validation.
12. TestFlight install and launch.

## Residual Technical Debt

- Web/Next scaffold under `src/` may confuse future agents unless its role is clearly scoped.
- Buyer reservations are local-first and do not yet represent a buyer-owned backend ledger.
- Seller inventory does not yet drive offer creation automatically.
- Some loading states are panels rather than polished skeletons.
- No realtime seller order updates yet.
- No production analytics/event pipeline yet.
- No centralized feature flags or environment health screen.
- Some product policies are represented as text fields rather than enforceable backend rules.

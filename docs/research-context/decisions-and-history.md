# Decisions And History

This file records high-value decisions and evolution points. It intentionally compresses long QA history into research-relevant context.

## Product/Architecture Decisions

1. Mobile MVP uses Expo/React Native.
   - Rationale: fastest path to native iOS prototype with shared TypeScript patterns, Expo Router, and JS test coverage.
   - Tradeoff: native camera/OCR and App Store readiness need more validation than a pure SwiftUI implementation would.

2. Supabase is the shared backend direction.
   - Rationale: Auth, Postgres, RLS, storage/realtime potential, JS client, and future Swift support if the project later moves native.
   - Tradeoff: RLS and migration correctness become production-critical.

3. Buyer discovery is local-first with seed offers.
   - Rationale: app stays usable for demos and QA without backend data.
   - Tradeoff: seed offers can hide marketplace liquidity problems.

4. Seller-created content uses structured translations.
   - Rationale: static i18n is insufficient because seller titles, business names, addresses, and contents must change with language.
   - Tradeoff: seller content entry/backfill policy is needed.

5. Reservation codes are recoverable but private.
   - Rationale: buyers must recover pickup codes after relaunch, but raw codes should not live in normal reservation metadata.
   - Implementation: SecureStore with AsyncStorage fallback for simulator entitlement gaps.

6. Seller-backed reservation creation moved to Supabase RPC.
   - Rationale: direct public inserts could not atomically decrement quantity, prevent races, or own sold-out status.
   - Consequence: `reserve_seller_offer` and `cancel_seller_reservation` are critical backend contracts.

7. Pickup reminders are local notifications for now.
   - Rationale: useful MVP reminder without backend push infrastructure.
   - Tradeoff: reminders are device-local and do not work like production push across devices or app reinstall.

8. Authenticated seller simulator QA uses a guarded local E2E seller.
   - Rationale: simulator can validate navigation/rendering without real Supabase sessions.
   - Guardrail: only enabled when Supabase is unavailable and explicit E2E flags are set.

9. Simulator builds disable ML Kit.
   - Rationale: current OCR dependency includes device-only framework slices that block arm64 simulator linking.
   - Tradeoff: physical device is required for true scanner/OCR QA.

10. The smoke script uses direct HTTP, not Supabase JS.
    - Rationale: loading Supabase JS in the iCloud-backed workspace froze the CLI. Direct HTTP with timeouts gives deterministic auth/schema status.

## Phase Evolution

Initial MVP:

- Buyer-only iOS discovery app.
- Seed offers.
- Local favorites, filters, map, and reminders.

Phase 1:

- Buyer reservation history.
- Recoverable pickup codes.
- Local reservation persistence.

Phase 2:

- Settings language switcher.
- Dynamic English/Russian UI.
- Seller profile and offer translations.

Phase 3:

- Product detail improvements: pickup instructions, allergens, dietary badges, cancellation policy.
- Seller offer metadata path.

Phase 4:

- Radius filters, Near Me, map/list synchronization, permission fallback.

Phase 5:

- Local pickup reminders and reminder status UI.

Phase 6:

- Loading/error/empty/retry states.
- Reservation sync timeout/retry metadata.
- Seller inventory/create/orders reliability states.

Phase 7:

- Seller setup checklist.
- Seller order lifecycle clarity.
- Pending-only pickup verification.

Phase 8:

- Buyer cancellation propagation to synced seller pickup orders.

Phase 9:

- Seller order last-refreshed visibility.

Phase 10:

- Server-owned reservation lifecycle through Supabase RPCs.
- Direct public pickup-order insertion removed.

Recent backend/device work:

- Seller auth credentials were proven valid through smoke checks.
- Missing schema was diagnosed and made actionable.
- Auth smoke now reports `auth_ok_profile_missing` when the test seller needs onboarding.
- Updated app builds install on Rectonic; command-line launch can still be blocked by device lock state.

## Historical Documents

Use these only if more detail is needed:

- `docs/mobile-qa/2026-05-27-lastbite-mobile-qa-report.md`
- `docs/superpowers/specs/2026-03-20-ios-buyer-app-design.md`
- `docs/superpowers/plans/2026-03-20-ios-buyer-app.md`
- `docs/ios-architecture-2026-03-15.md`
- `docs/backend-auth-setup-2026-03-15.md`
- `docs/security-review-2026-03-15.md`

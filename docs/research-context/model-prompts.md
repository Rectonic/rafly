# Model Prompts

Use these prompts with the files in this context pack. They are designed to save tokens by naming the exact context set and the expected output.

## Product Research Prompt

Attach:

- `CONTEXT.md`
- `docs/research-context/README.md`
- `docs/research-context/product/01-purpose-and-strategy.md`
- `docs/research-context/product/02-users-and-workflows.md`
- `docs/research-context/product/03-product-surface-and-features.md`
- `docs/research-context/product/04-product-research-questions.md`
- `docs/research-context/decisions-and-history.md`

Prompt:

```text
You are advising on LastBite, a mobile-first surplus-food marketplace in Tashkent with English/Russian support. Use the attached product context and domain glossary. Do not focus on code implementation unless it changes product strategy.

Return:
1. The strongest product thesis and the weakest assumptions.
2. The highest-risk marketplace liquidity questions.
3. Buyer and seller segments to prioritize for first launch.
4. A concrete research plan for the next 2 weeks.
5. Product decisions that should be made before engineering continues.
6. A ranked production MVP scope: must-have, should-have, later.
7. Metrics/events needed to validate the product.
```

## Technical Architecture Review Prompt

Attach:

- `CONTEXT.md`
- `docs/research-context/README.md`
- `docs/research-context/technical/10-system-architecture.md`
- `docs/research-context/technical/11-stack-tooling-and-commands.md`
- `docs/research-context/technical/12-data-backend-and-security.md`
- `docs/research-context/technical/13-mobile-state-navigation-and-ui.md`
- `docs/research-context/technical/14-validation-readiness-and-risks.md`
- `docs/research-context/decisions-and-history.md`

Prompt:

```text
You are reviewing LastBite Mobile's architecture. Use the attached technical context. Assume the current app is Expo/React Native with Supabase backend contracts. Focus on production readiness, architecture risks, and sequencing.

Return:
1. Top 10 technical risks, ranked by production impact.
2. Which risks block public launch versus can wait.
3. A recommended technical roadmap for the next 3 phases.
4. Any architectural decisions that should be revisited.
5. Backend/RLS/reservation lifecycle review notes.
6. Mobile-native QA plan for physical device, TestFlight, permissions, notifications, keyboard, safe areas, and scanner/OCR.
7. Suggested tests or observability that are missing.
```

## Backend And Reservation Lifecycle Prompt

Attach:

- `CONTEXT.md`
- `docs/research-context/technical/12-data-backend-and-security.md`
- `docs/research-context/technical/14-validation-readiness-and-risks.md`
- `supabase/schema.sql`
- `supabase/migrations/20260529000000_reservation_lifecycle_rpcs.sql`
- `lib/reservations.ts`
- `lib/reservations-store.tsx`
- `scripts/supabase-reservation-lifecycle-e2e.cjs`

Prompt:

```text
Review LastBite's seller-backed reservation lifecycle. The app creates local buyer reservations and syncs seller-backed reservations to Supabase RPCs. Evaluate correctness under concurrency, retry, cancellation, expired pickup windows, duplicate pickup codes, RLS, and recovery after network failures.

Return:
1. Critical correctness bugs or race conditions.
2. RLS and security-definer risks.
3. Missing database constraints or indexes.
4. API changes needed for production buyer history.
5. E2E cases that should be added before launch.
```

## Mobile UX QA Prompt

Attach:

- `CONTEXT.md`
- `docs/research-context/product/02-users-and-workflows.md`
- `docs/research-context/product/03-product-surface-and-features.md`
- `docs/research-context/technical/13-mobile-state-navigation-and-ui.md`
- `docs/research-context/technical/14-validation-readiness-and-risks.md`

Optional visual attachments:

- Latest retained screenshots from `docs/mobile-qa/artifacts/2026-05-28-*`.

Prompt:

```text
Audit LastBite Mobile's buyer and seller UX from a production mobile-app standpoint. Focus on navigation completeness, trust, accessibility, localized string length, empty/loading/error states, safe areas, and operational seller usability.

Return:
1. UX gaps that block real users.
2. UX gaps that are polish only.
3. Missing screens/states for buyer and seller flows.
4. A prioritized mobile QA checklist.
5. Recommendations to make the interface feel more complete without overbuilding.
```

## Oracle Review Prompt

Attach all files in `docs/research-context/` plus `CONTEXT.md`.

Prompt:

```text
Review this context pack for LastBite. The goal is to give a research-grade model enough product and technical context while saving tokens. Identify missing context, duplicated context, unclear terminology, stale claims, and any files that should be split or merged. Return concrete edits only.
```

# LastBite Verified-Offer Beta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the beta chain, inventory evidence to human validation to approved allocation to public offer to atomic reservation to pickup to reconciliation, as a modular monolith in one Expo app and one Supabase backend.

**Architecture:** Coordinator-owned v2 contracts, API facades, in-memory fakes, feature flags that fail closed, additive v2 Supabase migrations with RPCs for invariant-heavy writes, transactional outbox. Buyer and Seller product surfaces consume only the facades. Authority docs: `docs/beta/SHARED_CONTEXT.md`, `docs/beta/COORDINATOR_AGENT_PROMPT.md`, `docs/beta/BUYER_AGENT_PROMPT.md`, `docs/beta/SELLER_AGENT_PROMPT.md`.

**Tech Stack:** Expo SDK 55, React Native 0.83.6, React 19.2, TypeScript strict, expo-router, jest-expo + @testing-library/react-native, @supabase/supabase-js 2.x, Supabase CLI local stack for backend tests.

## Global Constraints

- TypeScript strict mode. No new npm dependencies in any task.
- Path alias `@/*` maps to repo root. Jest only discovers tests under `__tests__/`.
- Old web code under `src/` is dead. Never import from it or edit it.
- Every mutating command carries an idempotency key and, where stale writes are possible, an expected version.
- Buyer surfaces never receive private stock, confidence internals, supplier cost, staff identity, or exception data.
- Pilot mode never shows seed offers. Demo mode never mixes in live offers. Flags fail closed to demo.
- Staff role cannot approve adjustments or publish offers. Manager and owner can.
- Raw pickup codes: server stores only sha256 hash plus safe hint. Client stores raw code in SecureStore only. Never logged.
- All v2 SQL is additive. Never modify v1 tables, policies, or RPCs beyond additive changes. Prod deploy of migrations is a founder step, not part of this plan.
- Money is integer UZS in v2 (no decimals). Timezone label is `Asia/Tashkent`, timestamps are ISO 8601 UTC strings.
- No payments, fiscal writes, POS adapters, OCR productization, cameras, personalization, dynamic pricing, reordering.
- Markdown text authored in tasks must avoid em-dashes and semicolons (a repo hook rejects them, and it also rewrites certain words, follow its error messages). New TypeScript matches the existing repo style, semicolons in statements are normal, but code comments and docstrings must avoid em-dashes and semicolons. If a Write is rejected by the hook, fix comment punctuation first.
- Backend integration tests run only against the local Supabase stack (`LASTBITE_TEST_SUPABASE_URL` set). When env is absent the suites self-skip and print `not run: local supabase env absent`. Never touch production credentials.
- Verification trio: `npm run test -- --runInBand`, `npm run typecheck`, `npm run lint`. Every task ends green.
- Commit after each task with a conventional message. Never commit `.env`.

---

### Task 1: v2 contracts, API context, boundary guard, product i18n modules

**Files:**
- Create: `lib/contracts/common.ts`, `lib/contracts/marketplace.ts`, `lib/contracts/seller.ts`, `lib/contracts/flags.ts`, `lib/contracts/index.ts`
- Create: `lib/api/buyer-api.ts`, `lib/api/seller-api.ts`, `lib/api/context.tsx`, `lib/api/index.ts`
- Create: `i18n/buyer.ts`, `i18n/seller.ts` (wired through the existing i18n aggregation, inspect `i18n/` and follow its existing pattern)
- Create: `__tests__/architecture/boundaries.test.ts`, `__tests__/contracts/contracts.test.ts`
- Test: the two new test files

**Interfaces produced (later tasks rely on these exact names):** every type below, plus `BuyerMarketplaceApiV2`, `SellerStoreApiV2`, `ApiProvider`, `useBuyerApi()`, `useSellerApi()`.

- [ ] **Step 1: Write failing contract test** `__tests__/contracts/contracts.test.ts` that imports from `@/lib/contracts` and asserts `err('sold_out', 'msg').retryable === false`, `err('network_error', 'msg').retryable === true`, and that `ok(1)` narrows via `result.ok`. Run `npx jest __tests__/contracts -t retryable`, expect module-not-found failure.

- [ ] **Step 2: Implement contracts exactly as pinned below** (bodies semicolon-free, doc comments allowed but without em-dashes or semicolons).

`lib/contracts/common.ts`:

```ts
export type IsoDateTime = string
export type IsoDate = string
export type StoreRole = 'staff' | 'manager' | 'owner' | 'operator'
export type CommandErrorCode =
  | 'not_found'
  | 'forbidden'
  | 'validation_failed'
  | 'version_conflict'
  | 'invalid_state'
  | 'idempotency_conflict'
  | 'sold_out'
  | 'offer_not_live'
  | 'allocation_exceeded'
  | 'network_error'
  | 'unknown'

export interface CommandError {
  code: CommandErrorCode
  message: string
  retryable: boolean
  details?: Record<string, unknown>
}

export type Result<T> = { ok: true, value: T } | { ok: false, error: CommandError }

export const ok = <T>(value: T): Result<T> => ({ ok: true, value })

const RETRYABLE: ReadonlySet<CommandErrorCode> = new Set(['network_error', 'unknown'])

export const err = (
  code: CommandErrorCode,
  message: string,
  details?: Record<string, unknown>,
): Result<never> => ({
  ok: false,
  error: { code, message, retryable: RETRYABLE.has(code), details },
})
```

`lib/contracts/marketplace.ts`:

```ts
import type { IsoDateTime, Result } from './common'

export type MarketplaceOfferStatusV2 = 'live' | 'paused' | 'sold_out' | 'expired' | 'withdrawn'

export type ReservationStatusV2 =
  | 'held'
  | 'fulfilled'
  | 'cancelled_by_buyer'
  | 'cancelled_by_seller'
  | 'expired_no_show'
  | 'failed_stock_mismatch'

export interface MarketplaceOfferV2 {
  id: string
  version: number
  storeId: string
  storeName: string
  storeAddress: string
  latitude: number
  longitude: number
  title: string
  category: string
  imageUrl: string | null
  contents: string[]
  offerPriceUzs: number
  referencePriceUzs: number | null
  discountPercent: number | null
  quantityAvailable: number
  pickupStart: IsoDateTime
  pickupEnd: IsoDateTime
  timezone: 'Asia/Tashkent'
  allergens: string[]
  dietaryBadges: string[]
  pickupInstructions: string | null
  cancellationPolicy: string | null
  lastVerifiedAt: IsoDateTime
  status: MarketplaceOfferStatusV2
}

export interface BuyerReservationV2 {
  id: string
  version: number
  offerId: string
  status: ReservationStatusV2
  quantity: 1
  offerSnapshot: MarketplaceOfferV2
  pickupCodeHint: string
  holdExpiresAt: IsoDateTime
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

export interface ReserveOfferV2Input {
  offerId: string
  quantity: 1
  clientReservationId: string
  installationId: string
  expectedOfferVersion: number
}

export interface ReserveOfferV2Result {
  reservation: BuyerReservationV2
  pickupCode: string
}

export interface CancelReservationV2Input {
  reservationId: string
  installationId: string
  idempotencyKey: string
}

export type { Result }
```

`lib/contracts/seller.ts`:

```ts
import type { IsoDate, IsoDateTime, StoreRole } from './common'
import type { MarketplaceOfferV2, ReservationStatusV2 } from './marketplace'

export type StockConfidenceV2 = 'high' | 'medium' | 'low'

export interface InventorySummaryV2 {
  storeProductId: string
  storeId: string
  productName: string
  barcode: string | null
  category: string | null
  onHandQuantity: number
  confidence: StockConfidenceV2
  lastVerifiedAt: IsoDateTime | null
  maxOfferableQuantity: number
  allocatedQuantity: number
  expiryDate: IsoDate | null
  hasOpenExceptions: boolean
  version: number
}

export interface RecordInventoryCountV2Input {
  storeId: string
  countSessionId: string
  lines: Array<{ storeProductId: string, observedQuantity: number }>
}

export interface StockAdjustmentProposalV2 {
  id: string
  storeId: string
  storeProductId: string
  productName: string
  currentQuantity: number
  proposedQuantity: number
  delta: number
  reason: 'count'
  status: 'pending' | 'approved' | 'rejected' | 'applied'
  createdByRole: StoreRole
  createdAt: IsoDateTime
  version: number
}

export interface ApproveStockAdjustmentV2Input {
  storeId: string
  proposalId: string
  decision: 'approve' | 'reject'
  idempotencyKey: string
  expectedVersion: number
}

export interface PublishOfferV2Input {
  storeId: string
  idempotencyKey: string
  allocation: {
    storeProductId: string
    quantity: number
    physicallySetAside: boolean
  }
  title: string
  category: string
  imageUrl: string | null
  contents: string[]
  offerPriceUzs: number
  referencePriceUzs: number | null
  pickupStart: IsoDateTime
  pickupEnd: IsoDateTime
  allergens: string[]
  dietaryBadges: string[]
  pickupInstructions: string | null
  cancellationPolicy: string | null
}

export interface PauseOfferV2Input {
  storeId: string
  offerId: string
  idempotencyKey: string
  expectedVersion: number
}

export interface SellerPickupV2 {
  reservationId: string
  offerId: string
  offerTitle: string
  status: ReservationStatusV2
  pickupCodeHint: string
  holdExpiresAt: IsoDateTime
  pickupStart: IsoDateTime
  pickupEnd: IsoDateTime
  createdAt: IsoDateTime
  version: number
}

export interface FulfillReservationV2Input {
  storeId: string
  pickupCode: string
  idempotencyKey: string
}

export interface ReportStockMismatchV2Input {
  storeId: string
  offerId: string
  observedQuantity: number
  reason: string
  idempotencyKey: string
}

export interface StoreExceptionV2 {
  id: string
  storeId: string
  kind: 'stock_mismatch' | 'import_conflict' | 'expiry_risk' | 'closeout_missed'
  message: string
  status: 'open' | 'resolved'
  relatedOfferId: string | null
  relatedStoreProductId: string | null
  createdAt: IsoDateTime
}

export interface StoreMembershipV2 {
  storeId: string
  storeName: string
  role: StoreRole
  storeFlags: { pilotModeEnabled: boolean, shopSellerBetaEnabled: boolean }
}

export type { MarketplaceOfferV2 }
```

`lib/contracts/flags.ts`:

```ts
export type MarketplaceModeV2 = 'demo' | 'pilot'

export interface FeatureFlagsV2 {
  marketplaceMode: MarketplaceModeV2
}

export const FAIL_CLOSED_FLAGS: FeatureFlagsV2 = { marketplaceMode: 'demo' }
```

`lib/api/buyer-api.ts`:

```ts
import type { Result } from '@/lib/contracts/common'
import type {
  BuyerReservationV2,
  CancelReservationV2Input,
  MarketplaceOfferV2,
  ReserveOfferV2Input,
  ReserveOfferV2Result,
} from '@/lib/contracts/marketplace'

export interface BuyerMarketplaceApiV2 {
  listMarketplaceOffersV2(): Promise<Result<MarketplaceOfferV2[]>>
  getMarketplaceOfferV2(offerId: string): Promise<Result<MarketplaceOfferV2>>
  reserveOfferV2(input: ReserveOfferV2Input): Promise<Result<ReserveOfferV2Result>>
  cancelReservationV2(input: CancelReservationV2Input): Promise<Result<BuyerReservationV2>>
  getBuyerReservationsV2(installationId: string): Promise<Result<BuyerReservationV2[]>>
}
```

`lib/api/seller-api.ts`:

```ts
import type { Result } from '@/lib/contracts/common'
import type { MarketplaceOfferV2 } from '@/lib/contracts/marketplace'
import type {
  ApproveStockAdjustmentV2Input,
  FulfillReservationV2Input,
  InventorySummaryV2,
  PauseOfferV2Input,
  PublishOfferV2Input,
  RecordInventoryCountV2Input,
  ReportStockMismatchV2Input,
  SellerPickupV2,
  StockAdjustmentProposalV2,
  StoreExceptionV2,
  StoreMembershipV2,
} from '@/lib/contracts/seller'

export interface SellerStoreApiV2 {
  getMyStoreMembershipsV2(): Promise<Result<StoreMembershipV2[]>>
  listStoreInventoryV2(storeId: string): Promise<Result<InventorySummaryV2[]>>
  recordInventoryCountV2(input: RecordInventoryCountV2Input): Promise<Result<StockAdjustmentProposalV2[]>>
  approveStockAdjustmentV2(input: ApproveStockAdjustmentV2Input): Promise<Result<StockAdjustmentProposalV2>>
  approveAndPublishOfferV2(input: PublishOfferV2Input): Promise<Result<MarketplaceOfferV2>>
  pauseOfferV2(input: PauseOfferV2Input): Promise<Result<MarketplaceOfferV2>>
  listSellerPickupsV2(storeId: string): Promise<Result<SellerPickupV2[]>>
  fulfillReservationV2(input: FulfillReservationV2Input): Promise<Result<SellerPickupV2>>
  reportStockMismatchV2(input: ReportStockMismatchV2Input): Promise<Result<{ offer: MarketplaceOfferV2, exception: StoreExceptionV2 }>>
  listStoreExceptionsV2(storeId: string): Promise<Result<StoreExceptionV2[]>>
}
```

`lib/api/context.tsx`: React context `ApiContext` holding `{ buyerApi: BuyerMarketplaceApiV2, sellerApi: SellerStoreApiV2 }`, an `ApiProvider` component taking those as props, and hooks `useBuyerApi()` and `useSellerApi()` that throw `new Error('ApiProvider missing')` when used outside the provider. `lib/contracts/index.ts` and `lib/api/index.ts` re-export everything.

- [ ] **Step 3: Run contract test, expect pass.** `npx jest __tests__/contracts`

- [ ] **Step 4: Write failing boundary test** `__tests__/architecture/boundaries.test.ts`. It walks `app/`, `components/`, `lib/`, `i18n/` with `fs` (extensions ts and tsx, skip `node_modules`), extracts import specifiers with the regex `/from\s+['"]([^'"]+)['"]/g` plus `/import\(\s*['"]([^'"]+)['"]\s*\)/g` and `/require\(\s*['"]([^'"]+)['"]\s*\)/g`, resolves `@/` to repo root, and asserts these rules:
  1. Files under `app/(tabs)/`, `app/offer/`, `components/buyer/`, `lib/buyer/` never import `@supabase/`, `lib/supabase`, `lib/seller/`, `components/seller/`, or `app/(seller-tabs)/`.
  2. Files under `app/(seller-tabs)/`, `app/auth/`, `components/seller/`, `lib/seller/` never import `@supabase/`, `lib/buyer/`, `components/buyer/`, or `app/(tabs)/`.
  3. Direct `@supabase/` or `lib/supabase` imports are allowed only in `lib/api/`, `lib/supabase.ts`, and files named in the frozen legacy allowlist constant `LEGACY_SUPABASE_IMPORTERS` (populate it with the exact current offender paths found by running the walker once and printing violations, then freeze it, the test fails if a NEW file joins the list and fails with a helpful message naming the file).
  4. `lib/contracts/` files import nothing outside `lib/contracts/`.
  Run it, confirm it fails only because the allowlist constant is empty, then populate the allowlist with the printed current offenders.

- [ ] **Step 5: Create `i18n/buyer.ts` and `i18n/seller.ts`** following the existing i18n module pattern (inspect `i18n/` first). Each exports an `en` and `ru` object, initially with namespaced placeholder keys `buyer.v2.pending` and `seller.v2.pending`, wired into the existing aggregation so `npm run typecheck` passes. Product tasks will fill them.

- [ ] **Step 6: Full verification.** `npm run test -- --runInBand`, `npm run typecheck`, `npm run lint`. All green.

- [ ] **Step 7: Commit** `feat(contracts): v2 shared contracts, api facade interfaces, boundary guard, product i18n modules`

### Task 2: Feature flags that fail closed

**Files:**
- Create: `lib/feature-flags/index.ts`, `lib/feature-flags/provider.tsx`
- Test: `__tests__/feature-flags/feature-flags.test.ts`

**Interfaces:**
- Consumes: `FeatureFlagsV2`, `FAIL_CLOSED_FLAGS` from Task 1.
- Produces: `FlagSourceV2 = () => Promise<FeatureFlagsV2>`, `FeatureFlagsProvider({ source, children })`, `useFeatureFlags(): { flags: FeatureFlagsV2, status: 'loading' | 'ready' | 'failed', reload: () => void }`. While loading and on failure, `flags` equals `FAIL_CLOSED_FLAGS`.

- [ ] **Step 1: Write failing tests** with `renderHook` from @testing-library/react-native covering: initial state is fail closed while loading, source resolving `{ marketplaceMode: 'pilot' }` flips status to ready with pilot, source rejection yields status failed with demo flags, `reload()` retries a previously failing source, unmount during in-flight load does not warn (guard state updates).
- [ ] **Step 2: Run, expect module-not-found fail.**
- [ ] **Step 3: Implement provider** (no external state library, plain context plus `useState`/`useEffect`, semicolon-free).
- [ ] **Step 4: Run test file, expect green.**
- [ ] **Step 5: Full verification trio.**
- [ ] **Step 6: Commit** `feat(flags): fail-closed feature flag provider`

### Task 3: In-memory Store Core fake and conformance suite

**Files:**
- Create: `lib/test-kit/in-memory-store-core.ts`, `lib/test-kit/scenarios.ts`, `lib/test-kit/index.ts`
- Create: `__tests__/test-kit/buyer-api-conformance.ts` (exports `runBuyerApiConformance(makeHarness)`), `__tests__/test-kit/seller-api-conformance.ts` (exports `runSellerApiConformance(makeHarness)`), `__tests__/test-kit/fake-conformance.test.ts` (runs both against the fake)
- Test: `__tests__/test-kit/fake-conformance.test.ts`

**Interfaces:**
- Consumes: every contract and both facade interfaces from Task 1.
- Produces: `class InMemoryStoreCore` exposing `buyerApi(installationContext?: {}): BuyerMarketplaceApiV2`, `sellerApi(actor: { userId: string }): SellerStoreApiV2`, `admin` helpers: `createStore({ name, pilotModeEnabled, shopSellerBetaEnabled })`, `addMembership({ storeId, userId, role })`, `addProduct({ storeId, productName, barcode?, category?, onHandQuantity, confidence, lastVerifiedAt?, expiryDate? })`, `setNow(iso: string)`, `listOutboxEvents()`, `listAuditEntries()`. Also `makeDefaultScenario(core)` in `scenarios.ts` returning ids for one pilot store with owner, manager, staff users and three products (high confidence, low confidence, expired batch).

**Behavior the fake must implement (single source: SHARED_CONTEXT state machines and invariants):**
- `approveAndPublishOfferV2`: manager or owner only (staff gets `forbidden`). Allocation quantity must not exceed `maxOfferableQuantity` where `maxOfferable = confidence === 'high' ? onHand - activeAllocated : (allocation.physicallySetAside ? requested : 0)` and expired `expiryDate` (relative to `setNow`) rejects with `validation_failed`. `referencePriceUzs` null forces `discountPercent` null, otherwise `discountPercent = round((1 - offer/reference) * 100)`. `pickupEnd` must be after `pickupStart`, both in the future. Same `idempotencyKey` returns the SAME offer without duplicating. Publishes status `live`, version 1, `quantityAvailable = allocation.quantity`, decrements available allocation pool, writes outbox `offer_published` and audit entry.
- `listMarketplaceOffersV2`: only `live` offers with `pickupEnd` in the future. Offers past `pickupEnd` flip to `expired` lazily on read, never revive.
- `reserveOfferV2`: quantity fixed 1. Unknown offer `not_found`. Offer not live `offer_not_live`. `expectedOfferVersion` mismatch `version_conflict`. `quantityAvailable` 0 `sold_out`. Success decrements quantity (0 flips status `sold_out`, bumps version), creates reservation status `held` with `holdExpiresAt = offer.pickupEnd`, 6-char uppercase code, hint = last 2 chars, snapshot frozen at reserve time, outbox `reservation_held`, audit. Same `clientReservationId` returns the SAME result object including the same raw code (idempotent). Two different clients racing the last unit: exactly one succeeds (the fake is synchronous, simulate by sequential calls in tests).
- `cancelReservationV2`: only by matching `installationId` (`forbidden` otherwise). From `held` releases one unit back (sold_out flips back to live, version bump), status `cancelled_by_buyer`, outbox, audit. Repeat with same `idempotencyKey` returns same result. Cancel on terminal status returns `invalid_state`.
- `getBuyerReservationsV2`: reservations for installation, hint only (no raw code anywhere in the returned objects).
- `recordInventoryCountV2`: staff or above. Same `countSessionId` idempotent. Creates one pending `StockAdjustmentProposalV2` per line where observed differs from on hand, updates `lastVerifiedAt` on counted products, recomputes confidence high.
- `approveStockAdjustmentV2`: manager or owner only. `expectedVersion` mismatch `version_conflict`. Approve applies delta to `onHandQuantity`, status `applied`, movement recorded, audit. Reject flips status rejected. Terminal proposals return `invalid_state` on re-decision with a different key, same key replays stored result.
- `listSellerPickupsV2`: reservations on the store's offers, newest first, hint only.
- `fulfillReservationV2`: manager or owner only. Looks up active `held` reservation in the store by exact raw code. Wrong code `not_found`. Terminal reservation `invalid_state`. Success sets `fulfilled`, records one inventory movement (decrement on hand by 1) exactly once even when the same `idempotencyKey` replays, outbox `reservation_fulfilled`, audit.
- `reportStockMismatchV2`: manager or owner only. Pauses the offer (status `paused`, version bump), fails all its `held` reservations to `failed_stock_mismatch`, releases nothing back, creates open `StoreExceptionV2` kind `stock_mismatch`, outbox, audit. Idempotent by key.
- `pauseOfferV2`: manager or owner. Live to paused, version bump, idempotent by key, `version_conflict` on stale `expectedVersion`.
- `listStoreInventoryV2` and membership queries: cross-store access by a non-member returns `forbidden`. `hasOpenExceptions` true while a related open exception exists.
- Every mutation appends an audit entry `{ actorUserId or installationId, storeId, command, at }` and outbox events named above. Conformance asserts audit and outbox growth for publish, reserve, cancel, fulfill, mismatch.

- [ ] **Step 1: Write the two conformance modules** as exported functions of `(makeHarness: () => { core: InMemoryStoreCore, scenario: DefaultScenario })` containing `describe`/`it` blocks for EVERY behavior bullet above (roughly 45 assertions total, each bullet gets at least one it-block, idempotency bullets get replay assertions, role bullets get per-role assertions).
- [ ] **Step 2: Wire `fake-conformance.test.ts`** calling both against a fresh fake per test. Run, expect failures (fake absent).
- [ ] **Step 3: Implement `InMemoryStoreCore`** until the whole conformance suite passes. Keep state as plain Maps, version integers, a `now` injectable clock, deterministic code generator (seeded counter producing codes like `LB0001` padded to 6 chars) so tests are stable.
- [ ] **Step 4: Full verification trio.**
- [ ] **Step 5: Commit** `feat(test-kit): in-memory store core fake with buyer and seller conformance suites`

### Task 4: Local backend harness plus migrations A (baseline, stores, memberships, roles, flags)

**Files:**
- Create: `supabase/migrations/20260528000000_v1_baseline.sql` (exact content of `supabase/schema.sql`, so the local stack reproduces prod state before the existing `20260529000000_reservation_lifecycle_rpcs.sql`)
- Create: `supabase/migrations/20260810100000_v2_stores_roles_flags.sql`
- Create: `scripts/backend-test-env.sh`, `scripts/run-backend-tests.sh`
- Create: `__tests__/backend/helpers.ts`, `__tests__/backend/stores-roles.integration.test.ts`
- Modify: `package.json` scripts, add `"test:backend": "bash scripts/run-backend-tests.sh"`

**Interfaces:**
- Produces SQL objects later tasks build on: `stores`, `store_memberships`, `app_flags`, helper `fn_current_store_role(p_store_id uuid) returns text`.
- Produces test helpers: `getServiceClient()`, `getAnonClient()`, `signInTestUser(email)`, `backendEnvPresent()` and the self-skip pattern `const d = backendEnvPresent() ? describe : describe.skip`.

**Migration A content spec (SQL file, semicolons fine there):**
- `stores`: id uuid pk default gen_random_uuid, name text not null, address text, latitude and longitude double precision, pilot_mode_enabled boolean not null default false, shop_seller_beta_enabled boolean not null default false, created_at timestamptz default now.
- `store_memberships`: id uuid pk, store_id fk stores, user_id uuid references auth.users, role text check in staff, manager, owner, operator, unique (store_id, user_id), created_at.
- `app_flags`: id text pk, value jsonb not null, updated_at. Seed row id `marketplace_mode`, value `{"mode": "demo"}`. Grant select to anon and authenticated (flag read is public), writes only via service role (no policies for anon or authenticated writes).
- `fn_current_store_role(p_store_id)`: security definer, returns the role of `auth.uid()` in that store or null.
- RLS on all three (app_flags select policy for all, stores select for members plus anon select of id, name, address, latitude, longitude through the later public view only, memberships select own rows). Deny writes by default (no insert or update policies for client roles, service role bypasses).

- [ ] **Step 1: Write `scripts/backend-test-env.sh`** exporting `LASTBITE_TEST_SUPABASE_URL`, `LASTBITE_TEST_SUPABASE_ANON_KEY`, `LASTBITE_TEST_SUPABASE_SERVICE_ROLE_KEY` from `supabase status -o env` output, and `scripts/run-backend-tests.sh` sourcing it then running `npx jest --runInBand __tests__/backend`. Both `set -euo pipefail`.
- [ ] **Step 2: Write `__tests__/backend/helpers.ts`** with the env-gated skip pattern. Client creation via `@supabase/supabase-js` `createClient(url, key, { auth: { persistSession: false } })`. `signInTestUser(email)` creates or signs in a confirmed user through the service admin API (`auth.admin.createUser({ email, password, email_confirm: true })` then anon client `signInWithPassword`), returns an authed client.
- [ ] **Step 3: Write failing integration test** `stores-roles.integration.test.ts` (gated): service role creates store and memberships for an owner, manager, staff user. Asserts member can select own store row and own membership, non-member cannot see the store, anon cannot select stores directly, `app_flags` row `marketplace_mode` readable by anon, anon cannot update `app_flags`, `fn_current_store_role` returns the right role per user.
- [ ] **Step 4: Write both migration files. Reset local stack:** `supabase db reset` (applies baseline then existing rpcs migration then A). Fix ordering errors until reset is clean.
- [ ] **Step 5: Run `npm run test:backend`, expect green.** Also confirm the suite self-skips cleanly when env vars are absent (`npx jest --runInBand __tests__/backend` in a shell without the env prints the not-run reason and exits 0).
- [ ] **Step 6: Full verification trio (frontend suites unaffected).**
- [ ] **Step 7: Commit** `feat(db): local backend harness, v1 baseline migration, stores, memberships, roles, app flags`

### Task 5: Migrations B (products, counts, adjustments, movements, balances, allocations)

**Files:**
- Create: `supabase/migrations/20260810110000_v2_inventory.sql`
- Create: `__tests__/backend/inventory.integration.test.ts`

**Interfaces produced:** tables `store_products`, `count_sessions`, `stock_adjustment_proposals`, `stock_movements`, `offer_allocations` (created here, used by Task 6), `audit_entries`, `outbox_events`, RPCs `record_inventory_count_v2(p_store_id, p_count_session_id, p_lines jsonb)` and `approve_stock_adjustment_v2(p_store_id, p_proposal_id, p_decision, p_idempotency_key, p_expected_version)`.

**Spec:**
- `store_products`: id, store_id fk, product_name, barcode nullable, category nullable, on_hand_quantity int not null default 0 check >= 0, confidence text check in high, medium, low default low, last_verified_at timestamptz nullable, expiry_date date nullable, version int not null default 1, created_at.
- `count_sessions`: id uuid pk (client supplied `countSessionId`), store_id, created_by uuid, created_at, unique pk gives idempotency (insert on conflict do nothing then return prior result set).
- `stock_adjustment_proposals`: id, store_id, store_product_id, current_quantity, proposed_quantity, delta, reason text default count, status check pending, approved, rejected, applied, created_by, created_by_role, count_session_id fk, version int default 1, created_at.
- `stock_movements`: id, store_id, store_product_id, delta int not null, kind text check in adjustment, reservation_hold, reservation_release, fulfillment, mismatch_correction, ref_id uuid nullable, created_at. Append only (no update or delete policies, plus a trigger raising exception on update or delete for belt and braces).
- `audit_entries`: id, store_id nullable, actor text not null, command text not null, detail jsonb, created_at. Append only same way.
- `outbox_events`: id bigserial, event_type text, payload jsonb, created_at, processed_at nullable.
- `record_inventory_count_v2`: security definer. Role check staff or above via `fn_current_store_role` else raise. Validates every line's product belongs to the store. Idempotent on `count_session_id` (second call returns the proposals created by the first). Updates counted products `last_verified_at = now()`, confidence high, bumps version. Creates pending proposals only where observed differs. Audit entry.
- `approve_stock_adjustment_v2`: manager or owner only (staff raises). Expected version mismatch raises with a `version_conflict` hint in the message. Approve: sets proposal applied, applies delta to product with movement row kind adjustment, product version bump. Reject: status rejected. Idempotency: an `idempotency_key` column on proposals decision, same key replays the stored outcome, terminal status with different key raises invalid state. Audit entry both ways.
- Confidence recompute rule (deterministic, matches the fake): high when `last_verified_at` within 72 hours, medium within 7 days, low otherwise. Implement as immutable SQL function `fn_stock_confidence(last_verified_at timestamptz)` evaluated in reads (the summary view in Task 7 uses it) while the column stores the last written value.
- RLS: members select own store rows on all inventory tables, no direct client writes on any of them (writes only through RPCs and service role).

- [ ] **Step 1: Write failing integration tests** (gated) covering: staff records count creating proposals and verifying idempotent replay, non-member forbidden, staff approval raises, manager approve applies delta plus movement plus version bump, reject path, stale expected version raises, movements are append only (update attempt errors), direct insert into `store_products` as authenticated member fails.
- [ ] **Step 2: Write migration B. `supabase db reset` until clean.**
- [ ] **Step 3: `npm run test:backend` green.**
- [ ] **Step 4: Full verification trio. Commit** `feat(db): v2 inventory ledger, counts, adjustments, movements, allocations scaffold`

### Task 6: Migrations C (offers, reservations, projection, reservation RPCs, outbox wiring)

**Files:**
- Create: `supabase/migrations/20260810120000_v2_offers_reservations.sql`
- Create: `__tests__/backend/offers-reservations.integration.test.ts`, `__tests__/backend/reservation-concurrency.integration.test.ts`

**Interfaces produced:** tables `offers_v2`, `reservations_v2`, view `marketplace_offers_v2_public`, RPCs `publish_offer_v2`, `pause_offer_v2`, `reserve_offer_v2_atomic`, `cancel_reservation_v2_atomic`, `get_buyer_reservations_v2`, `fulfill_reservation_v2`, `report_stock_mismatch_v2`, `list_seller_pickups_v2`.

**Spec:**
- `offers_v2`: id, store_id, store_product_id, title, category, image_url, contents jsonb, offer_price_uzs int, reference_price_uzs int nullable, quantity_total int, quantity_available int check >= 0, pickup_start timestamptz, pickup_end timestamptz check pickup_end > pickup_start, allergens jsonb, dietary_badges jsonb, pickup_instructions, cancellation_policy, status text check in live, paused, sold_out, expired, withdrawn, physically_set_aside boolean, last_verified_at timestamptz, version int default 1, publish_idempotency_key text unique, approved_by uuid, created_at.
- `reservations_v2`: id, offer_id fk, installation_id text not null, client_reservation_id text not null unique, status check in held, fulfilled, cancelled_by_buyer, cancelled_by_seller, expired_no_show, failed_stock_mismatch, pickup_code_hash text not null, pickup_code_hint text not null, hold_expires_at timestamptz, offer_snapshot jsonb not null, version int default 1, created_at, updated_at. Index on installation_id, on offer_id.
- `marketplace_offers_v2_public`: view over offers_v2 join stores exposing ONLY the `MarketplaceOfferV2` fields (id, version, store_id, store name and address and coordinates, title, category, image_url, contents, offer_price_uzs, reference_price_uzs, derived discount_percent, quantity_available, pickup_start, pickup_end, allergens, dietary_badges, pickup_instructions, cancellation_policy, last_verified_at, status) where status in live, sold_out and pickup_end > now(). Grant select to anon and authenticated. NO other v2 table or view is anon readable.
- `publish_offer_v2(p_store_id, p_input jsonb, p_idempotency_key)`: manager or owner. Validates allocation against the Task 5 rule (high confidence free quantity, or physically set aside), expiry (product expiry_date null or >= pickup_end date) else raises, reference price provenance (null allowed, if present must be >= offer price). Inserts offer live, decrements nothing from on_hand (allocation reserves offerable quantity via `offer_allocations` row), idempotent on key (replay returns existing offer). Outbox `offer_published`, audit.
- `reserve_offer_v2_atomic(p_offer_id, p_client_reservation_id, p_installation_id, p_expected_offer_version, p_pickup_code, p_pickup_code_hash, p_pickup_code_hint)`: security definer, callable by anon. Client generates the code, server stores ONLY hash and hint (the plaintext arg is used for nothing else and never persisted or logged, hash is sha256 hex computed client side AND recomputed server side with pgcrypto `encode(digest(p_pickup_code, 'sha256'), 'hex')`, mismatch raises). Flow: replay check on `client_reservation_id` unique (return stored row plus a `replayed` flag, raw code is NOT returnable on replay, return null code so the client relies on SecureStore), expected version check, conditional `update offers_v2 set quantity_available = quantity_available - 1, version = version + 1, status = case when quantity_available - 1 = 0 then 'sold_out' else status end where id = p_offer_id and status = 'live' and quantity_available > 0` returning row, insert reservation held with snapshot built from the public view row, hold_expires_at = pickup_end, movement kind reservation_hold, outbox `reservation_held`, audit. Raises map to sold_out, offer_not_live, version_conflict distinctly (use distinct SQLSTATE via `raise exception using errcode` P0001 with message prefixes the client maps).
- `cancel_reservation_v2_atomic(p_reservation_id, p_installation_id, p_idempotency_key)`: matching installation only. held to cancelled_by_buyer, release one unit (sold_out back to live, version bump), movement reservation_release, idempotent replay via an `idempotency_keys` table (key text pk, result jsonb, created_at) shared by mutation RPCs, terminal statuses raise invalid state. Outbox, audit.
- `get_buyer_reservations_v2(p_installation_id)`: returns reservations for the installation, hint only, snapshot included, never the hash.
- `fulfill_reservation_v2(p_store_id, p_pickup_code, p_idempotency_key)`: manager or owner of the store. Finds held reservation whose offer belongs to the store and whose `pickup_code_hash` matches the recomputed hash. Not found raises. Sets fulfilled, movement kind fulfillment decrementing `store_products.on_hand_quantity` by 1 exactly once (idempotent replay returns stored result without a second movement), outbox `reservation_fulfilled`, audit.
- `report_stock_mismatch_v2(p_store_id, p_offer_id, p_observed_quantity, p_reason, p_idempotency_key)`: manager or owner. Offer paused (version bump), all held reservations on it flip failed_stock_mismatch (no release), open exception row in a `store_exceptions` table (id, store_id, kind, message, status open or resolved, related_offer_id, related_store_product_id, created_at) created, outbox `offer_paused` and `reservation_failed_stock_mismatch`, audit. Idempotent by key.
- `pause_offer_v2(p_store_id, p_offer_id, p_idempotency_key, p_expected_version)`: manager or owner, live to paused, stale version raises version conflict, idempotent.
- `list_seller_pickups_v2(p_store_id)`: member of store. Reservations on store offers, hint only.
- A scheduled expiry is NOT built. Offers past pickup_end vanish from the public view by the where clause. Held reservations past hold_expires_at flip to expired_no_show lazily inside `get_buyer_reservations_v2` and `list_seller_pickups_v2` (update before select).

- [ ] **Step 1: Write failing integration tests** (gated) for every RPC behavior above, including: redaction (anon selects the public view, asserts exactly the public column set, asserts querying `offers_v2` or `reservations_v2` directly as anon errors), replay of reserve returns no raw code, staff cannot publish or fulfill, cross store fulfill rejected, mismatch fails held reservations and pauses offer, expired offer invisible in view.
- [ ] **Step 2: Write the concurrency test** in `reservation-concurrency.integration.test.ts` (gated): publish offer quantity 3, fire 25 `reserve_offer_v2_atomic` calls concurrently with distinct client ids via `Promise.allSettled`, assert exactly 3 held reservations, quantity 0, status sold_out, exactly 3 hold movements. Then fire the SAME client_reservation_id 10 times concurrently, assert one reservation row.
- [ ] **Step 3: Write migration C. `supabase db reset` until clean. Iterate to green backend suite.**
- [ ] **Step 4: Full verification trio. Commit** `feat(db): v2 offers, reservations, public projection, atomic reservation rpcs, outbox`

### Task 7: Supabase facade implementations, app wiring, flag source

**Files:**
- Create: `lib/api/supabase-buyer-api.ts`, `lib/api/supabase-seller-api.ts`, `lib/api/mappers.ts`, `lib/api/pickup-code.ts`, `lib/api/flag-source.ts`
- Modify: `app/_layout.tsx` (mount `FeatureFlagsProvider` and `ApiProvider` with the supabase implementations when a supabase client exists, otherwise the fake in demo mode)
- Test: `__tests__/api/mappers.test.ts`, `__tests__/api/pickup-code.test.ts`, `__tests__/backend/facade-conformance.integration.test.ts`

**Interfaces:**
- Consumes: facade interfaces (Task 1), RPCs and view (Tasks 4 to 6), conformance suites (Task 3), `FlagSourceV2` (Task 2).
- Produces: `makeSupabaseBuyerApi(client): BuyerMarketplaceApiV2`, `makeSupabaseSellerApi(client): SellerStoreApiV2`, `makeAppFlagSource(client): FlagSourceV2` (reads `app_flags` row `marketplace_mode`, any error resolves fail closed to demo), `generatePickupCode()` (6 chars from the unambiguous alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, entropy from `globalThis.crypto?.getRandomValues` when available with a `Math.random` fallback for older runtimes) plus `sha256Hex(text: string): string` implemented as a small pure TypeScript sha256 (no new dependency, verified in tests against the known vector `sha256Hex('abc') === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'`).
- Row mapping: snake case DB rows to the exact camelCase DTOs, RPC error message prefixes to `CommandErrorCode` (`sold_out:`, `offer_not_live:`, `version_conflict:`, `forbidden:`, `invalid_state:`, `not_found:`, `idempotency_conflict:`, anything else `unknown`, network failures `network_error`).

- [ ] **Step 1: Write failing mapper tests** with fixture rows for the public view, reservations, inventory summary, proposals, pickups, exceptions, asserting exact DTO output and that no extra keys leak (`Object.keys` equality), plus error mapping table tests.
- [ ] **Step 2: Write failing pickup-code tests**: 6 chars, allowed alphabet only, hint is last 2, sha256Hex of `LB2345` equals the known vector (compute it in the test with the same helper against a hardcoded hex string produced once during implementation, the point is stability).
- [ ] **Step 3: Implement mappers, code helper, facades, flag source.** Facades translate every thrown or returned error into `Result` (never throw). `reserveOfferV2` computes code client side, sends code plus hash plus hint, replay result with null code keeps the stored SecureStore value authoritative.
- [ ] **Step 4: Extend `facade-conformance.integration.test.ts`** (gated): run `runBuyerApiConformance` and `runSellerApiConformance` from Task 3 against harnesses backed by the real local stack (service client provisions the scenario mirroring `makeDefaultScenario`, per-test unique stores for isolation). Skips cleanly without env.
- [ ] **Step 5: Wire `app/_layout.tsx`** minimally (providers only, no visual change).
- [ ] **Step 6: Full verification trio plus `npm run test:backend` green. Commit** `feat(api): supabase v2 facade implementations, flag source, app provider wiring`

### Task 8: Buyer v2 path

**Requirements source:** `docs/beta/BUYER_AGENT_PROMPT.md` (read fully, it is the task spec, TDD sequences 1 to 6) plus `docs/beta/SHARED_CONTEXT.md` Product Boundaries and Buyer rules. Owned and forbidden paths as listed there. Consume only `useBuyerApi()`, `useFeatureFlags()`, contracts, and the fake for tests.

**Files:** per the prompt's owned paths (`app/(tabs)/**`, `app/offer/**`, `components/buyer/**` new, `lib/buyer/**` new including `lib/buyer/installation-id.ts` producing a persistent opaque uuid in AsyncStorage, `i18n/buyer.ts`, `__tests__/buyer/**`).

- [ ] Step 1: Read the buyer prompt and SHARED_CONTEXT. Inspect current `app/(tabs)/index.tsx`, `app/offer/[id].tsx`, `lib/marketplace-store.tsx`, `lib/reservation-*` modules to learn existing seams before writing tests.
- [ ] Step 2 to 7: Execute the prompt's TDD sequences 1 through 6 in order, each sequence is red test first, then implementation, then green, then a commit `feat(buyer): <sequence>`.
- [ ] Step 8: Full verification trio. Final commit for the task if anything remains.

### Task 9: Seller inventory to publication

**Requirements source:** `docs/beta/SELLER_AGENT_PROMPT.md` TDD sequences 1 to 4 plus SHARED_CONTEXT Seller rules. Owned and forbidden paths as listed there. Consume only `useSellerApi()`, flags, contracts, fake.

**Files:** per the prompt (`app/(seller-tabs)/**`, `app/auth/**` only if role gating requires, `components/seller/**` new, `lib/seller/**` new, `i18n/seller.ts`, `__tests__/seller/**`).

- [ ] Step 1: Read the seller prompt and SHARED_CONTEXT. Inspect current seller tabs, `lib/` seller hooks, auth provider for seams.
- [ ] Step 2 to 5: Execute TDD sequences 1 (role and navigation), 2 (inventory and confidence), 3 (count session), 4 (offer publication) in order, commit per sequence `feat(seller): <sequence>`.
- [ ] Step 6: Full verification trio.

### Task 10: Seller pickup, mismatch, seller end-to-end

**Requirements source:** `docs/beta/SELLER_AGENT_PROMPT.md` TDD sequences 5 to 7. Same ownership rules as Task 9.

- [ ] Step 1: Execute TDD sequence 5 (pickup), commit.
- [ ] Step 2: Execute TDD sequence 6 (stock mismatch), commit.
- [ ] Step 3: Execute TDD sequence 7 (seller end-to-end paths against the fake), commit `feat(seller): pickup, mismatch, e2e`.
- [ ] Step 4: Full verification trio.

### Task 11: Cross-product integration suite, pilot flag proof, verification matrix

**Files:**
- Create: `__tests__/integration/cross-product.test.ts` (fake-backed), `__tests__/integration/pilot-mode.test.ts`
- Create: `docs/beta/CONTRACT_HANDOFF_NOTES.md` (what the coordinator guarantees each surface, exact facade methods, error codes, flag semantics, gaps discovered)
- Test: the new suites plus the full matrix

- [ ] **Step 1: Write cross-product tests against one shared `InMemoryStoreCore`:** seller publishes, buyer lists and sees exactly the public shape, buyer reserves, seller pickup queue shows it, seller fulfills by code, buyer sees fulfilled. Second path: mismatch pauses offer and fails the buyer's held reservation with distinct copy state. Third path: buyer cancels, quantity restored, seller queue shows cancellation. Fourth: no seed offers appear anywhere in pilot mode (render the feed with flags pilot plus fake API and assert seed titles absent), demo mode shows seeds and no live offers.
- [ ] **Step 2: Run the full matrix:** `npm run test -- --runInBand`, `npm run typecheck`, `npm run lint`, `npm run test:backend` (local stack up). Record pass or fail per command.
- [ ] **Step 3: Write `docs/beta/CONTRACT_HANDOFF_NOTES.md`** (no em-dashes or semicolons).
- [ ] **Step 4: Commit** `feat(integration): cross-product suite, pilot mode proof, contract handoff notes`

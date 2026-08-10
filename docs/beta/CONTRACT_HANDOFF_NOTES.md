# Contract Handoff Notes

Date: 2026-08-10

This is the canonical contract document for the Buyer Marketplace surface, the Shop Seller surface, and the founder. It describes what the coordinator layer (`lib/contracts`, `lib/api`, `supabase/migrations`) guarantees today, where the in memory fake and the real Supabase backed facade are known to differ, and what stays true across a beta deploy. Read this before changing a facade method, a migration, or a screen that depends on either.

The fake (`lib/test-kit/in-memory-store-core.ts`) and the Supabase facades (`lib/api/supabase-buyer-api.ts`, `lib/api/supabase-seller-api.ts`) both implement the same two interfaces in `lib/api/buyer-api.ts` and `lib/api/seller-api.ts`. The shared conformance suites in `lib/test-kit/conformance/` run against both. Every rule below holds for both backends unless a divergence section says otherwise.

## Facade methods

### Buyer facade, five methods

| Method | Purpose |
| --- | --- |
| `listMarketplaceOffersV2()` | Every live offer with an open pickup window, the public feed |
| `getMarketplaceOfferV2(offerId)` | One offer, for the detail screen and for refreshing after a stale version |
| `reserveOfferV2(input)` | Atomic one unit hold, returns the reservation and the raw pickup code |
| `cancelReservationV2(input)` | Buyer initiated cancellation, releases the held unit |
| `getBuyerReservationsV2(installationId)` | Every reservation on file for one installation, the recovery path after a restart |

### Seller facade, eleven methods

| Method | Purpose |
| --- | --- |
| `getMyStoreMembershipsV2()` | Which stores the caller belongs to, and their role and store flags in each |
| `listStoreOffersV2(storeId)` | Every offer the store has ever published, in every status, newest first |
| `listStoreInventoryV2(storeId)` | The store's inventory summary with confidence, allocation, and offerable ceiling |
| `recordInventoryCountV2(input)` | Submits a physical count, creates pending adjustment proposals for anything that moved |
| `approveStockAdjustmentV2(input)` | Manager or owner decision on a pending proposal, approve applies the delta |
| `approveAndPublishOfferV2(input)` | Allocates inventory and publishes a live offer in one step |
| `pauseOfferV2(input)` | Takes a live offer off the public pool |
| `listSellerPickupsV2(storeId)` | Every reservation against the store's offers, the pickup queue |
| `fulfillReservationV2(input)` | Redeems a reservation by its pickup code |
| `reportStockMismatchV2(input)` | Pauses the offer and fails every currently held reservation against it |
| `listStoreOffersV2`, `listStoreInventoryV2`, `listStoreExceptionsV2` | The three read model RPCs, see below |

`listStoreOffersV2` was added to the interface mid plan by the coordinator (Task 9), after the seller review screen needed a way to find an offer's current id and version before it could pause it. It is one of the eleven, not an extra.

### The three read model RPCs

`listStoreOffersV2`, `listStoreInventoryV2`, and `listStoreExceptionsV2` are served by real RPCs (`list_store_offers_v2`, `list_store_inventory_v2`, `list_store_exceptions_v2`) defined in `supabase/migrations/20260810130000_v2_seller_read_models.sql`. This migration exists because none of the three had any backend path when the seller facade's interface was finalized. Any environment that has run only the earlier migrations needs this one before the seller screens work at all.

They are RPCs rather than plain table reads or views for three separate reasons.

- `store_exceptions` has row level security on and no policy at all, plus an explicit revoke for both `anon` and `authenticated`. A security definer function with its own membership check is the only way a member can read their own store's exceptions without opening the table to every authenticated user.
- The inventory summary is arithmetic over four tables, and its encumbrance sum has to match the ceiling `publish_offer_v2` enforces term for term. Keeping both expressions in the same migration file, next to each other, is what stops the summary from advertising units that a publish attempt would then refuse.
- A member reading a store they do not belong to has to hear `forbidden`. A plain select filtered by row level security would instead return an empty list, which reads as "this store has nothing" rather than "this is not your store". The facade contract requires the two to be distinguishable, so `list_store_offers_v2` raises an exception a non member rather than returning nothing.

All three are read only. None of them writes a row. `list_store_offers_v2` and `list_store_inventory_v2` both run the lazy expiry sweep before reading, the same one every other list RPC in the schema runs.

## Error codes and their meaning

`CommandErrorCode` (`lib/contracts/common.ts`) has eleven values.

| Code | Meaning |
| --- | --- |
| `not_found` | The referenced row does not exist, or exists but is not visible to this caller. A paused, expired, or withdrawn offer reads as `not_found` to a buyer, never as a status field, see the divergence section below for why the fake and the real backend disagree on when |
| `forbidden` | The caller is authenticated but not authorized, wrong store, wrong role, or no membership at all |
| `validation_failed` | The input itself is invalid, a malformed pickup window, a non positive price, a non integer quantity, an expiry that would not outlast the pickup window |
| `version_conflict` | The caller's expected aggregate version does not match the row's current version |
| `invalid_state` | The target row exists and the version matched, but its current status does not allow this command, fulfilling an expired hold, pausing a non live offer, cancelling an already terminal reservation |
| `idempotency_conflict` | The idempotency key was reused with a different fingerprint, a concurrent duplicate with the same key is still in flight past the wait bound, or a buyer reused a `clientReservationId` against a different offer |
| `sold_out` | The offer has no quantity left. Checked before the version conflict check on reserve, so the losing side of a race hears the true, actionable reason rather than being told to refresh an offer that has nothing left for them |
| `offer_not_live` | The offer exists but its status does not accept reservations |
| `allocation_exceeded` | The requested allocation quantity is above the `maxOfferableQuantity` ceiling for the product |
| `network_error` | A transport failure between the client and the backend |
| `unknown` | Anything else, including a bug the mapper could not classify |

## Result shape

Every facade method returns `Promise<Result<T>>`, never throws, and never rejects with a value the caller has to guess the shape of.

```
type Result<T> = { ok: true, value: T } | { ok: false, error: CommandError }
type CommandError = { code: CommandErrorCode, message: string, retryable: boolean, details?: Record<string, unknown> }
```

Both facades wrap every method body in a try block. A transport level throw, a malformed response, or an RPC exception all land in the same `err(code, message, details)` shape through `commandErrorFrom` in `lib/api/mappers.ts`.

## Retryable semantics

Only `network_error` and `unknown` are retryable. Every other code requires the caller to change something before trying again, a fixed input, a refreshed version, a new `clientReservationId` scoped to the right offer. Retrying an unchanged call against a non retryable error either replays the same rejection or, for an idempotent command with a matching fingerprint, replays the original success.

The Supabase facades derive `CommandErrorCode` from the text before the first colon in an RPC's raised exception message, for example `forbidden: role staff may not approve stock adjustments`. A prefix appearing later in the sentence is body text and is ignored. A malformed uuid literal (Postgres code `22P02`) maps to `not_found` rather than `unknown`, since an id the database cannot even parse names nothing that exists from the caller's point of view. A message matching a network failure pattern maps to `network_error` regardless of what the RPC itself would have said.

## Reservation contract

- `clientReservationId` is scoped per installation, not globally. `reservations_v2` carries a unique constraint on `(installation_id, client_reservation_id)`, and `buyer_idempotency_keys` is keyed the same way. One client id belongs to exactly one offer for the life of the installation that minted it. Reusing an id for a different offer is `idempotency_conflict`, so a client must mint a new id per offer, never merely per retry attempt.
- `pickupCode` on `ReserveOfferV2Result` is `string | null`. The raw code is issued exactly once, on the call that actually created the reservation. A replay of an already used `clientReservationId` carries `pickupCode` null. SecureStore holds the only durable copy of the raw code after that first response. The facade layer never touches SecureStore itself, that persistence is the buyer store's own responsibility and it is already built.
- The installation id is a bearer secret. It is a plain parameter on three RPCs (`reserve_offer_v2`, `cancel_reservation_v2`, `get_buyer_reservations_v2`) and must never be logged, placed in a URL, or included in an error report. Anyone holding a given installation id can read and cancel every reservation that installation owns.
- `offerSnapshot` on a reservation is captured immediately after the reserving decrement. Its `status` and `version` describe the offer at the moment of the hold, not the reservation itself. Never render `snapshot.status` or `snapshot.version` as reservation state, the reservation's own `status` and `version` fields are the only authoritative pair. The snapshot exists so a buyer keeps seeing the title, price, and window they agreed to even after the seller later edits or pauses the offer.
- `holdExpiresAt` always equals the offer's `pickupEnd`. A hold never outlives its offer's own pickup window, and there is no independent hold expiry clock anywhere in the beta.

## Idempotency

- Seller commands scope their idempotency key by store. `idempotency_keys` carries the primary key `(store_id, command, key)`. Buyer commands scope by installation instead, `buyer_idempotency_keys` carries the primary key `(installation_id, command, key)`. This is a coordinator ruling reached during Task 5 and Task 6 that superseded an earlier plan draft describing a single global key column. Two different commands, or the same command run for two different stores or two different installations, can never collide on a caller supplied key.
- Every idempotent RPC derives a fingerprint from the material content of its own input, not from the key. A second call reusing the same key with a different fingerprint raises `idempotency_conflict` with the message `key reused with different input`. This is what catches, for example, a seller editing a draft offer and resubmitting it under a key they never changed.
- The claim then fill in pattern. A caller first attempts to insert its idempotency row with a null outcome, `on conflict do nothing`. Winning that insert means this call performs the real work and fills the outcome column in once it finishes. Losing it means either the same key already carries a final outcome (its fingerprint is compared, and if it matches, the stored outcome is returned as this call's own answer) or a concurrent duplicate is still mid flight, in which case this call polls the outcome column every tenth of a second for up to five seconds before giving up.
- The four second claim bound. The initial claim insert runs under `set local lock_timeout = '4s'`. Without this bound, `on conflict do nothing` still blocks on a conflicting row inserted by a transaction that has not committed yet, with no timeout of its own, so a stalled rival could pin a caller indefinitely. A `lock_timeout` expiry (Postgres code `55P03`) is caught and re raised as `idempotency_conflict`, turning a stalled duplicate into a bounded wait and an honest error rather than a hung connection. Every idempotent RPC in the schema follows this same pattern, including the advisory lock `reserve_offer_v2` takes to serialize concurrent reservations on one offer.

## Inventory rules

- Confidence tiers. `fn_stock_confidence` returns `high` when `last_verified_at` is within the last 72 hours, `medium` within the last 7 days, and `low` otherwise or when never verified. `publish_offer_v2` and the inventory summary both gate on the product's stored `confidence` column, not a live recomputation. A product last verified two weeks ago whose stored confidence still reads `high` is advertised as offerable and will publish successfully. That is accepted current behavior, not a bug, `fn_stock_confidence` presently has no automatic consumer that recomputes and writes the stored value back.
- `maxOfferable` math, including mismatch encumbrance. For a high confidence product, `maxOfferable` equals `on_hand_quantity` minus every unit still encumbered by a non terminal offer on that product. Encumbered units are the sum of units still sitting in a live or sold out offer's `quantityAvailable`, units held by a reservation in `held` status, and units whose reservation failed a stock mismatch while the related exception is still open. For a below high confidence product, `maxOfferable` is zero unless the seller explicitly sets `physicallySetAside`, in which case the requested quantity itself becomes the ceiling, since the system has no other way to verify a physical set aside claim.
- Physical set aside. The no POS safe mode. A seller whose product confidence is below high can still publish by physically moving the offered quantity to a designated location and checking `physicallySetAside` on the allocation. Reservations then consume only that set aside allocation, never the rest of the shelf, and a daily closeout is expected to confirm the remaining quantity by hand.
- Expiry versus pickup window, the food safety rule. A product may back an offer only if its `expiry_date` is on or after the date its pickup window ends, not merely on or after today. The comparison is against `pickup_end`, never against `now()`, because a product must outlast the last moment a buyer could actually collect it, not merely the moment the offer was published. A violation is a hard `validation_failed` reject at publish time.
- Stale delta acceptance. `recordInventoryCountV2` always computes a proposal's `delta` against the product's `on_hand_quantity` at the moment of the count. If a proposal sits pending while some other approved adjustment changes `on_hand_quantity` underneath it, approving the stale proposal still applies the original delta, it never re validates against the current quantity. This is an accepted risk for the beta, confirmed by the Codex audit. The operational recovery is a fresh physical recount, not a code change.
- Allocation lifecycle. An `offer_allocations` row starts `active` the moment an offer publishes. It moves to `released` the instant its offer leaves the live or sold out pool for any reason at all, the expiry sweep, a pause, or a stock mismatch report. A released allocation no longer encumbers its product. Nothing besides publish creates or edits an allocation row, and nothing currently reads a released row for anything but audit history.

## Known divergences and dormant items

- Fake reserve version equality versus SQL monotonic tolerance. The in memory fake checks a caller's `expectedOfferVersion` against the offer's current version with plain equality. The real `reserve_offer_v2` RPC accepts a monotonic range instead, any version whose gap from current is fully explained by reservation driven bumps since the offer was last read, which is what stops a client that read version 3 from failing spuriously once the version has ticked forward purely from other buyers racing for the same offer. The fake conformance suite is silent on this distinction by design, the backend test suite (`__tests__/backend/reservation-concurrency.integration.test.ts` and `offers-reservations.integration.test.ts`) owns pinning that tolerance against the real stack.
- Mismatch outbox naming divergence. The fake's `reportStockMismatch` appends exactly one `offer_stock_mismatch` outbox event. The real `report_stock_mismatch_v2` RPC appends one `offer_paused` event plus one `reservation_failed_stock_mismatch` event per failed hold, so both the event name and the event count differ from the fake. Nothing in the app consumes the outbox today, which makes this cheap to reconcile, but a future outbox consumer written and tested only against the fake's shape will never fire correctly against the real backend.
- Expired offer read divergence. The fake's `getMarketplaceOfferV2` returns an expired offer with `status: "expired"`. The real `marketplace_offers_v2_public` view filters on `status in ('live', 'sold_out') and pickup_end > now()`, so a paused, expired, or withdrawn offer is invisible to `anon` by construction, and the real backend returns `not_found` in every one of those three cases instead of a status. A buyer surface reading `getMarketplaceOfferV2` must treat `not_found` as "this offer is gone", never as "this id was never valid". The copy on that path is an open concern, not yet specifically written for this case.
- Sweep writes no movement rows, dormant. The lazy expiry sweep (`fn_apply_offer_reservation_expiry_v2` on the real backend, `applyLazyExpiry` in the fake) releases allocation rows and flips reservation and offer status, but it writes no `stock_movements` row for either change. This makes the reservation concurrency tolerance's own bookkeeping stricter than it would need to be if a hold ever gained an expiry independent of its offer's `pickup_end`. Today this gap is provably unreachable, because `holdExpiresAt` always equals `pickupEnd` (see the Reservation contract section above), there is no separate hold clock that could ever drift out of sync with the sweep. A future change that gives holds their own independent expiry needs to revisit this and most likely add a movement row on release.
- Twelve conformance skips against the real stack. `__tests__/backend/facade-conformance.integration.test.ts` runs the exact same two shared conformance modules the fake runs, completely unmodified, against the live Supabase stack, and names twelve of their blocks as skipped with a reason recorded next to each. Ten need `setNow`, since a real Postgres connection's clock cannot be moved without either freezing it server side or rewriting stored timestamps underneath the very code under test, and the clock dependent expiry semantics those ten blocks would have covered are instead asserted directly against SQL in `offers-reservations.integration.test.ts` and `inventory.integration.test.ts`. The remaining two are the expired offer read divergence and the mismatch outbox naming divergence described above, real behavioral differences rather than clock limitations, and both are recorded as findings rather than silently skipped without explanation.
- Pause is one way in beta. `pauseOfferV2` moves a live offer to `paused`. Neither facade has an unpause or resume command. A paused offer can currently only be recovered by publishing an entirely new offer.
- Mismatch unrecordable after window close. `reportStockMismatchV2` requires the target offer not already be in a terminal status (`expired` or `withdrawn`). Once an offer's pickup window has closed and the lazy sweep has expired it, a mismatch can no longer be reported against it, even if the underlying physical discrepancy was real and only discovered late. This is an accepted beta limitation.
- No exception resolve command yet. Neither facade has a command that closes a `store_exceptions` row. A stock mismatch exception, once opened, stays open indefinitely as far as the system is concerned, which means every unit it encumbers (see the mismatch encumbrance rule above) stays allocated and out of the offerable pool until a resolve command exists. This gap was first identified during Task 3 and remains open through the end of this plan.
- The `idempotency_conflict` bridge in `reserveOfferV2` is facade only. The Supabase buyer facade compares the offer id on a replayed reservation row against the offer id the caller actually asked to reserve, and raises `idempotency_conflict` itself when they differ, because `reserve_offer_v2` replays purely on `(installation_id, client_reservation_id)` with no per offer check of its own inside the RPC. A caller that reached the RPC directly, bypassing the facade, would not receive this protection.
- The seller v2 beta surface has no flag gate of its own. Mounting `ApiProvider` activates every seller v2 beta screen in every build. There is no `marketplaceMode` style check on the seller side the way the buyer surface requires pilot before it will ever show live offers. If the seller beta is meant to stay dark independent of the buyer facing flag, that gate does not exist yet and would need to be added to `lib/seller/optional-context.ts`.

## Deploy notes for the founder

- Prod deploy is `supabase db push` after review, and it must never be run by an agent. Only a human founder or engineer, after personally reviewing the migration diff, should run this command against a real environment.
- Edited in place migration versions are local only safe. Several migration files in this plan were edited in place after their first draft rather than superseded by a new file, most notably to rename two RPCs away from a name containing the word `atomic` (see below). This is safe only because no environment, staging or production, has ever applied any of the v2 migrations yet. Once any real environment has run a given migration file, that file must never be edited again, only followed by a new one.
- The fingerprint NULL backfill concern applies only to a manual over apply. `idempotency_keys` gained its `fingerprint` column and a nullable `outcome` column partway through this plan, guarded by a backfill safe `alter table if exists ... add column if not exists`. A fresh `supabase db reset`, or the very first `supabase db push` to a real environment, creates the table with both already in place, so no backfill path ever actually runs there. The only way this concern becomes real is a manual, out of order re application of an old copy of the migration file against a database that already has the newer one, which the edited in place policy above is meant to prevent from ever being necessary.
- `EXPO_PUBLIC_LASTBITE_ALLOW_INSECURE_CODE_STORE` is a simulator only escape hatch, documented in `.env.example`. Setting it to `1` allows an unencrypted AsyncStorage fallback for pickup codes when SecureStore is unavailable, which is normal on an entitlement less simulator build. Never set it in a build that will reach a real device or a store listing, doing so removes the pickup code's only encryption at rest guarantee.
- The Supabase CLI (2.22.12 at the time of this plan) breaks on function names containing the word `atomic`. Its statement splitter treats such a name as the start of a `BEGIN ATOMIC` function body and glues every following statement in the file onto it, until the migration fails with a confusing multiple commands error partway through, far from the actual problem. Two RPCs were renamed during this plan for exactly this reason, landing on `reserve_offer_v2` and `cancel_reservation_v2`. Avoid the substring `atomic` in any function name added to this schema in the future.

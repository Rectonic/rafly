# LastBite Verified-Offer Beta Context

Date: 2026-08-10

## Purpose

LastBite exists to turn uncertain store reality into a small number of auditable, seller-approved, time-limited offers and to test whether stores can maintain them and buyers will reliably collect them.

Long-term purpose:

> Reduce food waste and recover seller value by connecting trustworthy store inventory decisions to nearby buyer demand.

The beta is narrower:

> Prove one reliable path from a store observation or import to a validated inventory state, a seller-approved public offer, an atomic reservation, a pickup outcome, and inventory reconciliation.

## Evidence Discipline

Use these labels in planning and review:

- **Evidence**: supported by current code, documents, or observed pilot data.
- **Assumption**: a reversible choice needed to run the beta.
- **Hypothesis**: must be tested in stores or with buyers.
- **Deferred**: intentionally postponed.
- **Expensive**: hard to reverse or operationally costly.

Current evidence is not market validation. The strongest store evidence comes from one ASR-derived conversation. Willingness to pay, staff maintenance, buyer demand, POS access, and field economics remain hypotheses.

## Pro-Model Verdict

GPT-5.5 Pro returned a conditional go with this recommendation:

> Build a service-led verified-offer beta as a modular monolith. Keep two bounded product surfaces and one shared backend. Reject microservices, a physical app split, generic POS integration, broad automation, cameras, and personalization until their gates pass.

The beta has two products but one deployment architecture:

- **Buyer Marketplace** for discovery, reservation, and pickup.
- **Seller Store App** for inventory evidence, approval, publication, and fulfillment.
- **Shared Store Core** for private inventory state, public offer projection, reservation invariants, auditing, and telemetry.
- **Operator/Admin** for onboarding, import review, exceptions, pilot flags, and store reliability.

One Expo binary and one Supabase/Postgres backend are recommended for 90 days. Source boundaries must make a later physical app or service split possible.

## Product Promises

Seller promise:

> LastBite helps your team identify and sell at-risk goods without replacing your POS. Nothing changes stock, price, supplier orders, or public availability until an authorized person approves it.

Buyer promise:

> LastBite shows nearby discounted food that the seller has specifically approved for pickup, with a clear price, pickup window, availability state, and recoverable pickup code.

Do not promise complete store inventory knowledge or guaranteed availability before measured fulfillment supports those claims.

## Architecture Decision

### Selected

Use a modular monolith with:

- one repository
- one Expo application binary
- separate Buyer and Seller route and module boundaries
- one Supabase/Postgres deployment
- coordinator-owned contracts and API facades
- additive v2 migrations
- RPCs for invariant-heavy writes
- a transactional outbox table instead of a message broker
- feature flags that fail closed
- contract, integration, and end-to-end tests

### Not Selected

Two physical apps are deferred until separate release cadence, device distribution, permission, or team ownership needs are demonstrated.

Microservices are rejected for the beta. They add distributed transactions, retries, versioning, observability, deployment, and local-test complexity without a measured load or team benefit.

### Extraction Rule

Modules may later become services only when at least one trigger is measured:

- independent scaling need
- independent release ownership
- materially different reliability requirement
- security or compliance isolation
- repeated deployment contention
- a stable contract used by more than one client

## Product Boundaries

### Buyer Marketplace Owns

- public offer discovery
- search, filters, map, and offer detail
- local favorites
- reservation and buyer cancellation UX
- pickup-code recovery
- local reminders
- visible trust, failure, and pickup states

It must not receive private stock, supplier cost, confidence internals, imports, corrections, or seller analytics.

### Seller Store App Owns

- private inventory summary
- count sessions
- adjustment review
- expiry and exception tasks
- offer quantity, price, window, and publication approval
- offer pause
- pickup queue
- fulfillment and stock-mismatch reporting

It must not own shared tables, migrations, buyer identity policy, public-feed implementation, or regulated POS writes.

### Shared Store Core Owns

- store membership and roles
- catalog identity and aliases
- import lineage
- inventory observations
- append-only stock movements
- inventory balances and confidence
- batches and expiry evidence
- offerable inventory allocations
- offer and reservation state machines
- idempotency and concurrency
- audit log and outbox
- public marketplace read model
- pilot flags and telemetry

### Operator/Admin Owns

- store onboarding
- CSV mapping and staged-record review
- exception assistance
- pilot flags
- audit and reliability review
- KPI export

Operator actions cannot silently change stock or publish offers without explicit delegated authority and audit.

## Beta Scope

### Days 0-7 Field Gate

- Audit five stores in one compact area.
- Confirm the core pain independently in at least three stores.
- Obtain one signed pilot and a material deposit.
- Time a 100-SKU census. Provisional maximum is five staff-hours.
- Collect at least ten representative invoices.
- Attempt a real export in every POS-equipped store.
- Classify the first store as API, CSV, unreliable POS, or no POS.
- Agree excluded product categories.

Failure to obtain payment or general pain evidence stops seller automation beyond reliability foundations.

### 30-Day Product Scope

One live Shop Seller pilot, with a second store only after the first is stable.

Seller capabilities:

- owner, manager, staff, and operator roles
- canonical CSV import
- manual product entry with optional barcode and optional expiry
- physical count session
- human-approved stock adjustment
- minimal manual receiving
- stock confidence and last verified time
- exception queue
- batch and expiry data for selected categories
- inventory-backed offer draft and explicit approval
- offer pause or withdrawal
- pickup fulfillment and stock-mismatch reporting

Buyer capabilities:

- live v2 offers only in pilot mode
- existing search, filter, map, detail, favorites, and localization
- atomic one-unit reservation
- secure pickup-code recovery
- buyer cancellation
- fulfilled, seller-cancelled, expired, and stock-mismatch states
- full pickup timestamps

Operator capabilities:

- staged import review
- store reliability and staleness review
- feature flags
- audit log
- KPI export

### 90-Day Conditional Scope

- three to five stores
- one proven canonical CSV path
- one POS-specific adapter only after the same POS or format repeats in at least three stores
- invoice OCR only as a reviewed draft and only after a timed speed test passes
- expiry watchlist and deterministic markdown suggestions
- deterministic reorder drafts only where sales and stock confidence are adequate
- at least 50 terminal reservation outcomes before marketplace expansion

## Explicit Exclusions

- full POS replacement
- payments, refunds, commissions, and payouts
- fiscal receipts and regulated-system writes
- generic all-POS framework
- autonomous ordering
- AI demand forecasting
- autonomous dynamic pricing
- full-store inventory claims for no-POS stores
- camera-based stock truth
- facial recognition or CCTV identity linkage
- personalized targeting in the first beta
- broad seller analytics before base data is trustworthy
- expansion of Restaurant Seller functionality

## Safe Inventory Modes

### POS or CSV Store

An import creates staged records. Raw source data is retained. Matching uses source ID, barcode, and approved aliases. Ambiguous matches remain unresolved. Approved imports create observations or append-only movements. POS data is evidence, not unquestioned truth.

### No-POS Store

No-POS mode is verified-offer mode, not a full inventory system. The seller physically sets aside the offered quantity in a designated location. Reservations consume only that allocation. Daily closeout confirms the remaining quantity. Any discrepancy pauses the offer.

## Source-of-Truth Rules

- Catalog identity is human approved. Raw external names and aliases remain traceable.
- Barcode is optional and can be ambiguous.
- POS sales become trusted only after completeness is demonstrated.
- Stock balance is derived from approved movements after a trusted observation.
- Physical count is strongest at its timestamp, then confidence decays based on missing movements.
- OCR creates a draft, never inventory truth.
- Expiry-sensitive publication requires validated date and quantity.
- The store owns normal sale price. A manager approves the LastBite offer price.
- Discount percentage requires a recent, supported reference price.
- Store Core owns offer state after explicit seller approval and allocation.
- Reservation state is server-owned.
- Actual payment and fiscal purchase remain in the existing POS.
- Camera output is an observation or count-task input only.
- Supplier orders remain drafts until the owner and supplier confirm them.

## Core Domain

Minimum private entities:

- `Store`
- `StoreMembership`
- `CatalogItem`
- `StoreProduct`
- `ImportBatch`
- `StagedSourceRecord`
- `InventoryObservation`
- `StockAdjustmentProposal`
- `StockMovement`
- `InventoryBalance`
- `InventoryBatch`
- `Exception`
- `OfferableInventoryAllocation`
- `AuditEntry`
- `OutboxEvent`

Marketplace entities:

- `Offer`
- `Reservation`
- `PickupOrder` or seller pickup read model
- public `MarketplaceOfferV2` projection

## Required State Machines

Offer:

`draft -> approved -> live -> paused | sold_out | expired | withdrawn`

Reservation:

`held -> fulfilled | cancelled_by_buyer | cancelled_by_seller | expired_no_show | failed_stock_mismatch`

Import:

`uploaded -> parsed -> needs_review -> approved -> applied | rejected`

Count:

`open -> submitted -> adjustment_proposed -> approved | rejected -> applied`

No terminal state may transition back to an active state without an explicit new command and validation.

## Coordinator-Owned API Facades

Buyer facade:

- `listMarketplaceOffersV2`
- `getMarketplaceOfferV2`
- `reserveOfferV2`
- `cancelReservationV2`
- `getBuyerReservationsV2`

Seller facade:

- `listStoreInventoryV2`
- `recordInventoryCountV2`
- `approveStockAdjustmentV2`
- `approveAndPublishOfferV2`
- `pauseOfferV2`
- `listSellerPickupsV2`
- `fulfillReservationV2`
- `reportStockMismatchV2`
- `listStoreExceptionsV2`

All commands that can be retried require an idempotency key. Mutation inputs include expected aggregate version where stale writes are possible.

## Public Offer Contract

`MarketplaceOfferV2` may contain:

- offer ID and version
- seller public identity and location
- title, category, image, and public contents
- offer price
- supported reference price and discount when provenance exists
- public quantity available
- pickup start, pickup end, and `Asia/Tashkent` timezone
- allergens, dietary badges, pickup instructions, and cancellation policy
- last verified timestamp

It must not contain:

- private on-hand stock
- stock-confidence internals
- supplier or purchase cost
- staff identity
- private exception data

## Reservation Contract

Reservation requests use:

- offer ID
- quantity fixed to one for the beta
- client reservation ID
- opaque buyer installation ID
- expected offer version

The server returns:

- reservation ID and version
- held status
- pickup code and safe hint
- pickup timestamps and hold expiry
- immutable public offer snapshot

The raw pickup code is stored in SecureStore and never in ordinary logs or metadata.

## Roles

- Staff may record counts and receiving drafts.
- Manager may approve adjustments, publish or pause offers, and handle pickups.
- Owner may perform manager actions and approve future reorder or price policy.
- Operator may assist only through explicit delegated permissions.
- Every sensitive action records actor, store, command, time, and result.

## Hard Technical Invariants

- Every live Shop Offer has seller approval and a valid allocation.
- Every allocated unit is high confidence or explicitly physically set aside.
- Public reads expose no private stock, cost, supplier, staff, or exception data.
- Pilot mode shows no seed offers.
- Concurrency tests permit no over-reservation.
- Stock corrections and offer publication are audited. Price approval is not audited separately in the beta, an offer's price is approved by the act of publishing it and is audited as that publication.
- No fiscal or marked-goods write exists.
- Expired offers are neither visible nor revived.
- Retried commands are idempotent.
- Pickup windows use full timestamps.
- A stock mismatch pauses the affected offer.

## TDD Delivery Rules

For every vertical slice:

1. Write a failing domain or contract test.
2. Add the smallest implementation to pass it.
3. Add integration coverage for persistence and authorization.
4. Add component coverage for loading, empty, error, retry, disabled, and stale states.
5. Add one end-to-end path when the slice crosses product or backend boundaries.
6. Run focused tests, then typecheck, lint, and the full suite.

Required test classes:

- pure domain state and invariant tests
- public DTO redaction tests
- API contract and fake conformance tests
- SQL migration, RLS, and RPC tests
- idempotency and concurrency tests
- CSV golden-file adapter tests
- Buyer and Seller component tests
- cross-product reservation and fulfillment tests
- pilot-mode feature-flag tests

Do not mock the behavior under test. Fakes must implement the coordinator-owned facade contract.

## Primary Beta Metrics

Seller-reliable fulfillment:

`fulfilled / (fulfilled + cancelled_by_seller + failed_stock_mismatch)`

Unassisted verified-inventory days:

Operating days where live allocations remain valid and required tasks finish without operator intervention, divided by eligible operating days.

Paid repeatable store activation:

A store has an approved inventory base, publishes a live verified offer, completes one fulfilled pickup, and pays or remains under a meaningful pilot agreement.

Also measure:

- field hours per store
- time to first live offer
- staff task compliance
- offer traceability
- import conflict rate
- stock mismatch rate
- receiving lag
- offer-detail conversion
- buyer pickup completion
- no-show rate
- direct recovered value
- paid renewal

Do not report avoided waste or avoided stockout revenue as facts without a valid counterfactual.

## Provisional Gates

Day 30:

- one store live for seven days
- six of seven daily closeouts completed
- at least ten terminal reservation attempts
- seller-reliable fulfillment at least 90 percent
- stock mismatch no more than 10 percent
- one real offer approved and one exception reviewed
- field cost covered or explicitly treated as subsidized research

Day 60:

- two to three stores live
- two stores complete at least 12 of 14 unassisted days
- at least 20 terminal reservations
- controlled buyer cohort generates at least ten reservations and eight pickups

Day 90:

- three to five stores engaged
- at least two paying or renewing
- at least 50 terminal reservations
- seller-reliable fulfillment at least 90 percent
- stock mismatch below 10 percent per store, with a target below 5 percent
- store three onboarded by a non-founder with no more than half the founder hours used for store one
- a POS adapter exists only if one path repeats in three stores

These thresholds are hypotheses. Record the underlying counts and review them rather than treating the percentages as universal benchmarks.

## Ranked Experiments

Run first:

1. Paid pilot commitment.
2. Five-store pain and workflow audit.
3. Timed 100-SKU census.
4. Real POS or CSV export attempt.
5. Seven-day physical set-aside verified-offer loop.
6. Staff daily closeout compliance.
7. Controlled buyer reservation and pickup funnel.
8. Inventory-to-offer mismatch measurement.

Conditional experiments:

- invoice OCR against manual entry time and correction rate
- deterministic expiry markdown suggestions
- deterministic reorder drafts where data quality passes
- buyer phone or account requirement only after abuse or recovery evidence
- one POS adapter after three repeated stores

Later experiments:

- shelf-gap detection
- anonymous traffic-zone analytics
- first-party personalization
- model-assisted pricing

Cameras, autonomous ordering, and microservices have no beta authorization.

## Parallel Ownership

Coordinator owns:

- `supabase/**`
- `lib/contracts/**`
- `lib/api/**`
- `lib/domain/**`
- `lib/feature-flags/**`
- generated types
- shared app shell and configuration
- shared test kit
- integration and concurrency tests

Buyer agent owns only Buyer routes, Buyer components, Buyer storage and stores, Buyer strings, and Buyer tests.

Seller agent owns only Seller auth and routes, Seller components, Seller stores, Seller strings, and Seller tests.

Product agents may not create duplicate DTOs or call Supabase directly. A missing shared field or operation is a coordinator request, not permission to cross the boundary.

## First Ten Delivery Tickets

1. Architecture boundaries, shared contract package, feature flags, fakes, and ownership CI.
2. Store, membership, role, and pilot-flag foundation.
3. Catalog identity, count session, stock ledger, balance, and confidence.
4. Offerable inventory backend and redacted public offer projection.
5. Seller offer publication UI.
6. Buyer live-feed migration with strict demo separation.
7. Reservation v2 with idempotency, concurrency, and secure recovery.
8. Seller pickup fulfillment and stock-mismatch flow.
9. Canonical CSV staging and reconciliation.
10. Pilot telemetry and gate report.

Tickets 1 through 4 are coordinator prerequisites. Tickets 5 and 6 may run in parallel. Live buyer exposure waits for ticket 5 and the cross-product integration suite.

## Provisional Founder Decisions

The package assumes:

- Shop Seller packaged goods are the beta focus.
- Existing Restaurant Seller behavior is frozen.
- One Expo binary is used for 90 days.
- No-POS stores physically set aside offer quantity.
- Staff records and manager or owner approves.
- Buyer account and phone are deferred.
- English and Russian remain the UI languages while Uzbek text and aliases are stored correctly.
- High-risk regulated categories are excluded pending local review.

Change these assumptions only through a coordinator decision because each affects contracts, workflow, or pilot measurement.

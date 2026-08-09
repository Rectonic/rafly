# LastBite Middleware Research Navigation

Date: 2026-07-07

This file turns the current product dilemma into a structured research brief. Use it to guide a research model, human interviews, store visits, and the next product decision.

## 1. The Founder Dilemma

LastBite wants to reduce food waste by letting buyers discover and reserve discounted near-expiry or surplus products from sellers.

The problem: buyer-facing availability is only trustworthy if seller stock data is trustworthy.

Mini-markets and small shops often have messy inventory reality:

- no POS, weak POS, or POS used inconsistently;
- notebook/manual stock tracking;
- incomplete product catalog;
- missing barcodes, suppliers, costs, quantities, and expiry dates;
- supplier ordering by phone/Telegram/agent visits;
- unclear markirovka/Soliq/Asl Belgisi workflows;
- expired/damaged goods not systematically tracked;
- little analytics for owners.

Therefore the real product question is:

> Should LastBite start by building a seller-side stock and data-control layer between shops/POS systems and the buyer marketplace?

This layer would:

- work even if the seller has no reliable POS;
- integrate with POS systems where possible;
- normalize product and stock data;
- alert sellers about low stock and expiry;
- help sellers publish verified LastBite offers;
- expose only seller-approved, reliable products/offers to buyers;
- give sellers analytics and reporting.

## 2. Recommended Framing

Do not call the first version "middleware" externally.

Better product name:

> LastBite Store Control Layer

Customer-facing promise:

> We make your shop inventory, expiry, ordering, and LastBite offers controllable without replacing your POS.

Internal architecture framing:

> A seller inventory truth layer that starts manual/no-POS, then adds CSV/POS sync, then exposes verified offerable inventory to the buyer app.

## 3. Oracle GPT-5.5 Pro Verdict

Oracle agreed with the thesis but warned against overbuilding an integration platform too early.

Key Oracle conclusion:

> Middleware is the right end-state only if the first product proves that stores will pay for cleaner operating data and actually maintain it.

Oracle's recommended sequence:

> Store systematization service -> internal seller inventory console -> CSV/no-POS sync -> one POS adapter -> verified buyer offers -> broader marketplace.

Full Oracle memo:

- `LASTBITE_MIDDLEWARE_ORACLE_MEMO.md`

## 4. Product Boundary Definitions

### POS Replacement

Owns:

- checkout;
- fiscal receipts;
- cashier shifts;
- scanner/scales;
- payment/fiscal flows;
- sales ledger;
- marked-goods sale flow;
- offline reliability.

Decision:

- Do not build first.
- Consider only after 10-20 pilots prove existing POS systems cannot support the workflow and stores explicitly want replacement.

### POS Integration Layer

Owns:

- catalog import;
- sales import;
- stock import;
- safe export of cleaned product data;
- sync logs;
- conflict detection.

Decision:

- Not first as a generic platform.
- Start with CSV/manual mode, then one adapter for the most common POS found in pilots.

### Seller Inventory Console

Owns:

- SKU master;
- stock confidence;
- expiry/batch data;
- invoice OCR review;
- reorder suggestions;
- exception queue;
- owner dashboard.

Decision:

- Build first as internal/operator tooling.
- Expose to sellers only after the workflow works manually.

### Store Systematization Service

Owns:

- field audit;
- SKU cleanup;
- POS/catalog setup;
- staff SOP;
- supplier map;
- dashboard setup.

Decision:

- First commercial wedge.
- This is how we learn the real store workflows.

### Buyer Marketplace

Owns:

- discovery;
- reservation;
- pickup code;
- buyer trust;
- seller offer display.

Decision:

- Keep alive, but downstream.
- The buyer app should consume verified seller-approved offers, not raw stock.

### Supplier / Reorder / Expiry Workflows

Owns:

- supplier CRM;
- reorder drafts;
- return policies;
- expiry watchlist;
- markdown/remove/return tasks.

Decision:

- Build narrowly because these may create seller value before buyer liquidity exists.

## 5. Recommended Product Architecture

### Layer 1: Existing Store Reality

Inputs:

- POS/cash register if present;
- fiscal module;
- barcode scanner;
- scales;
- Excel/CSV exports;
- supplier invoices;
- Telegram/phone ordering;
- notebooks/manual memory;
- Asl Belgisi/E-Factura workflows.

Principle:

- Do not assume the store has clean data.

### Layer 2: LastBite Store Core

Normalized data layer:

- SKU master;
- barcode/GTIN;
- Uzbek/Russian product aliases;
- brand/category/unit/pack size;
- cost/sale price;
- supplier;
- current stock;
- stock confidence;
- expiry/batch table;
- invoice/receiving table;
- sales mirror when available;
- supplier CRM;
- exception queue.

Principle:

- This is the first real product asset.

### Layer 3: Operator / Seller Console

Workflows:

- scan/count;
- invoice OCR validation;
- SKU cleanup;
- duplicate/missing-data detection;
- expiry watchlist;
- reorder draft;
- supplier CRM;
- owner dashboard;
- Telegram/WhatsApp daily summary.

Principle:

- Start internal/operator-facing, then seller-facing.

### Layer 4: Buyer-Facing LastBite App

Only show:

- seller-approved offers;
- verified offerable quantity;
- pickup window;
- discount;
- expiry/use-by context where appropriate;
- seller instructions;
- reservation hold;
- pickup code.

Principle:

- Do not expose raw inventory to buyers.

## 6. Sync Modes

### Mode A: No Reliable POS

Store type:

- notebook/manual stores.

Source of truth:

- LastBite Store Core after field count plus receiving updates.

Workflow:

- mobile scan/count;
- invoice intake;
- manual sales adjustment;
- expiry tasks;
- seller-approved offers.

### Mode B: POS With CSV/Excel

Store type:

- early POS stores with export/import but no real API.

Source of truth:

- POS for sales;
- LastBite for cleaned catalog, expiry, supplier/reorder tasks, offerable inventory.

Workflow:

- scheduled export/import;
- reconciliation;
- exception queue.

### Mode C: POS With API / Partner Integration

Store type:

- later stores using repeated POS systems.

Source of truth:

- POS for sales/fiscal state;
- LastBite Store Core for normalized surplus/expiry/reorder layer.

Workflow:

- adapter;
- sync logs;
- reservation holds;
- controlled writes.

## 7. Delivery Sequence

### 0-30 Days: Store Control Pilot Kit

Goal:

- prove the store data pain and seller willingness to pay.

Build/use:

- store intake form;
- SKU cleanup sheet/database;
- invoice OCR extraction and validation;
- supplier CRM;
- expiry watchlist;
- rules-based reorder draft;
- owner dashboard;
- daily/weekly Telegram or WhatsApp summary.

Pilot scope:

- 3-5 store visits;
- 1 full pilot store;
- top 100-300 SKUs;
- 10-30 invoices;
- 30-50 reorder SKUs;
- 30-50 expiry-sensitive SKUs;
- top 10 suppliers.

30-day success gate:

- 3 of 5 stores confirm similar pain;
- 1 store pays or gives serious commitment;
- 100-300 SKU cleanup is predictable;
- OCR plus validation is faster than manual entry;
- POS export/import or no-POS workaround is feasible;
- owner uses dashboard or reorder/expiry output.

### 31-60 Days: Seller Inventory Console v0.1

Goal:

- turn repeated pilot workflow into software.

Scope:

- 2-3 active pilot stores;
- no-POS mode;
- CSV/Excel bridge;
- SKU master;
- invoice validation screen;
- expiry workflow;
- reorder draft by supplier;
- supplier CRM;
- dashboard;
- manual buyer-offer publishing from verified inventory.

60-day success gate:

- sellers use console weekly;
- at least 2 stores maintain receiving/stock updates for 2 weeks;
- at least 1 POS/CSV path works end-to-end;
- system catches real issues;
- buyers can reserve verified offers with low cancellation due to wrong stock.

### 61-90 Days: Store Data Layer + First POS Adapter

Goal:

- make "middleware" real only after proof.

Scope:

- 5-10 stores;
- one POS adapter or repeatable CSV bridge;
- sync logs;
- stock confidence score;
- offerable inventory table;
- reservation hold/release;
- seller-approved offer publishing;
- paid support package.

90-day success gate:

- one POS path repeats across stores;
- seller data stays clean after sprint;
- stores pay recurring support;
- buyer offers fulfill reliably;
- field operators can run sprint from SOPs.

## 8. Exact Research Prompt For A Model

Copy this into the research model when you want an independent answer:

```text
We are researching the product direction for LastBite in Uzbekistan/Tashkent.

LastBite's original goal is to reduce food waste by letting buyers discover and reserve discounted near-expiry or surplus products from sellers. The current app already has buyer discovery, reservations, pickup codes, and seller inventory/offer surfaces, but seller inventory is not deeply connected to real store stock.

New dilemma:
Buyer-visible stock and offers will not be trustworthy unless mini-market seller stock data is organized properly. Many shops may have no POS, weak POS, inconsistent POS usage, notebook/manual tracking, incomplete catalogs, markirovka/Soliq/Asl Belgisi complexity, manual supplier ordering, expiry losses, and poor analytics.

We are considering a LastBite Store Control Layer: a seller-side stock/data middleware that works with no POS at first, later integrates with POS systems, syncs stock/offerable inventory to LastBite, alerts sellers about low stock and expiry, provides seller analytics, and exposes only seller-approved reliable offers to buyers.

Please evaluate:
1. Is this the right product direction, or should LastBite stay buyer-marketplace-first?
2. Should the first product be POS replacement, POS integration layer, seller inventory console, store-systematization service, or buyer marketplace?
3. What is the best 30/60/90-day delivery sequence?
4. What data model and workflows are needed for SKU master, stock confidence, expiry, invoice intake, reorder drafts, supplier CRM, and buyer-visible offerable inventory?
5. What research questions must be answered through store visits?
6. What evidence would prove or disprove this middleware thesis?
7. What should the founder do first next week?

Constraints:
- Be skeptical.
- Do not recommend full POS replacement first unless unavoidable.
- Assume Uzbek stores may use REGOS, EasyTrade, E-POS, Optimo, ERA, MoySklad, YesPOS, another POS, or no reliable POS.
- Assume clean stock data is a prerequisite for buyer trust.
- Recommend a path that can start manually but later support POS integrations.
```

## 9. Research Question Bank

### Store Data Reality

1. How many SKUs does the store carry?
2. How many SKUs sell weekly?
3. What percent have readable barcodes?
4. What percent require Data Matrix / Asl Belgisi handling?
5. What products are missing cost, sale price, supplier, barcode, category, or expiry?
6. Does the store have a SKU master today?
7. Where is product data kept: POS, Excel, notebook, memory?
8. How often is inventory counted?
9. Who counts it?
10. Are cashiers scanning every sale?
11. How often are products sold manually/free-entry?
12. How much inventory value is tied up?
13. How much product is written off/discounted monthly?

### POS Landscape

1. Which POS is used?
2. What version and hardware?
3. Does it support scanners/scales/fiscal receipt?
4. Can it export catalog?
5. Can it export stock?
6. Can it export sales?
7. Can it import cleaned product data?
8. Is there an API?
9. Who controls access: owner or POS vendor?
10. Does it handle Asl Belgisi/marked goods?
11. What POS reports does the owner actually use?
12. What failed during POS onboarding?

### Seller Workflow

1. Walk through yesterday's receiving process.
2. Walk through yesterday's ordering process.
3. Walk through yesterday's closing/reconciliation process.
4. Who decides what to order?
5. How are suppliers contacted?
6. What happens when a product arrives but is missing from POS?
7. What happens when barcode scan fails?
8. Who changes prices?
9. Which products must never run out?
10. Which products often overstock?
11. Who checks expiry?
12. What manual task does the owner hate most?

### Buyer Value

1. Would buyers reserve discounted packaged grocery from mini-markets?
2. Which categories are acceptable for LastBite offers?
3. What categories are unsafe or reputation-risky?
4. What discount is necessary?
5. Is near-expiry a trust problem or savings benefit?
6. How far will buyers travel?
7. Do buyers prefer exact products or surprise bags?
8. What information must the buyer see?
9. What stockout/cancellation rate kills trust?
10. Is pickup from mini-markets socially comfortable?

### Stock Sync

1. What should be source of truth: POS, LastBite count, invoice receiving, or owner approval?
2. How often must stock sync?
3. Can POS reserve stock for LastBite?
4. If not, can seller approve a separate offerable quantity?
5. What fields are safe to write back to POS?
6. What fields should be read-only?
7. How should conflicts be resolved?
8. What stock error rate is acceptable?
9. Who is responsible when reserved stock is unavailable?
10. How often should reconciliation happen?

### Expiry Workflow

1. Which categories create most expiry losses?
2. Are expiry dates easy to capture?
3. Who checks expiry dates?
4. How early should alerts fire?
5. Do suppliers accept returns?
6. Which suppliers refuse returns?
7. Should the task be markdown, return, remove, bundle, or LastBite offer?
8. Can staff maintain expiry weekly?
9. What is monthly value at risk?
10. What legal/food-safety boundaries apply?

### Integration Feasibility

1. Can we get sample exports from each POS?
2. Are exports consistent across stores?
3. Are product IDs stable?
4. Are barcodes stored cleanly?
5. Can we import 20 cleaned SKUs safely?
6. Is there an API sandbox?
7. Are credentials available?
8. Does POS work offline?
9. How does offline sync happen?
10. Would POS vendor partner with us?

### Business Model

1. Would the owner pay for a 7-10 day cleanup sprint?
2. What setup price is acceptable?
3. What monthly support price is acceptable?
4. What result makes this "paid for itself"?
5. Is inventory cleanup, expiry reduction, reorder support, or supplier monetization most valuable?
6. Would seller pay for buyer demand through LastBite?
7. Would suppliers pay for structured orders or visibility?
8. Would POS vendors pay/referral-partner?
9. Who signs the purchase decision?
10. Which pricing model fits best: setup, subscription, audit, success fee, or hybrid?

## 10. Hypotheses To Test

| Hypothesis | Proving Evidence | Disproving Evidence |
|---|---|---|
| Stores have real stock-data pain | 3 of 5 stores show missing catalog, untrusted stock, manual ordering, expiry losses | Stores already trust POS and only need light training |
| No-POS/manual mode creates value | Store benefits from scan/count + invoice review + dashboard before integration | Outputs decay immediately without POS integration |
| POS integration is feasible | One common POS gives usable export/import/API across stores | Every store/POS is custom or vendor-blocked |
| Sellers will pay | One store pays or commits after seeing before/after | Owners like the idea but refuse to pay |
| Staff can maintain data | Receiving/expiry/scanning routines last 2+ weeks | Staff bypasses scanning and ignores updates |
| Buyer trust can be protected | Verified offers are fulfilled with low stock mismatch | Buyer reservations fail due to stock inaccuracies |
| Expiry/reorder creates ROI | Watchlist finds at-risk value; reorder drafts reduce stockouts | Expiry value is small or tracking labor is too high |
| Service can scale | Second/third pilot needs less founder involvement | Every pilot requires custom founder intervention |

## 11. How To "Prophesy" The Direction

Treat "prophesy" as scenario forecasting through falsifiable bets.

Use this process:

1. Pick the strategic thesis:
   - "LastBite should become a store control layer before it scales buyer marketplace."

2. Convert it into 8-10 falsifiable hypotheses.

3. For each hypothesis, define:
   - what evidence proves it;
   - what evidence disproves it;
   - how many stores/interviews are needed;
   - what metric will be measured;
   - what decision follows.

4. Run one week of field evidence.

5. Score each hypothesis:
   - green: proven enough;
   - yellow: unclear;
   - red: disproven.

6. Decide:
   - continue manual store-control pilots;
   - build seller inventory console;
   - build one POS adapter;
   - return to buyer-marketplace focus;
   - stop the direction.

## 12. Recommended Next Action

Do this first:

> Run a 7-day Store Control validation sprint across 3-5 stores.

Do not build the full middleware yet.

The first artifact to ship is:

- intake form;
- SKU sample worksheet;
- invoice OCR test;
- expiry watchlist;
- supplier CRM;
- owner dashboard mockup;
- one-page seller offer;
- go/no-go scorecard.

The first product to build after validation is:

> Internal seller inventory console with no-POS mode and CSV/POS export-import support.

The first buyer-facing test is:

> Only seller-approved, verified offerable inventory from pilot stores.

## 13. Navigation: Which File To Use For What

- `LASTBITE_MIDDLEWARE_RESEARCH_NAVIGATION.md`
  - Use for the research model and next decision cycle.

- `LASTBITE_MIDDLEWARE_ORACLE_MEMO.md`
  - Use for the full GPT-5.5 Pro critique of the middleware thesis.

- `PROJECT_DIRECTION_DECISION.md`
  - Use for comparing the major paths: consumer app, store systematization, POS, AI assistant.

- `Касаба улица project discovery.md`
  - Use for full evidence from the store-owner transcript and market scan.

- `docs/research-context/product/01-purpose-and-strategy.md`
  - Use for the original LastBite product thesis.

- `docs/research-context/product/02-users-and-workflows.md`
  - Use for buyer/seller workflow vocabulary.

- `docs/research-context/product/03-product-surface-and-features.md`
  - Use for the existing feature surface.

## 14. Final Position

The strongest product-wise path is:

> LastBite should move upstream into seller stock control before scaling buyer discovery.

But the first sellable product should not be "middleware."

It should be:

> A Store Control Pilot that cleans and structures seller inventory, expiry, invoices, supplier workflow, and offerable stock.

If that works, the software path becomes clear:

> Seller inventory console -> no-POS/CSV sync -> POS adapter -> verified offerable inventory -> buyer marketplace.

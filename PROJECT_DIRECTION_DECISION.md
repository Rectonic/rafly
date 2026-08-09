# Project Direction Decision Memo

Date: 2026-07-07

This is the starting file for deciding where the project should head next.

## Recommended Reading Order

Read these in order:

1. `PROJECT_DIRECTION_DECISION.md`
   - This file. Short decision guide.

2. `Касаба улица project discovery.md`
   - Full consolidated discovery from the store-owner transcript, web scan, Oracle strategy, AI inventory research, and next-step plan.

3. `Касаба улица oracle ai inventory.md`
   - Oracle GPT-5.5 Pro's second opinion on AI inventory workflows.

4. `Касаба улица oracle strategy.md`
   - Oracle GPT-5.5 Pro's first opinion on business pathways.

5. `Касаба улица transcript speakers.md`
   - Raw diarized transcript. Read this only when you want to verify whether a conclusion is grounded in the conversation.

6. `docs/research-context/product/01-purpose-and-strategy.md`
   - Existing product strategy context for the current LastBite/mobile direction.

7. `MVP Shipping Playbook.md`
   - Existing delivery discipline for shipping the current app.

## The Decision

The project now has two different strategic directions competing for attention:

1. Continue as a consumer-facing LastBite/mobile product.
2. Explore a new small-retail operating-system opportunity around inventory, POS cleanup, expiry, supplier ordering, and store systematization.

The new opportunity came from the Kasaba Street transcript. It is not proven yet, but it is strong enough to justify a short validation sprint.

## My Recommendation

Do not immediately build a POS system or a new full app.

Run a 7-10 day field validation around:

> Store Systematization Sprint: inventory cleanup, POS/catalog setup, invoice intake, reorder list, expiry watchlist, supplier CRM, and owner dashboard.

Treat AI as an internal operator accelerator, not the customer-facing promise.

The first deliverable should be a manual/service pilot, not production software.

## Why This Direction

The transcript suggests the store owner is not mainly asking for a new checkout screen.

The pain is broader:

- messy stock;
- notebook/manual tracking;
- incomplete POS/catalog setup;
- markirovka/Soliq/product-code workflow;
- supplier ordering by phone;
- expiry/damaged goods;
- supplier/fridge/shelf/display monetization;
- lack of trained implementers.

Existing POS systems already exist in Uzbekistan: REGOS, EasyTrade, E-POS, Optimo, ERA, MoySklad, YesPOS, and others.

Therefore the wedge should be:

- clean the store's operating data;
- make the current POS usable;
- build supplier/expiry/reorder workflows;
- prove value before replacing infrastructure.

## Options

### Option A: Continue Original LastBite Mobile App

Use this path if the priority is shipping the current consumer/mobile product.

Pros:

- existing codebase already supports this path;
- delivery playbook exists;
- less strategic ambiguity;
- easier to measure app-shipping progress.

Cons:

- may ignore stronger B2B operational pain found in the transcript;
- consumer marketplace dynamics may be harder than store-ops service sales;
- does not directly solve inventory/POS cleanup.

Use files:

- `docs/research-context/product/01-purpose-and-strategy.md`
- `docs/research-context/product/02-users-and-workflows.md`
- `docs/research-context/product/03-product-surface-and-features.md`
- `MVP Shipping Playbook.md`

### Option B: Store Systematization Sprint

Use this path if the priority is validating a B2B retail-ops opportunity.

Offer:

- 7-10 day service sprint;
- top 100-300 SKU cleanup;
- POS/catalog cleanup;
- invoice OCR workflow;
- reorder assistant;
- expiry watchlist;
- supplier CRM;
- owner dashboard;
- staff checklist.

Pros:

- closest to transcript evidence;
- can be validated without building a full product;
- creates paid-service possibility;
- reveals which POS/integration pain is real;
- can later become software if repeated across stores.

Cons:

- service-heavy;
- requires store visits;
- requires operator SOPs;
- unit economics unknown;
- not scalable until the playbook is repeatable.

Use files:

- `Касаба улица project discovery.md`
- `Касаба улица oracle strategy.md`
- `Касаба улица oracle ai inventory.md`
- `Касаба улица transcript speakers.md`

### Option C: Build A POS System

Use this path only after validation shows that existing POS tools cannot support the target workflow.

Pros:

- full control over checkout, catalog, stock, receiving, and dashboards;
- could become defensible if local POS systems are weak;
- direct ownership of data.

Cons:

- high trust/risk system;
- requires fiscalization, devices, scanners, scales, payments, ASL Belgisi, E-Factura, offline reliability;
- crowded market;
- longer sales cycle;
- expensive support burden;
- distracts from the immediate systematization pain.

Recommendation:

- do not choose this first.
- keep it as a later branch if 10-20 pilots prove POS replacement is demanded.

### Option D: AI Inventory/Expiry Assistant

Use this path if the field pilot proves that POS/catalog data can be cleaned and maintained.

Product:

- OCR invoice intake;
- SKU normalization;
- duplicate detection;
- low-stock/reorder list;
- expiry alerts;
- supplier follow-up tasks;
- owner dashboard.

Pros:

- good software wedge after service validation;
- does not require replacing POS;
- AI can reduce operator labor;
- aligns with transcript and Oracle memos.

Cons:

- depends on clean data;
- weak if stores do not scan sales consistently;
- integrations may be fragmented.

Recommendation:

- build as an internal operator console first.
- expose to stores later.

### Option E: Supplier/Display Monetization Service

Use this path if store owners care more about visible extra income than inventory discipline.

Offer:

- supplier contact map;
- fridge/display/shelf/bank-panel deal audit;
- negotiation support;
- contract checklist;
- recurring follow-up.

Pros:

- transcript has strong evidence for hidden supplier/display economics;
- easier ROI story;
- can be bundled into systematization sprint.

Cons:

- relationship-driven;
- legal/reputational risks around tobacco/alcohol categories;
- supplier terms may not generalize.

Recommendation:

- include as a module inside Option B, not as the only business.

## Delivery Path If We Choose Option B

### Week 1: Validation

Deliverables:

- store intake form;
- SKU sample worksheet;
- invoice OCR test;
- supplier CRM template;
- expiry watchlist;
- owner dashboard mockup;
- one-page offer.

Actions:

- visit 3-5 stores;
- sample 100 SKUs per store;
- collect 10-30 invoices;
- identify POS system used;
- ask willingness-to-pay questions;
- document ordering and expiry process.

Decision gate:

- do at least 3 of 5 stores confirm the same pain?
- does at least 1 store seriously commit?
- can SKU cleanup be done predictably?

### Weeks 2-3: Micro-Pilot

Scope:

- one store;
- top 100-300 SKUs;
- 10-30 invoices;
- 30-50 reorder SKUs;
- 30-50 expiry-sensitive SKUs;
- top 10 suppliers.

Deliverables:

- cleaned SKU master;
- POS import/export method;
- invoice validation workflow;
- reorder draft;
- expiry watchlist;
- supplier CRM;
- owner dashboard;
- staff SOP.

Decision gate:

- owner uses the output;
- visible before/after value exists;
- field hours are not too high;
- there is a plausible paid package.

### Week 4: Productization Decision

Choose one:

1. Continue service-only.
2. Build internal operator console.
3. Partner with POS vendors.
4. Build POS adapter.
5. Stop if stores do not pay or data quality is unworkable.

## What Not To Build Yet

Do not build yet:

- full POS replacement;
- autonomous supplier ordering;
- shelf computer vision;
- dynamic AI pricing;
- autonomous compliance/legal/tax advice;
- customer-facing SaaS dashboard before one manual pilot works.

## Decision Criteria

Choose the B2B store-ops direction only if:

- stores repeat the same pain;
- one store pays or gives serious commitment;
- SKU cleanup can be delivered in predictable time;
- POS export/import is possible or workarounds are acceptable;
- invoice OCR saves real operator time;
- expiry/reorder/supplier modules reveal measurable value;
- service economics can support field operators.

Otherwise, return focus to the existing LastBite mobile path.

## Bottom Line

The current best decision is:

> Pause major new consumer-app work long enough to run a short B2B store-systematization validation sprint.

This does not mean abandoning LastBite. It means testing whether the stronger immediate opportunity is upstream: helping stores control inventory, expiry, suppliers, and POS data before building more consumer-side marketplace surface.

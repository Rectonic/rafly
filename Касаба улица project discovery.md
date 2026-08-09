# Kasaba Ulicha Project Discovery

Date: 2026-07-06  
Workspace: `/Users/boiskhonkattakhodjaev/Desktop/Useful Materials/LastBite/lastbite-mobile`

## 0. Source Files

Primary local artifacts:

- `Касаба улица.m4a`: original Uzbek/Russian code-switched audio recording.
- `Касаба улица transcript speakers.md`: ElevenLabs Scribe v2 transcript with speaker diarization.
- `Касаба улица oracle strategy.md`: first Oracle GPT-5.5 Pro strategy memo.
- `Касаба улица oracle ai inventory.md`: second Oracle GPT-5.5 Pro memo on AI inventory workflows.
- This file: consolidated discovery and collection of findings.

Transcription details:

- STT provider used: ElevenLabs `scribe_v2`.
- Language hint: Uzbek (`uz`).
- Detected language from provider: `uzb`, probability `1.0`.
- Transcript size: 5,191 word tokens, 81 diarized segments, 2 speakers.
- Caution: the transcript is useful but imperfect. The conversation is code-switched across Uzbek and Russian, and there are ASR artifacts. Treat exact money amounts and some proper nouns as hypotheses unless verified by the original speaker.

## 1. Executive Thesis

This is not primarily a POS app opportunity.

This is a service-backed small-store operating system opportunity:

> A done-for-you store systematization sprint for Uzbek small grocery/convenience stores, powered by field operators and AI-assisted data cleanup.

The store owner pain is operational:

- inventory is large and messy;
- product data is incomplete;
- marking/tax/product-code workflows are confusing;
- sales and receiving may not be reflected cleanly in software;
- some stores still use notebooks or owner memory;
- suppliers are handled manually by phone/Telegram/agent visits;
- expiry/damaged goods create losses;
- supplier/fridge/shelf/display/bank-panel economics are under-monetized;
- owners cannot simply close the store for a week without losing customers.

The right wedge is:

> "We systematize your store in 7-10 days: inventory, POS/catalog setup, marking workflow map, supplier ordering, expiry control, supplier monetization, owner dashboard, and staff process."

AI should be positioned as the engine behind the service, not as the customer-facing promise.

Bad framing:

- "We built an AI POS."
- "AI will know your inventory from shelf photos."
- "Fully automatic supplier ordering."
- "Autonomous compliance/markirovka assistant."

Good framing:

- "We clean your catalog and inventory."
- "We make your store controllable from a dashboard."
- "We reduce notebook/manual work."
- "We show what is low, expiring, missing, or incorrectly entered."
- "We help you order from suppliers with less chaos."
- "We find display/fridge/shelf monetization opportunities."

## 2. Core Transcript Findings

### 2.1 Store Closure Is Expensive

The conversation starts with the idea that if the store needs to close for 7-10 days, it is costly. Later the owner says stopping operations risks losing customers to competitors.

Implication:

- Any service must avoid a long store shutdown.
- The implementation model should be phased, category-by-category, or after-hours.
- The offer should emphasize "no full shutdown" or "minimal downtime."

### 2.2 Inventory Value Can Be Large Even in a Small Store

The speaker estimates goods around roughly 250-300 million UZS, though ASR is noisy.

Implication:

- A small store can carry enough inventory value to justify a paid cleanup.
- Even a 1-3% improvement in stock control, shrink, or ordering could matter.
- The ROI story should be framed around cash tied in inventory, lost sales, and write-offs.

### 2.3 Markirovka, Product Codes, Tax, and "Eco-code" Workflows Are Painful

The transcript mentions `markirovka`, `eko kod`, Soliq/tax base, entering quantities, official product flow, and difficulty selling unofficially or without proper product records.

Verified external context:

- Uzbekistan's Asl Belgisi system uses Data Matrix codes to track marked products through the supply chain and sale via online cash register. Official source: [Asl Belgisi: What is digital marking?](https://help.crpt-turon.uz/hc/en-us/articles/4417429433489-What-is-digital-marking)
- Mandatory digital labeling applies to tobacco, alcohol, beer, household and other appliances, medicinal products, water and drinks, and mineral fertilizers/plant protection agents. Official source: [Asl Belgisi laws on mandatory labeling](https://help.crpt-turon.uz/hc/en-us/articles/7403723826193-NPA-Laws-on-mandatory-digital-labeling-of-products-in-Uzbekistan)
- xTrace/Asl Belgisi changes mention public API data around code status, packaging type, GTIN, product card ID, issuer, production date, batch, and expiration date. Source: [Functional Changes in ASL BELGISI xTrace 2.0](https://help.crpt-turon.uz/hc/en-us/articles/36237821551249-Functional-Changes-in-ASL-BELGISI-xTrace-ver-2-0)

Implication:

- This is a real operational/compliance pain.
- We should not improvise legal/compliance logic in the MVP.
- We should map the workflow and partner with existing tools/POS/marking specialists.

### 2.4 The Store Is Not Fully Systemized

The transcript explicitly says the store still uses notebook/manual tracking because "the system has not come down / been implemented yet."

Implication:

- The problem is not lack of software availability only.
- The problem is adoption, data entry, setup, staff behavior, and process ownership.
- The service needs a field team, not just a login link.

### 2.5 The Owner Wants "Pod Klyuch" Implementation

The speaker repeatedly says things equivalent to:

- set it up from zero;
- enter the assortment;
- put the program in place;
- train people;
- do it "pod klyuch" / turnkey;
- a store can be systemized in 10-15 days by a trained team.

Implication:

- The natural offer is a service package.
- The implementation playbook is the product.
- Software becomes the internal tool that makes the service repeatable.

### 2.6 Supplier and Display Economics Are a Big Hidden Layer

The speaker spends a lot of time discussing:

- cigarette shelves;
- Pepsi/display/fridge deals;
- Red Bull and other beverage placements;
- bank/card/payment panels;
- supplier-provided equipment;
- shelf/display income;
- supplier contacts;
- contracts and deal terms.

Implication:

- The opportunity is bigger than "inventory count."
- A supplier/display monetization audit may be a strong hook because it creates visible cash benefit.
- The supplier CRM may be as important as the SKU master.

### 2.7 Manual Supplier Ordering Is Inefficient

The transcript describes current ordering by phone/agent visits and imagines a system where remaining stock is visible and orders can be generated automatically.

Implication:

- Reorder assistant is important.
- First version should draft orders for owner approval, not auto-send.
- The reorder workflow must respect cash constraints, supplier schedules, minimum order quantities, delivery days, and owner judgment.

### 2.8 Expiry, Damaged Goods, and Returns Are Painful

The transcript discusses:

- near-expiry products;
- water-damaged goods;
- discounting;
- throwing away goods;
- some suppliers refusing returns;
- branded suppliers often not accepting returns.

Implication:

- Expiry tracking and markdown workflow are real.
- Start with high-risk categories only.
- Do not try to record expiry for every SKU on day one.

### 2.9 Labor and Knowledge Are Bottlenecks

The speaker suggests training young people/developers/store operators by sending them to learn the existing store system and then creating multiple implementation teams.

Implication:

- Field "store systematizer" training is part of the business model.
- The repeatable SOP/checklist is a major asset.
- The first 30 days should measure field hours, minutes per SKU, and training difficulty.

## 3. Oracle GPT-5.5 Pro Conclusions

### 3.1 First Oracle Strategy Memo

Oracle's first conclusion:

> This is less a "build a POS app" conversation and more a service + implementation opportunity for small Uzbek grocery/retail stores that are under-digitized, operationally messy, and increasingly pressured by tax/product-marking workflows.

Oracle's strongest wedge:

- done-for-you store systematization;
- inventory cleanup;
- POS/program setup;
- product/assortment entry;
- supplier contacts;
- shelf/display monetization;
- ordering discipline;
- basic analytics.

Top pathways from first Oracle memo:

1. Turnkey new-store launch / modernization.
2. Existing-store digitization and compliance cleanup sprint.
3. Supplier/shelf/fridge/display/bank-panel monetization.
4. Low-stock, reorder, and expiry assistant.
5. Field "store systematizer" team.

Recommended first wedge:

> Existing-store digitization and operational cleanup sprint, bundled with supplier/display monetization audit.

### 3.2 Second Oracle AI Inventory Memo

Oracle's second conclusion:

> Yes, AI can materially bolster the inventory/systematization process, but only as a human-in-the-loop accelerator.

Oracle explicitly warned not to start with:

- standalone POS;
- automatic ordering engine;
- shelf computer vision;
- autonomous compliance;
- AI dynamic pricing;
- "AI knows inventory from photos" claims.

AI should accelerate:

- inventory intake;
- barcode scanning;
- OCR invoice extraction;
- supplier receipt parsing;
- SKU normalization;
- duplicate detection;
- Uzbek/Russian product-name cleanup;
- exception management;
- reorder drafts;
- owner dashboard summaries.

The winning frame:

> "We systematize your store in 7-10 days using existing POS/tools, field operators, and AI-assisted data cleanup."

## 4. Market Scan: Existing Solutions and What They Tell Us

### 4.1 Enterprise Grocery AI

Examples:

- [Afresh](https://www.afresh.com/) unifies store ordering, production planning, inventory management, and DC buying. It claims AI for freshness, shrink reduction, stockout reduction, inventory turns, and messy grocery data.
- [Afresh Store Ordering](https://www.afresh.com/solutions/store-ordering) recommends order quantities, pre-populates automated orders, supports exception-based review, and prioritizes targeted counts.
- [LEAFIO](https://www.leafio.ai/) positions itself around demand forecasting, replenishment, assortment, rotation, and planogram automation.
- RELEX appears in the same broad category of enterprise retail forecasting/replenishment/operations.

Takeaway:

- The category is real.
- Grocery ordering, fresh inventory, shrink, stockouts, and messy data are valuable enough for large funded vendors.
- These systems are likely too heavy for small Uzbek neighborhood stores.
- Copy workflow ideas, not product scope.

### 4.2 Independent Grocery Operating Systems

Example:

- [Vori](https://www.vori.com/) is a grocery POS/back-office system for independent grocers. It connects POS, payments, loyalty, ordering, pricing automation, inventory management, shrink tracking, reporting, and AI agents.

Important Vori claims:

- order smarter from one place using movement data;
- track counts, shrink, and movement;
- inventory agent tracks stock and generates orders before items run out;
- order management includes ordering, receiving, invoice processing, and vendor data.

Takeaway:

- The architecture we want exists in richer markets.
- But for Uzbekistan we likely should not replace POS first.
- Build around local POS/fiscal/marking systems and use the Vori-like architecture as a north star.

### 4.3 Local Uzbekistan POS, Fiscal, and Automation Systems

Examples found:

- [E-POS](https://epos.uz/en) supports grocery/FMCG stores, barcode scanners, scales, fiscal printers, discounts, loyalty, real-time stock/movement tracking, quick catalog import from Excel/1C/CRM, and ASL Belgisi integration.
- [REGOS Integrations Catalog](https://apps.regos.uz/?lang=en) lists barcode/QR receiving, returns, write-off, inventory, labeling/marking, AI-powered product import from PDFs/Excel/receipts, Telegram minimum-stock bot, item checker, and Telegram sales notifications.
- [ERA online cash register](https://pos.era.uz/en/pos) offers online cash register, accounting system, FDO, retail accounting, sales/cashier reports, and scanners for 1D, 2D, and GS1 codes.
- [Smartup](https://smartup24.com/tpost/zblhh3xd81-marking-of-water-and-drinks-in-uzbekista) claims integration with Asl Belgisi and E-Factura for water/drinks marking workflows.
- [Mertech Uzbekistan store automation overview](https://mertech.uz/blog-en/commercial-equipment/store-automation-in-uzbekistan-equipment-and-solutions-for-retail-en/) mentions Regos, EasyTrade, Optimo, and Sellerpeak24 as popular software solutions in Uzbekistan.

Takeaway:

- Local tools already exist.
- Do not compete head-on with fiscal/POS systems.
- Partner, integrate, or run alongside.
- The gap is likely implementation, data quality, workflows, and owner/staff adoption.

### 4.4 Shelf Computer Vision and Robots

Examples:

- [Focal Systems](https://focal.systems/) uses AI-powered shelf cameras for real-time shelf visibility, availability, shrink, inventory, labor, and store tasks.
- [Trax Retail](https://traxretail.com/) analyzes shelf images for on-shelf availability, share of shelf, pricing, compliance, and task prioritization.
- [Scandit ShelfView](https://www.scandit.com/solutions/shelf-intelligence-and-execution/) uses AI-powered computer vision to scan shelves, identify empty spaces, low stock, misplaced items, and distinguish shelf replenishment issues from true out-of-stock using inventory data.
- [Simbe Tally](https://www.simberobotics.com/store-intelligence/tally) is an autonomous shelf-scanning robot producing prioritized task lists and dashboards.
- [Pensa Systems](https://pensasystems.com/) provides shelf intelligence and AI workflows for CPG brands.

Takeaway:

- Shelf intelligence is real at enterprise/chain scale.
- It is likely a bad MVP core for small Uzbek shops because of lighting, occlusion, dense shelves, mixed products, poor angles, and implementation cost.
- Useful later if we first have clean SKU/POS/supplier data.

### 4.5 Barcode, Data Capture, and Product Identity

Examples:

- [Scandit Barcode Scanning](https://www.scandit.com/products/barcode-scanning/) claims fast mobile/web barcode scanning, robust real-world barcode capture, AI target locking, multi-barcode scan, and prebuilt SDKs.
- [GS1 Digital Link](https://www.gs1.org/standards/gs1-digital-link) standardizes identifiers such as GTIN, GLN, SSCC, batch, serial number, and expiry date.

Takeaway:

- We should use proven scanning SDKs/hardware where possible.
- Building scanner tech is unnecessary.
- Product identity and clean GTIN/barcode handling should be a foundation.

### 4.6 OCR and Document AI

Examples:

- [Google Document AI](https://cloud.google.com/document-ai/docs/overview) extracts structured data from documents, including receipts and invoices, and supports OCR, form parsing, custom extractors, validation, and correction workflows.
- [OpenAI vision docs](https://developers.openai.com/api/docs/guides/images-vision) support image analysis and text understanding from images.
- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) can force outputs to match JSON Schema, reducing missing keys or invalid enum values.

Takeaway:

- OCR/vision is a strong near-term accelerator.
- Use it to create draft invoice/product rows.
- Human validation is mandatory.
- The validation interface is more important than the model choice.

### 4.7 Expiry and Markdown Systems

Example:

- [Shelflife](https://www.shelflife.ai/) focuses on expiration-date capture, batch-level inventory, targeted markdowns, and AI optimization by sell-through and freshness window.
- [Odoo expiration-date documentation](https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/inventory/product_management/product_tracking/expiration_dates.html) shows that expiry tracking is a standard inventory feature when lots/serial numbers are enabled.

Takeaway:

- Expiry workflow is important.
- Start manually for selected categories.
- Automate after proving staff can maintain batch/date discipline.

### 4.8 Small Business Forecasting and Inventory Tools

Examples:

- [StockTrim](https://www.stocktrim.com/) targets small and medium businesses with AI inventory forecasting.
- [Cin7](https://www.cin7.com/) targets SMB inventory, stock data, warehouse workflows, financial data, and order management.
- [MarketMan](https://www.marketman.com/) targets restaurants/food service with purchasing, supplier management, invoice scanning, and AI ordering.

Takeaway:

- AI forecasting exists but depends on clean historic sales, stock, supplier, and lead-time data.
- For our context, forecasting should be later.
- First build clean data, reorder rules, and owner approval loops.

### 4.9 Reddit and X / Social Signal

Reddit examples:

- A small-business user asked for POS/inventory/automatic ordering that adds items to a need-to-order list and either places web orders or uses AI/voice to call suppliers. Source: [Reddit r/smallbusiness](https://www.reddit.com/r/smallbusiness/comments/1f8xt9m/pos_system_with_inventory_tracking_and_ordering/)
- A grocery digitization thread described a local grocery with no catalog/database and manually punched prices. The user tried shelf photos with Claude and got about 80% extraction accuracy, but struggled to separate multiple products in a shelf photo. Source: [Reddit r/AiAutomations](https://www.reddit.com/r/AiAutomations/comments/1tla66n/digitising_a_grocery_store/)
- The same thread had a useful warning: start with a clean database, use AI as helper, take small shelf-section photos, return tables with confidence and needs-review flags, and have a human review before POS import.
- An inventory-management thread asked about AI beyond simple reorder points: seasonality, lead time, MOQ, service levels, stockout/overstock prediction, and procurement decisions. Source: [Reddit r/InventoryManagement](https://www.reddit.com/r/InventoryManagement/comments/1klfdem/anyone_using_ai_to_optimize_inventory_levels/)

X/Twitter scan:

- Search results surfaced VoriOS, LEAFIO, Prediko, and AI replenishment/inventory chatter.
- Direct X pages returned empty in browser fetch, so treat this as weak signal only.
- The X signal is mainly category awareness, not evidence.

Social takeaway:

- Small operators want automatic ordering and inventory help.
- Practical commenters warn that clean data and POS sync matter before fancy AI.
- This aligns with our thesis.

## 5. Business Pathways

### Path A: Existing-Store Systematization Sprint

Target:

- operating small grocery/convenience stores using notebook, weak POS usage, incomplete catalog, or messy stock.

Pain:

- inventory is not trusted;
- products are missing from POS;
- marking/tax workflows are confusing;
- staff does not maintain records;
- owner cannot see what is low/expiring/missing.

Offer:

- 7-10 day cleanup sprint.
- Clean top 100-300 SKUs first.
- POS/catalog setup or improvement.
- invoice OCR workflow;
- reorder list;
- expiry watchlist;
- supplier CRM;
- owner dashboard;
- staff checklist.

MVP:

- one pilot store;
- one field operator plus one analyst/developer;
- Google Sheets/Airtable/Retool/AppSheet;
- existing POS export/import;
- OCR into reviewed rows;
- Telegram/WhatsApp owner summary.

Revenue:

- fixed implementation fee;
- monthly support;
- optional per-visit audit.

Why strong:

- best supported by transcript and Oracle.
- pain is immediate.

### Path B: New Store Turnkey Launch

Target:

- new or renovated grocery/convenience stores.

Pain:

- owner does not know assortment, POS, shelves, supplier setup, or operating routines.

Offer:

- pod-klyuch store operating setup:
  - POS/catalog;
  - initial assortment;
  - shelf layout;
  - supplier contacts;
  - reorder process;
  - cashier/manager training;
  - dashboard.

MVP:

- one new store launch with checklist and supplier map.

Revenue:

- higher setup fee;
- optional maintenance/support.

Risk:

- longer sales cycle and dependence on renovation/opening timing.

### Path C: Supplier/Display Monetization Audit

Target:

- stores with foot traffic and untapped supplier placement opportunities.

Pain:

- stores do not know which suppliers will pay/provide fridges/displays/shelves/panels.

Offer:

- supplier contact map;
- display/fridge/bank-panel opportunity list;
- negotiation support;
- contract checklist;
- recurring follow-up.

MVP:

- build a district supplier map with 10-20 contacts;
- close 1-3 real opportunities.

Revenue:

- fixed audit fee;
- success fee or commission where legal and transparent.

Risk:

- supplier terms may be relationship-driven and not generalizable.
- tobacco/alcohol display has legal and reputational risk.

### Path D: Low-Stock, Reorder, and Expiry Assistant

Target:

- stores with daily/weekly supplier ordering and frequent stockouts/waste.

Pain:

- owner orders by phone/memory;
- stockouts happen;
- near-expiry goods are not tracked;
- supplier returns are inconsistent.

Offer:

- top-SKU reorder list;
- low-stock alerts;
- draft supplier order by category/supplier;
- expiry watchlist;
- markdown/remove/return tasks.

MVP:

- rules-based assistant for top 50 fast-moving SKUs and 30-50 expiry-sensitive SKUs.

Revenue:

- monthly subscription/support.

Risk:

- requires clean POS/sales/stock data.
- should not auto-order without approval.

### Path E: Store Systematizer Training Team

Target:

- internal team first, then possibly POS vendors/retail consultants.

Pain:

- stores need implementers who understand both retail operations and software.

Offer:

- train field operators to run the 7-10 day sprint.
- SOPs, checklists, templates, QA review.

MVP:

- train 2 implementers inside one real store.

Revenue:

- margin on implementation labor;
- later certification/subcontracting.

Risk:

- quality control.
- trained staff can leave.

## 6. AI Workflow Map

### 6.1 AI Features to Build Now

Build now means build as internal/operator tooling, not necessarily polished SaaS.

1. SKU normalization assistant
   - Input: barcode, product photo, invoice line, messy Uzbek/Russian name.
   - Output: normalized name, brand, unit, pack size, category, confidence.
   - Human approves.

2. Duplicate/missing-data detector
   - Flags duplicate barcodes, similar product names, missing supplier, missing cost, missing price, missing category.

3. OCR invoice validation workflow
   - Use off-the-shelf OCR/model.
   - Build the review screen and matching logic.
   - Always validate totals, quantities, and SKU matches.

4. Invoice-line to SKU matching
   - Match supplier line items to SKU master.
   - Mark unmatched/new products.
   - Learn aliases over time.

5. Rules-based reorder draft assistant
   - Inputs: stock, sales velocity, supplier schedule, minimum stock, delivery lead time.
   - Output: suggested order list by supplier.
   - Owner approves.

6. Expiry task list
   - Start manual expiry data entry for selected categories.
   - Output: watch/markdown/remove/return tasks.

7. Supplier CRM assistant
   - Track contacts, categories, delivery days, payment terms, return policies, display/fridge opportunities.
   - Generate follow-up tasks and message drafts.

8. Owner dashboard summary
   - Daily/weekly summary:
     - low stock;
     - missing data;
     - expiring goods;
     - inventory value at risk;
     - supplier follow-ups;
     - display deal opportunities;
     - cash needed for tomorrow's orders.

### 6.2 Use Off-The-Shelf

- POS/cash register.
- Barcode scanner or scanning SDK.
- Google/OpenAI/Azure OCR/vision.
- Asl Belgisi/E-Factura-capable systems.
- Spreadsheet/Airtable/Retool/AppSheet in first version.

### 6.3 Manual First

- expiry tracking for selected products;
- supplier negotiation;
- markirovka workflow documentation;
- staff training;
- display/fridge/shelf deal audit;
- store layout and assortment recommendations.

### 6.4 Later

- AI demand forecasting;
- automatic supplier integrations;
- auto-ordering;
- expiry OCR from labels;
- shelf computer vision;
- POS-agnostic integration platform;
- "chat with my store" owner assistant.

### 6.5 Avoid in MVP

- replacing POS;
- autonomous compliance/legal/tax advice;
- fully automatic supplier orders;
- dynamic AI pricing;
- shelf-photo inventory claims;
- robot/camera shelf scanning;
- custom barcode scanning engine.

## 7. Pilot Architecture

### 7.1 Three-Layer Architecture

Layer 1: Existing Systems

- current POS/cash register;
- fiscal module;
- barcode scanner;
- Excel/CSV import/export;
- Asl Belgisi/E-Factura workflow;
- supplier invoices;
- Telegram/phone ordering.

Layer 2: Systematization Service

- field operator;
- SKU census;
- inventory count;
- supplier map;
- expiry process;
- POS cleanup;
- staff training;
- SOPs/checklists.

Layer 3: AI Accelerator

- OCR;
- SKU matching;
- duplicate detection;
- structured extraction;
- reorder suggestions;
- owner dashboard;
- exception queue.

Rule:

> AI can draft, flag, normalize, and recommend. Humans approve anything that changes POS, prices, supplier orders, or compliance records.

### 7.2 Pilot Data Model

SKU master:

- internal SKU ID;
- product name;
- Uzbek/Russian aliases;
- brand;
- category;
- unit;
- pack size;
- barcode/GTIN;
- marking required: yes/no/unknown;
- Asl Belgisi product group if relevant;
- supplier;
- cost price;
- sale price;
- margin estimate;
- current stock;
- minimum stock;
- reorder multiple;
- shelf/fridge/display location;
- expiry tracking required;
- confidence score;
- last updated.

Inventory batch table:

- SKU ID;
- quantity;
- batch/lot if available;
- expiry date;
- purchase date;
- supplier;
- invoice ID;
- purchase price;
- shelf/fridge location;
- status: normal/watch/markdown/remove/returned/written off.

Invoice/receiving table:

- invoice ID;
- supplier;
- date;
- document photo/PDF;
- OCR status;
- invoice total;
- extracted line items;
- matched SKU ID;
- quantity;
- unit cost;
- suggested sale price;
- validation status;
- exceptions.

Sales/POS table:

- date;
- SKU ID;
- quantity sold;
- revenue;
- discount;
- gross margin proxy;
- cashier/shift if available.

Supplier CRM:

- supplier/company;
- rep name;
- phone/Telegram;
- categories supplied;
- delivery days;
- minimum order;
- payment terms;
- return policy;
- near-expiry/damaged return policy;
- E-Factura/Asl Belgisi support;
- shelf/display/fridge deal potential;
- last contact;
- next action.

Exception queue:

- missing barcode;
- duplicate SKU;
- missing supplier;
- missing cost;
- missing sale price;
- marking category uncertain;
- invoice OCR mismatch;
- count mismatch;
- low stock;
- near expiry;
- supplier follow-up;
- display/fridge/shelf deal follow-up;
- staff training issue.

## 8. First Pilot Workflow

### 8.1 Pre-Visit Intake

Collect before arriving:

- POS name/version;
- whether every sale is scanned;
- POS export/import capability;
- existing Excel/catalog files;
- recent supplier invoices/receipts;
- shelf photos for context only;
- main supplier contacts;
- top 20 products owner never wants out of stock;
- known problem categories;
- current ordering method;
- current expiry/write-off pain;
- current shelf/fridge/display/bank-panel deals.

### 8.2 Store Walk and SKU Census

Process:

1. Walk category by category.
2. Scan barcode if present.
3. Count quantity.
4. Photograph product only if identity/pack/price is ambiguous.
5. Mark shelf/fridge/display location.
6. Flag expiry-sensitive products.
7. Flag marking-relevant products.
8. Record supplier if known.
9. Record cost/sale price if available.

AI role:

- normalize product name;
- detect duplicates;
- infer unit/pack/brand;
- translate/standardize Uzbek/Russian labels;
- flag uncertain rows.

Human role:

- approve SKU identity;
- confirm quantity;
- confirm unit;
- confirm category;
- confirm price/cost.

### 8.3 SKU Cleanup

Do not clean the entire store first.

Prioritize:

1. top-selling/high-turnover items;
2. high-value items;
3. marked/compliance-sensitive items;
4. expiry-sensitive items;
5. supplier-deal items such as drinks/snacks/cigarettes where legal.

First scope:

- top 100-300 SKUs.

### 8.4 OCR Invoice Intake

Workflow:

1. staff photographs invoice/receipt;
2. OCR extracts supplier, date, invoice number, total, line items;
3. AI matches line items to SKU master;
4. system flags new SKUs, mismatches, suspicious price changes, total mismatches;
5. human validates;
6. approved rows go to POS import or pilot database.

Rule:

> OCR creates draft data, not truth.

### 8.5 POS Sync

Phase 1:

- manual CSV/Excel export/import;
- use current POS as source where possible;
- do not build generic integrations.

Phase 2:

- one adapter for the most common POS found in pilot visits.

Phase 3:

- formal integration/partnership with POS vendor.

### 8.6 Reorder Assistant

Start rules-based:

- daily sales velocity;
- current stock;
- minimum stock;
- lead time;
- supplier delivery day;
- reorder multiple;
- cash constraint;
- owner approval.

No auto-send in MVP.

### 8.7 Expiry Watchlist

Start with:

- dairy;
- water/drinks if relevant;
- sausage/meat;
- sweets;
- bakery;
- frozen/chilled products;
- any supplier/owner-named high-risk category.

Statuses:

- normal;
- watch;
- markdown;
- return;
- remove/write off.

### 8.8 Supplier Monetization CRM

For each supplier:

- contact;
- rep;
- categories;
- ordering channel;
- delivery days;
- return policy;
- display/fridge/shelf deal terms;
- required store conditions;
- next action.

Goal:

- identify at least 3 supplier/display/fridge/bank-panel opportunities in the first pilot.

## 9. Validation Tests

### 9.1 SKU Census Test

Sample 100 SKUs per store.

Measure:

- minutes per SKU;
- barcode coverage;
- duplicate/inconsistent-name rate;
- missing cost rate;
- missing supplier rate;
- marking-relevant rate;
- expiry-sensitive rate;
- POS-missing rate.

Pass signal:

- field team can clean 100 SKUs predictably;
- owner sees immediate value from missing/duplicate/low-stock findings.

### 9.2 OCR Invoice Test

Collect 10-30 invoices/receipts.

Measure:

- supplier/date/number extraction accuracy;
- line-item accuracy;
- quantity/unit/cost accuracy;
- total reconciliation;
- human correction time;
- SKU match rate.

Pass signal:

- OCR plus validation is 40-60% faster than manual entry.

### 9.3 Barcode/Marking Test

Scan 200 products.

Measure:

- 1D readable rate;
- 2D/marking readable rate;
- no-code rate;
- Asl Belgisi category frequency;
- whether current POS handles codes.

Pass signal:

- scanning materially speeds intake;
- marked-category workflow can be documented without custom compliance software.

### 9.4 POS Sync Test

For each store:

- export catalog;
- export sales;
- import 20 cleaned SKUs;
- check whether stock updates after sales;
- observe whether cashiers actually scan.

Pass signal:

- practical export/import path exists for at least one local POS.

### 9.5 Reorder Assistant Test

Pick 30-50 fast-moving SKUs.

Run for 7-14 days:

- compare owner's actual orders vs assistant draft;
- track stockouts;
- track overstock;
- track supplier delay;
- ask whether draft saved time.

Pass signal:

- owner uses/edits the draft;
- assistant catches stockouts earlier than current process.

### 9.6 Expiry Test

Pick 30-50 high-risk SKUs.

Measure:

- time to record expiry;
- visible-date rate;
- value at risk in 3/7/14 days;
- discounted/returned/discarded items;
- staff ability to maintain weekly.

Pass signal:

- process finds real money at risk;
- staff can maintain it.

### 9.7 Supplier CRM Test

For each store:

- list top 10 suppliers;
- record contacts;
- record return policy;
- record display/fridge/shelf terms;
- ask whether structured orders are accepted;
- identify 3 monetization opportunities.

Pass signal:

- at least one supplier/display opportunity is actionable.

## 10. Interview Questions

### Store Owners

1. What do you use today: notebook, Excel, POS, Telegram, memory?
2. How many SKUs do you carry?
3. What is approximate inventory value?
4. How often do you reconcile stock?
5. What products require marking, codes, tax entry, or special handling?
6. What happens when product data is missing/wrong?
7. How many hours per week go into receiving, product entry, ordering, reconciliation?
8. What are your most common stockouts?
9. How much product do you throw away or discount monthly?
10. Which suppliers accept returns?
11. Which suppliers refuse returns?
12. What supplier/fridge/display deals do you already have?
13. Would you pay for a 7-10 day cleanup sprint?
14. What result would make the sprint obviously worth paying for?
15. Would you prefer setup fee, monthly support, or success fee?

### POS / Fiscal / Automation Vendors

1. Which POS systems are common in Uzbek small groceries?
2. Can product catalogs be exported/imported?
3. Are there APIs?
4. How are Asl Belgisi codes handled?
5. How are E-Factura workflows handled?
6. What are the most common onboarding failures?
7. How much do stores pay for setup/monthly support?
8. Do vendors have enough field implementers?
9. Can a third-party service partner implement stores for you?
10. What integration would you welcome?

### Supplier / Brand / Distributor Reps

1. Do you pay for shelf/display/fridge placement?
2. What store conditions are required?
3. Do you provide fridges, stands, signage, shelves?
4. Can a third party broker stores for you?
5. Do you accept automatic or structured orders?
6. What data would make a store more attractive?
7. What return policies exist?
8. What happens with near-expiry or damaged goods?
9. Which categories are best for display monetization?
10. Do you already have an app/portal/Telegram bot?

## 11. Risks

### 11.1 Bad Source Data

If POS sales are incomplete, inventory counts are wrong, or invoices are missing, AI will produce confident garbage.

Mitigation:

- confidence labels;
- exception queue;
- human approval;
- start with top SKUs.

### 11.2 POS Integration Friction

Local POS systems may have weak APIs or messy export/import.

Mitigation:

- CSV first;
- one POS adapter only after validation;
- partner with POS vendors.

### 11.3 Compliance Liability

Asl Belgisi, E-Factura, Soliq, and product marking are compliance-sensitive.

Mitigation:

- document workflow;
- use approved tools;
- involve accountant/marking specialist;
- do not give autonomous legal/tax advice.

### 11.4 Staff Discipline

If cashiers bypass scanning or receiving is not recorded, inventory breaks.

Mitigation:

- staff SOP;
- short daily checklist;
- owner dashboard;
- exception alerts.

### 11.5 Reorder Overstock Risk

Bad reorder suggestions can trap cash.

Mitigation:

- owner approval;
- conservative rules;
- cash constraint field;
- explain why each item is suggested.

### 11.6 OCR Error Risk

Invoices may be handwritten, low quality, Uzbek/Russian, or inconsistent.

Mitigation:

- OCR drafts only;
- total reconciliation;
- line-item approval.

### 11.7 Expiry Labor Burden

Batch/expiry tracking can be too much for small-store staff.

Mitigation:

- only high-risk categories first.

### 11.8 Supplier Cooperation

Suppliers may prefer phone/agent visits and may not accept structured/auto-orders.

Mitigation:

- supplier CRM first;
- integration later.

### 11.9 Shelf CV Disappointment

Shelf photos fail because of occlusion, lighting, angles, mixed products, and dense shelves.

Mitigation:

- avoid shelf CV in MVP;
- use photos only for ambiguous product identification.

### 11.10 Unit Economics

Service work may be labor-heavy.

Mitigation:

- track minutes per SKU;
- track total field hours;
- create SOPs;
- train implementers;
- price implementation properly.

## 12. Next 7 Days

Day 1:

- define one-page pilot offer;
- define deliverables;
- prepare store intake form;
- prepare SKU/invoice/supplier/expiry templates.

Days 2-4:

- visit 3-5 stores;
- run SKU sample test;
- collect invoices;
- observe ordering;
- document POS;
- ask willingness-to-pay questions.

Days 3-5:

- build pilot kit:
  - phone/scanner;
  - Google Sheet/Airtable/Retool base;
  - invoice upload form;
  - OCR prompt/schema;
  - SKU cleanup template;
  - supplier CRM;
  - expiry checklist;
  - reorder calculator;
  - owner dashboard mockup.

Days 5-7:

- start one micro-pilot:
  - top 100-300 SKUs;
  - 10-30 invoices;
  - 30-50 reorder SKUs;
  - 30-50 expiry-sensitive SKUs;
  - top 10 suppliers.

Success by end of week:

- owner sees before/after catalog;
- at least one invoice OCR workflow works end-to-end;
- low-stock list generated;
- expiry risk list generated;
- supplier CRM has real contacts and next actions;
- willingness to pay is clearer.

## 13. Next 30 Days

Week 1-2:

- complete one full store pilot.
- deliver cleaned catalog, POS import/export, invoice process, reorder assistant, expiry watchlist, supplier CRM, dashboard, staff SOP.

Week 2-3:

- build internal systematization console:
  - SKU master;
  - invoice validation;
  - POS import/export;
  - reorder assistant;
  - expiry task list;
  - supplier CRM;
  - dashboard;
  - exception queue.

Week 3-4:

- partner and price:
  - 1-2 POS vendors;
  - 1 fiscal/marking specialist;
  - 1 scanner/hardware supplier;
  - 5-10 supplier reps;
  - 1 accountant/tax workflow advisor.

Pricing tests:

- audit only;
- 7-10 day systematization sprint;
- monthly support;
- supplier/display monetization success fee.

Go/no-go criteria:

- 3 of 5 stores confirm pain;
- at least 1 store pays or seriously commits;
- top 100-300 SKU cleanup is predictable;
- OCR reduces invoice-entry effort;
- POS export/import is feasible;
- owner uses dashboard/reorder list;
- expiry tracking finds real at-risk value;
- supplier CRM finds at least one tangible deal;
- unit economics show field team can make margin.

## 14. Current Product Concept

Working name:

- Store Systematization Sprint
- Retail Ops Cleanup
- LastBite Store OS
- LastBite Retail Control Room

Customer-facing promise:

> We make your shop controllable in 7-10 days without replacing your whole business.

Internal product:

- AI-assisted operator console for store systematization.

Customer deliverables:

- cleaned SKU master;
- POS/catalog setup;
- invoice intake process;
- reorder list;
- expiry watchlist;
- supplier CRM;
- display/fridge deal opportunities;
- owner dashboard;
- staff checklist.

## 15. Strongest Strategic Bet

The best path is:

> A human-in-the-loop store systematization service, powered by AI data-capture and cleanup tools, integrated around existing Uzbek POS/fiscal/marking systems.

Build now:

- SKU cleanup assistant;
- invoice OCR validation workflow;
- reorder draft assistant;
- expiry task list;
- supplier CRM;
- owner dashboard;
- exception queue.

Use off-the-shelf:

- POS/cash register;
- scanners;
- OCR/document AI;
- Asl Belgisi/E-Factura tools;
- spreadsheet/low-code database.

Manual first:

- supplier negotiation;
- expiry discipline;
- marking workflow SOP;
- display monetization;
- staff training.

Avoid for MVP:

- full POS replacement;
- autonomous compliance;
- shelf computer vision as core;
- AI dynamic pricing;
- autonomous supplier ordering;
- "AI inventory from photos" promise.

## 16. Source Index

Transcript and internal memos:

- `Касаба улица transcript speakers.md`
- `Касаба улица oracle strategy.md`
- `Касаба улица oracle ai inventory.md`

Uzbekistan marking/POS/local automation:

- [Asl Belgisi: What is digital marking?](https://help.crpt-turon.uz/hc/en-us/articles/4417429433489-What-is-digital-marking)
- [Asl Belgisi: Laws on mandatory digital labeling](https://help.crpt-turon.uz/hc/en-us/articles/7403723826193-NPA-Laws-on-mandatory-digital-labeling-of-products-in-Uzbekistan)
- [Asl Belgisi xTrace functional changes](https://help.crpt-turon.uz/hc/en-us/articles/36237821551249-Functional-Changes-in-ASL-BELGISI-xTrace-ver-2-0)
- [E-POS Systems](https://epos.uz/en)
- [REGOS Integrations Catalog](https://apps.regos.uz/?lang=en)
- [ERA online cash register](https://pos.era.uz/en/pos)
- [Smartup water/drinks marking](https://smartup24.com/tpost/zblhh3xd81-marking-of-water-and-drinks-in-uzbekista)
- [Mertech store automation in Uzbekistan](https://mertech.uz/blog-en/commercial-equipment/store-automation-in-uzbekistan-equipment-and-solutions-for-retail-en/)

Grocery AI / inventory / POS:

- [Afresh](https://www.afresh.com/)
- [Afresh Store Ordering](https://www.afresh.com/solutions/store-ordering)
- [Vori](https://www.vori.com/)
- [LEAFIO grocery stores](https://www.leafio.ai/solution-for-grocery-stores/)
- [StockTrim](https://www.stocktrim.com/)
- [Cin7](https://www.cin7.com/)
- [MarketMan](https://www.marketman.com/)
- [Odoo expiration dates](https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/inventory/product_management/product_tracking/expiration_dates.html)

Shelf intelligence and data capture:

- [Focal Systems](https://focal.systems/)
- [Trax Retail](https://traxretail.com/)
- [Scandit ShelfView](https://www.scandit.com/solutions/shelf-intelligence-and-execution/)
- [Scandit Barcode Scanning](https://www.scandit.com/products/barcode-scanning/)
- [Simbe Tally](https://www.simberobotics.com/store-intelligence/tally)
- [Pensa Systems](https://pensasystems.com/)
- [GS1 Digital Link](https://www.gs1.org/standards/gs1-digital-link)
- [Shelflife](https://www.shelflife.ai/)

Document AI / multimodal extraction:

- [Google Document AI overview](https://cloud.google.com/document-ai/docs/overview)
- [OpenAI Images and Vision](https://developers.openai.com/api/docs/guides/images-vision)
- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)

Social signals:

- [Reddit: POS with inventory tracking and ordering](https://www.reddit.com/r/smallbusiness/comments/1f8xt9m/pos_system_with_inventory_tracking_and_ordering/)
- [Reddit: Digitising a grocery store](https://www.reddit.com/r/AiAutomations/comments/1tla66n/digitising_a_grocery_store/)
- [Reddit: AI inventory optimization](https://www.reddit.com/r/InventoryManagement/comments/1klfdem/anyone_using_ai_to_optimize_inventory_levels/)
- [Reddit: Is anyone able to solve inventory management?](https://www.reddit.com/r/POS/comments/1o7j6rs/is_anyone_ever_able_to_solve_inventory_management/)

## 17. Open Questions

Business:

- Will stores pay for a 7-10 day cleanup sprint?
- What price is acceptable: setup fee, monthly support, or success fee?
- Is supplier/display monetization a stronger hook than inventory cleanup?
- Which customer segment buys first: existing messy stores or new stores?

Operational:

- Which POS systems dominate the target stores?
- Can those POS systems export/import catalogs and sales?
- How often do cashiers bypass scanning?
- Who will maintain expiry and receiving data after the sprint?

Technical:

- Which OCR provider performs best on local invoices?
- What schema catches the most errors before POS import?
- Can we maintain a reliable SKU alias map across Uzbek/Russian supplier names?
- How much can be done with Sheets/Retool before custom software is needed?

Compliance:

- Which product groups in target stores require Asl Belgisi handling?
- What exact workflow does each POS use for marked goods?
- What legal boundaries apply to expiry markdowns, tobacco/alcohol display, and supplier commissions?

Supplier:

- Which suppliers pay for shelves/fridges/displays?
- Which accept returns?
- Which accept structured orders?
- Which already have apps/portals/Telegram bots?

## 18. Working Decision

Proceed with discovery and one micro-pilot.

Do not build a full app yet.

The next product artifact should be a pilot kit:

- store intake form;
- SKU cleanup sheet;
- invoice OCR schema;
- supplier CRM template;
- expiry watchlist;
- reorder calculator;
- owner dashboard mockup;
- staff SOP;
- pricing menu.

The next proof point is not "AI accuracy." It is:

> Can we make one real store more controllable, with measurable before/after value, in 7-10 days?

# LastBite Solution Proposal

Date: 2026-07-07. Written by a research agent from the compact context, the Kasaba Street discovery memo, and the project direction memo. Sources and verification notes in Section 3.

## 1. Executive Recommendation

**Conditional yes — but the first move is not software.** LastBite should stop expanding the buyer marketplace now and move upstream, because the buyer app's core promise (a reservable, accurate, discounted offer) cannot be kept while seller stock truth does not exist. However, the upstream move should start as a **paid store systematization service**, not as a Store Control Layer application. The critical unknown is not whether store data is messy — the transcript confirms it is — but whether any owner will pay to fix it and whether staff will keep it fixed. Neither has ever been tested; willingness-to-pay is still an open question in the founder's own discovery memo. So this week the founder should sell a 7–10 day Store Control Sprint to 3–5 real stores, run one micro-pilot in the store that commits, and instrument everything (minutes per SKU, invoice OCR accuracy, staff compliance). Software gets built only behind gates: an internal operator console at day 30 if the sprint validates, a seller inventory console at day 60 if data survives two weeks of staff maintenance, one POS/CSV path at day 90 if it repeats across stores. What LastBite should **not** do: build a POS, build a generic middleware platform, add buyer-app features, or write any production code before one store pays or seriously commits. If three of five stores shrug or refuse to pay, the thesis is disproved cheaply and the founder returns to the consumer app with that knowledge.

## 2. Decision Frame

The vague framing is "marketplace vs middleware." The real choice is **what to sell first and what evidence justifies building anything**. Six candidate paths:

| Path | What it really means | Verdict |
|---|---|---|
| Buyer marketplace first | Scale discovery/reservations on top of stock data sellers don't trust themselves | No. Every reservation against phantom stock burns buyer trust that is nearly impossible to rebuild. Two unvalidated theses stack: buyer demand AND seller data quality. |
| Full POS replacement | Own checkout, fiscal receipts, devices, offline mode, Asl Belgisi marked-goods flow, payments, support | No. Crowded local market (REGOS, E-POS, ERA, EasyTrade, Optimo…), compliance-heavy, and the transcript pain is adoption/setup, not missing software. |
| POS integration layer | Pull catalog/sales/stock from existing POS, push cleaned fields back | Not first. You cannot integrate with data that doesn't exist or vendors you haven't met. Becomes real at day 60–90, CSV before API, one adapter only. |
| Store Control Layer (software-first) | Build the middleware app the founder is imagining, then find stores for it | No — this is speculative building on n=1 evidence. It is the plausible **end-state**, not the entry move. |
| Service-led store systematization | Sell a done-for-you cleanup sprint; the service is the research engine and revenue test | **Yes — first.** It tests willingness-to-pay, SKU cleanup cost, staff behavior, and POS reality simultaneously, with near-zero build cost. |
| Seller inventory console | SKU master, stock confidence, expiry, reorder drafts, exceptions | Yes — **second**, as internal operator tooling that makes the service repeatable, then exposed to sellers. |

The tradeoff being resolved: speed-to-evidence vs speed-to-product. The service path is slower to "product" but 10x faster to the two answers that decide everything — *will they pay* and *will the data stay clean*. Every software-first path spends weeks building before touching either question.

## 3. Evidence Read

Files read in full:

- `/tmp/lastbite_compact_research_context_v2.md` — primary source of truth, read first.
- `Касаба улица project discovery.md` — opened to verify what the transcript actually supports, specifically whether willingness-to-pay evidence exists (it does not — §17 lists it as an open question) and whether money figures are reliable (they are flagged as ASR hypotheses, §0 and §2.2).
- `PROJECT_DIRECTION_DECISION.md` — opened to check whether a direction decision was already recorded, to avoid contradicting or duplicating it. It recommends the same validation sprint but stops short of pricing, thresholds, and a buyer-side policy; this memo supplies those.

Not read, deliberately: `LASTBITE_MIDDLEWARE_ORACLE_MEMO.md` (its verdict is summarized in the compact context; the prompt forbids repeating it), `LASTBITE_MIDDLEWARE_RESEARCH_NAVIGATION.md`, the raw transcript (`Касаба улица transcript speakers.md` — the discovery memo's caveats about ASR noise were sufficient; no specific claim required raw verification), and the `docs/research-context/product/*` files (the compact context's product baseline was not in dispute). No source code, schemas, or config were read or modified.

## 4. What The Founder May Be Missing

1. **The entire upstream thesis rests on one 20-minute conversation.** One store, two speakers, code-switched audio with acknowledged ASR errors. The "250–300M UZS inventory" figure and the "Rafiq/ROFEEV" identity are hypotheses. Treating this as a validated market signal is the biggest current error. n must reach 5 before any build decision.
2. **Willingness to pay has never been tested.** The founder's own discovery memo lists it under "Open Questions." Owners describing pain vividly and owners transferring money are different populations. The sprint must ask for money in week one — a signed commitment or deposit, not a compliment.
3. **The transcript speaker may not be a customer.** Someone who says "a trained team can systemize a store in 10–15 days" and proposes training implementation teams sounds like a prospective **partner, channel, or competitor** (possibly the ROFEEV/REGOS implementer ecosystem), not a buyer of the service. Which one he is changes the go-to-market entirely. Clarify on the first follow-up call.
4. **Data decay is the silent killer.** A cleaned catalog is a snapshot. If cashiers skip scanning, receiving goes unrecorded, and expiry checks lapse, the data is garbage in 2–4 weeks and the recurring-revenue story dies. This is a staff-behavior problem, not a software problem — and it's why the 60-day gate (2 weeks of unassisted maintenance) matters more than any feature.
5. **POS vendors are gatekeepers, not bystanders.** The vendor often controls export/import access, not the owner. A vendor who sees LastBite as a rival (or who sells their own "AI import" tooling — REGOS already lists one) can block the CSV path. Decide early whether vendors are partners or routes around; meet one by day 30.
6. **Fiscal/Asl Belgisi compliance is a liability boundary.** Marked goods (tobacco, alcohol, water/drinks, more coming) flow through Data Matrix codes and the online cash register. If LastBite's cleanup touches those records incorrectly, the store owner bears fiscal risk and blames LastBite. Rule: document and map marking workflows; never write to them; refer to the store's accountant or marking specialist.
7. **This is a services business before it is a software business — possibly for a year.** Field hours, operator training, SOP quality, and per-store margin decide viability, not code. The founder should decide now whether he is willing to run a field-ops company for 6–12 months, because that is what validation demands. If the answer is no, that is a legitimate reason to stay consumer-side — better to admit it now.
8. **Buyer demand is also unvalidated.** Pausing the marketplace does not park a proven asset; the discount-grocery reservation behavior in Tashkent is itself untested. The 90-day plan's manual buyer-offer test (day 60) is quietly the first real buyer-demand experiment — treat it as one, with its own metrics.
9. **Marketplace trust fails asymmetrically.** A buyer who travels to a store and finds the reserved item missing doesn't retry — and tells others. Uzbek mini-market word-of-mouth is local and dense. This is why the "expose only seller-approved offerable inventory" rule must be absolute, and why reservation failure rate needs a hard kill threshold (>10% → pull the store from the feed).
10. **Founder time is the scarcest resource and is currently unmeasured.** The plan requires selling, auditing, cleaning, and building simultaneously. Track founder hours per store from day one; if store #3 takes as many hours as store #1, the model doesn't scale and no software fixes that.

## 5. Recommended Wedge

**Product: the Store Control Sprint** — a paid, done-for-you 7–10 day store systematization engagement.

- **Customer:** owner of a Tashkent mini-market / small grocery (roughly 500–3,000 SKUs, 1–4 staff), currently on notebook, weak POS usage, or a POS with an incomplete catalog.
- **User:** the owner (dashboard, reorder approval) and store staff (receiving, expiry checks); LastBite field operator does the heavy lifting during the sprint.
- **Job-to-be-done:** "Make my store controllable — I want to know what I have, what's low, what's expiring, what to order, and where money leaks — without closing the store or replacing my system."
- **Deliverables:** cleaned top 100–300 SKU master (barcode, cost, price, supplier, category); POS catalog import or standalone database if no POS; invoice intake process with OCR-assisted entry; reorder draft list for top 30–50 movers; expiry watchlist for 30–50 high-risk SKUs; supplier CRM with top 10 suppliers and at least one display/fridge/panel monetization lead; one-page owner dashboard (Sheets/Telegram summary); one-page staff SOP.
- **Pricing hypothesis (to test, not assume):** setup fee 3–7M UZS (~$230–550) for the sprint + 500K–1.5M UZS/month support. Anchor the pitch to inventory value: "you hold ~250M UZS in stock; a 2% reduction in write-offs and stockouts pays for this several times over." Accept a discounted pilot price for store #1 only in exchange for metrics access and a reference.
- **Sales script / promise:** "In 7–10 days, without closing your store, we clean your product catalog, set up your receiving and ordering process, put your expiring goods on a watchlist, and give you a daily summary of what's low, expiring, and missing. You keep your current cash register. If we don't find at least [X] UZS of at-risk or dead stock, you don't pay the second half."
- **"Done" means:** owner opens the dashboard unprompted ≥3 times in the final week; staff records receiving for 5 consecutive days; at least one reorder draft was used for a real supplier order; before/after catalog delta documented (duplicates removed, missing fields filled, at-risk value found).
- **Why this wedge beats the alternatives:** it produces revenue and evidence simultaneously; it requires no code (templates + Sheets + off-the-shelf OCR); it answers the four fatal questions (pay? clean? maintain? POS path?) in weeks; and every artifact it produces (SKU schema, exception types, invoice fields) is requirements discovery for the software that follows. Starting with the buyer marketplace tests none of these; starting with POS software bets a year of build on all of them.

## 6. First Software Product

**Seller Inventory Console v0.1** — built at day 30–60, only behind the gate, and **operator-facing first** (the field team is user #1; sellers see outputs, not screens).

- **Users:** LastBite field operator (primary), store owner (dashboard + approvals via Telegram/simple web view), staff (receiving entry).
- **Workflows:** SKU intake (scan → normalize → approve); invoice intake (photo → OCR draft → line-item validation → stock update); daily expiry check (watchlist → mark down / return / remove); weekly reorder (velocity + min stock → draft → owner approves); exception triage (missing data, mismatches, low stock); offer publishing (operator/owner selects verified items → approves quantity/discount/window → pushes to buyer app).
- **Required screens/modules:** SKU master list with confidence flags; invoice review screen (image beside extracted rows); expiry watchlist with status buttons; reorder draft grouped by supplier; exception queue; owner dashboard (low stock, expiring, at-risk value, cash needed); offer approval screen.
- **Data objects:** as in Section 7.
- **Manual/operator steps:** physical counts, expiry date entry, supplier calls, price/cost confirmation, all approvals, marking-workflow documentation.
- **AI-assisted steps:** OCR extraction of invoices/receipts; Uzbek/Russian name normalization and alias mapping; duplicate detection; invoice-line-to-SKU matching; reorder draft math; dashboard summary text. AI drafts and flags; a human approves everything that changes stock, price, orders, or offers.
- **Non-goals:** checkout, fiscal receipts, payments, demand forecasting, auto-ordering, shelf photos as inventory source, multi-store chains, buyer-facing seller self-service.
- **Integrations allowed:** CSV/Excel export-import with the store's existing POS; Telegram bot for owner summaries; off-the-shelf OCR API; barcode scanning via phone camera or cheap USB scanner.
- **Integrations forbidden (v0.1):** POS APIs (until one POS repeats across ≥3 stores), Asl Belgisi/xTrace/E-Factura writes of any kind, supplier ordering APIs, payment systems.
- **Build substrate:** v0.1 should be Airtable/Sheets + Retool/AppSheet + a scripts folder, not the React Native codebase. Custom code only when the low-code version breaks under real use — that breakage is itself evidence of what to build.

## 7. Architecture And Data Model

Store Core sits between store reality and the buyer app. Minimal object set:

**SKU** — sku_id; name; aliases[] (uz/ru/supplier spellings); barcode/GTIN (nullable) + alias_barcodes[]; brand; category; unit; pack_size; marking_required (yes/no/unknown); supplier_id (primary); cost_price; sale_price; min_stock; reorder_multiple; expiry_tracked (bool); location; **stock_qty**; **stock_confidence** (high = counted/synced ≤7 days ago with clean receiving since; medium = counted ≤30 days, some unrecorded movement possible; low = stale or contradicted); last_counted_at; last_updated_by.

**Batch** — batch_id; sku_id; qty; expiry_date; received_via invoice_id; purchase_price; status (normal / watch / markdown / return / removed). Only for expiry-tracked SKUs.

**Supplier** — supplier_id; company; rep name/phone/Telegram; categories; delivery_days; min_order; payment_terms; return_policy; near-expiry policy; display/fridge/panel deal notes; next_action.

**Invoice (receiving)** — invoice_id; supplier_id; date; doc photo; ocr_status; total_stated vs total_computed; lines[] {raw_text, matched_sku_id | NEW, qty, unit_cost, flags}; validation_status; validated_by.

**SalesMirror** (Mode B/C only) — date; sku_id; qty_sold; revenue; source (csv/api); import_batch_id. Read-only; never edited by hand.

**ReorderDraft** — draft_id; supplier_id; lines[] {sku_id, current_stock, velocity, suggested_qty, reason}; cash_estimate; status (draft / edited / approved / ordered); owner_decision.

**ExpiryWatchlist** — view over Batch where expiry within N days; adds value_at_risk and assigned action.

**OfferableInventory** — offer_id; sku_id (or bag composition); qty_offered (≤ stock_qty, and only from stock_confidence = high); discount; pickup_window; seller_approved_by; approved_at; status (draft / live / paused / expired). **This is the only object the buyer app may read.**

**ReservationHold** — hold_id; offer_id; qty; buyer_ref; expires_at; status (held / fulfilled / released / failed). A hold decrements qty_offered, never stock_qty directly; fulfillment writes a stock adjustment; failure increments an exception and the store's mismatch counter.

**ExceptionQueue** — exception_id; type (missing barcode / duplicate / missing cost / OCR mismatch / count mismatch / low stock / near expiry / failed reservation / sync conflict); sku_id/invoice_id; severity; assigned_to; resolved_at.

**SyncLog** — sync_id; store_id; mode (A/B/C); direction; file/api ref; rows in/updated/conflicted; conflicts[] {sku_id, ours, theirs, resolution}.

**Source-of-truth rules by mode:**

- **Mode A (no reliable POS):** Store Core is the working truth. Stock = last physical count + validated receiving − recorded sales/removals. Confidence decays on a clock: no count or receiving event in 14 days → confidence drops a level automatically; low-confidence SKUs cannot be offered.
- **Mode B (POS with CSV/Excel):** POS is truth for **sales and sale prices**; Store Core is truth for **expiry, supplier, cost, aliases, confidence, offerable qty**. Stock reconciles on each import; deltas beyond tolerance (e.g., ±2 units or 10%) open a sync-conflict exception rather than silently overwriting. Push back to POS only whitelisted fields (name, barcode, category) via the vendor's own import format.
- **Mode C (POS with API):** POS is truth for sales/fiscal/stock movements; Store Core owns the normalized surplus/expiry/reorder/offer layer. All writes controlled and logged in SyncLog; marked-goods and fiscal fields are never written under any mode.

## 8. MVP Exclusions

| Excluded | Why |
|---|---|
| Full POS replacement | Owning checkout means owning fiscal modules, devices, offline mode, marked goods, payments, and 24/7 support in a market with ≥10 incumbents. Kills the company on support burden before validation. |
| Generic all-POS integration platform | Every local POS path is likely custom or vendor-gated. Build one adapter after one POS repeats across ≥3 pilot stores; before that, CSV. |
| Autonomous supplier ordering | Bad auto-orders trap the owner's cash; trust dies on the first overstock. Drafts + owner approval only. |
| Shelf computer vision | Fails on dense shelves, occlusion, lighting; even the enthusiast Reddit case peaked ~80% on clean photos. Useful only after clean SKU data exists — which is the actual product. |
| Dynamic AI pricing | No sales history of any quality exists yet; owner price trust is fragile; markdown suggestions on the expiry watchlist cover the real need. |
| Autonomous compliance / markirovka bot | Asl Belgisi errors create fiscal liability for the store. Document workflows, refer to specialists, never automate advice. |
| Broad buyer-marketplace expansion on unverified stock | Every phantom-stock reservation converts a curious buyer into a detractor. Expansion is gated on measured fulfillment reliability (Section 15). |
| Seller self-service SaaS onboarding | Stores can't self-serve data they don't have; the transcript's central lesson is that implementation, not software access, is the bottleneck. |

## 9. Assumptions

| # | Assumption | Confidence | Verification |
|---|---|---|---|
| A1 | The Kasaba store's mess (no system, notebooks, missing data) is typical of Tashkent mini-markets | Medium | 5-store audit, days 2–4 of sprint |
| A2 | Owners will pay setup + monthly for controllability | **Low** | Ask for money/deposit in every week-1 visit |
| A3 | Top 100–300 SKUs can be cleaned in ≤3 field days per store | Medium | Time 100-SKU samples; target ≤3 min/SKU |
| A4 | Staff will maintain receiving/expiry/scanning ≥2 weeks unassisted | **Low** | Day 45–60 unassisted maintenance window, measured |
| A5 | At least one local POS has a usable CSV/Excel path the owner can access | Medium | Test export/import in every POS-equipped store visited |
| A6 | OCR + validation beats manual invoice entry by ≥40% | Medium | 10–30 invoice test, timed both ways |
| A7 | Expiry + reorder workflows surface ≥1% of inventory value in recoverable losses | Medium | Value-at-risk measurement in micro-pilot |
| A8 | Buyers will reserve discounted mini-market goods | Low | Manual offer test at day 60; not before |
| A9 | Transcript money figures (~250–300M UZS inventory) are roughly right | Low | Re-ask the owner directly; ASR-flagged |
| A10 | Field playbook transfers to a non-founder operator | Low | Store #3 run by trained operator with founder observing |

## 10. Falsifiable Hypotheses

| Hypothesis | Proves it | Disproves it | How to test | Deadline |
|---|---|---|---|---|
| Seller pain is real and common | ≥3/5 stores show missing catalog data, untrusted stock, manual ordering, expiry losses | Stores mostly trust their POS; pain is cosmetic | 5 store audits with the standard checklist | Day 7 |
| Sellers pay | ≥1 store pays a deposit or signs for the sprint at a non-trivial price | Uniform praise, zero money movement after direct ask | Direct pricing ask + close attempt in every visit | Day 10 |
| SKU cleanup is feasible at cost | 100 SKUs cleaned in ≤5 hrs; duplicates/missing fields quantified; owner reacts to findings | >8 hrs per 100 SKUs, or barcode coverage so low every item is manual | Timed 100-SKU census per store | Day 7 |
| Staff maintains data | Receiving logged and expiry checked ≥12 of 14 unassisted days | Logging stops within 3 days of operator leaving | 2-week unassisted window post-pilot with daily remote check | Day 60 |
| POS/CSV path is workable | ≥1 POS exports sales/catalog and re-imports 20 cleaned SKUs without vendor intervention | Every export blocked, broken, or vendor-gated | Live export/import test in each POS store | Day 30 |
| Expiry/reorder produces ROI | ≥1% of inventory value flagged at-risk and acted on; reorder draft used for a real order | Watchlist finds trivial value; owner ignores drafts twice | Micro-pilot measurement over 2 weeks | Day 30 |
| Buyer offers are reliable | ≥20 manual reservations with ≥90% fulfillment | Mismatch/cancellation >10% despite verified stock | Manual offer publishing from pilot store inventory | Day 75 |
| Service scales beyond founder | Store #3 needs ≤50% of store #1's founder-hours; operator runs SOP alone | Every store needs founder-led custom work | Founder-hours log per store; operator-led store #3 | Day 90 |

## 11. Risks And Mitigations

| Risk | Why it matters | Early warning | Mitigation | Kill/continue threshold |
|---|---|---|---|---|
| No willingness to pay | Whole B2B thesis collapses | Owners enthusiastic but deflect every pricing question | Ask for deposit in week 1; offer money-back framing | 0/5 stores commit by day 10 → return to consumer app |
| Data decay after sprint | Recurring revenue and buyer-offer reliability both die | Receiving log gaps within first unassisted week | Daily Telegram nudge; 3-item staff checklist; owner dashboard shows staleness | <10/14 maintained days in 2 stores → service stays high-touch; no seller SaaS |
| POS vendor blocks access | CSV path is the whole Mode B strategy | Owner can't produce an export without calling vendor; vendor stalls | Meet 1–2 vendors as prospective partners by day 30; position as implementation ally, not rival | All pilot POS paths vendor-gated → Mode A only; revisit vendor partnership before day 90 |
| Compliance entanglement (Asl Belgisi/Soliq) | Fiscal errors create legal liability and reputation damage | Owner asks LastBite to "handle" marking or unofficial stock | Hard rule: document, never write; involve accountant/marking specialist; decline unofficial-flow work | Any request to touch fiscal records → refuse that scope, keep the rest |
| Service burden swallows founder | Field-ops hours preclude software and sales | Store #2 takes as long as store #1; founder doing data entry at midnight | Hours log; SOP after store #1; train operator before store #3 | Store #3 founder-hours >50% of store #1 → pause expansion, fix playbook |
| Buyer demand doesn't exist | Downstream marketplace has no pull even with clean data | Manual offers get views but no reservations | Treat day-60 offer test as a real experiment with targets | <5 reservations from first 20 offers → B2B tool stands alone; marketplace shelved |
| Phantom-stock reservations | One failed pickup poisons local word-of-mouth | Any reservation fails on verified stock | Offer only high-confidence stock; holds with expiry; per-store mismatch counter | Store mismatch >10% → store pulled from feed until re-audited |
| Single-conversation bias | Strategy built on n=1, ASR-noisy evidence | Stores 2–5 don't echo Kasaba pains | 5-store audit before any build; re-interview Kasaba owner to verify figures | <3/5 confirm → thesis disproved as stated; reassess |
| Trained operators leave | Playbook walks out the door | Operator #1 gets a better offer mid-pilot | SOPs/checklists as the asset, not the person; train in pairs when affordable | Not a kill risk; a documentation-discipline risk |

## 12. Go/No-Go Gates

**Day 7 — Sell & Audit gate.** ≥5 stores visited; ≥3 confirm ≥3 of the core pains on the checklist; ≥1 store commits to a paid pilot (deposit or signed agreement, any amount > 0); 100-SKU census achieved in ≤5 hours in at least one store; ≥10 invoices collected. **Fail → do not build anything; return to consumer app with findings documented.**

**Day 30 — Pilot Value gate.** 1 full micro-pilot delivered (100–300 SKUs, 10–30 invoices, reorder + expiry + supplier CRM + dashboard); OCR+validation measured ≥40% faster than manual entry; a POS export/import or no-POS workaround worked end-to-end; owner opened dashboard ≥3× in final week and used ≥1 reorder draft; at-risk value found ≥1% of inventory value; pilot price ≥ direct field cost. **Fail on payment/usage → service pivot or stop. Fail on POS only → continue in Mode A.**

**Day 60 — Maintenance gate.** 2–3 stores live; ≥2 stores maintained receiving/expiry ≥12 of 14 unassisted days; console v0.1 (low-code) used by operator daily; ≥1 CSV path repeated at a second store; ≥20 manual buyer reservations attempted with ≥90% fulfillment. **Fail on maintenance → no seller-facing software; service stays high-touch. Fail on buyer test → B2B continues standalone.**

**Day 90 — Repeatability gate.** 5–10 stores engaged; one POS path (or hardened CSV bridge) repeated ≥3×; ≥2 stores paying recurring support; store #3+ run by a non-founder operator at ≤50% of store-#1 founder-hours; stock confidence stays "high" for offered SKUs without founder intervention. **Pass → invest in real software (custom console + first POS adapter) and begin controlled buyer re-expansion. Fail → this is a boutique service or a stop; do not fund a software build.**

## 13. 7-Day Validation Sprint

**Targets:** 5 mini-markets in one district (cluster them — travel time is the enemy): the Kasaba Street store, 2 referred by its owner or nearby, 2 cold. Mix: ≥2 with some POS, ≥1 notebook-only.

- **Day 1 (Mon):** Assemble the kit: one-page offer with price menu (audit / sprint / monthly), store intake form, 100-SKU census sheet, invoice OCR template (photo → structured rows via off-the-shelf model), supplier CRM sheet, expiry checklist, reorder calculator, dashboard mockup. Call the Kasaba owner: re-verify inventory figure, clarify whether he's a customer or would-be partner, book the visit, ask for 2 referrals.
- **Day 2 (Tue):** Store visits #1–2. Each visit (~2–3 hrs): owner interview (tools used, SKU count, weekly hours on receiving/ordering, monthly write-off/discount loss, must-never-stockout items), timed 100-SKU sample census, photograph 5–10 invoices, identify POS + attempt a live export, list top 10 suppliers, **ask the pricing question directly and attempt a close**.
- **Day 3 (Wed):** Store visit #3. Evening: run OCR on collected invoices, measure accuracy and correction time vs manual entry; compile census stats (min/SKU, barcode coverage, missing-field rates, duplicates).
- **Day 4 (Thu):** Store visits #4–5. Evening: consolidate the audit table across all stores — pains confirmed, POS landscape, WTP responses, census metrics.
- **Day 5 (Fri):** Follow-ups and closing. Deliver each store a one-page findings teaser (duplicates found, missing data, estimated at-risk value) as the close. Target: 1 signed/deposited pilot. Call one POS vendor or implementer (ROFEEV/REGOS thread) as reconnaissance.
- **Day 6 (Sat):** Micro-pilot day 1 in the committed store: begin top-SKU cleanup, set up invoice intake, seed supplier CRM and expiry watchlist.
- **Day 7 (Sun):** Gate review against Day-7 thresholds (Section 12). Write a one-page decision memo: proceed to 30-day pilot / adjust offer and retry one week / kill and return to consumer app.

**Data to collect throughout:** minutes per SKU; barcode coverage %; missing cost/supplier/expiry rates; POS name/version/export result; monthly loss estimates; owner hours/week on ops; verbatim pricing reactions; founder hours per store.

**What to sell:** the sprint itself (discounted pilot price acceptable for store #1 only, in exchange for metrics and a reference). **Founder time budget:** ~35–40 hrs (5 × ~3 hr visits + ~10 hr kit + ~8 hr analysis + ~5 hr pilot start). **Decision at end of week:** the Day-7 gate, in writing.

## 14. 30/60/90-Day Path

**Day 30 — Store Control Pilot Kit (service-led).**
Deliverables: 1 completed micro-pilot (cleaned 100–300 SKUs, 10–30 validated invoices, 30–50 reorder SKUs tracked, 30–50 expiry SKUs watched, top-10 supplier CRM, owner dashboard, Telegram summary, staff SOP); documented POS finding per store; pricing learnings; SOP v1 written from timed reality.
Owner actions: founder delivers pilot personally; meets 1–2 POS vendors/implementers; re-tests pricing on stores #2–3.
Evidence required: Day-30 gate (Section 12).
Stop conditions: no payment and no serious commitment; SKU cleanup unpredictable (>2× time estimates); owner ignores all outputs.

**Day 60 — Seller Inventory Console v0.1 (internal, low-code).**
Deliverables: Airtable/Retool (or equivalent) console implementing Section 6 for 2–3 stores; no-POS mode + one CSV bridge; exception queue live; manual buyer-offer publishing from verified inventory (≥20 reservation attempts measured); 2-week unassisted maintenance experiment run and scored.
Owner actions: train first field operator; founder shifts ≥30% of time from field to console + sales; second store sold at full (non-pilot) price.
Evidence required: Day-60 gate.
Stop conditions: staff maintenance fails in both stores; console unused by own operator; second store unsellable at any viable price.

**Day 90 — Store Data Layer + one repeated POS/CSV path.**
Deliverables: 5–10 stores engaged; one POS adapter or hardened CSV bridge repeated ≥3×; sync logs + stock confidence + reservation holds live; paid recurring support package with ≥2 subscribers; operator-run onboarding SOP.
Owner actions: run store #3+ through an operator; negotiate one formal POS-vendor relationship; write the build-vs-boutique decision memo for the software investment.
Evidence required: Day-90 gate.
Stop conditions: no POS path repeats and Mode A data decays; recurring revenue < field cost; founder still personally required for every store.

## 15. Recommendation On Buyer Marketplace

- **Keep:** the existing app as-is — it is the demo, the buyer-side test harness, and the destination for verified offers. Keep reservation/pickup-code flows working. Fix breakage; ship nothing new.
- **Pause:** all new buyer-side feature work (search/filter polish, favorites, map enhancements, categories) and any user-acquisition spend. Every founder-hour here is taken from the validation sprint, and features built now will be rebuilt once the offer model changes to OfferableInventory.
- **Narrow:** when buyer testing resumes (day ~60), one district, 1–3 pilot stores, offers published manually from verified high-confidence stock only, every reservation tracked to fulfilled/failed.
- **Expansion becomes safe when, cumulatively:** ≥2 stores sustain high-confidence inventory for 4+ weeks with staff-maintained data; ≥50 reservations at ≥90% fulfillment; reservation holds and release logic proven against real stock movements; per-store mismatch monitoring with an automatic pull-from-feed rule in place. Before those four, marketplace growth manufactures broken promises at scale.

## 16. Next Action This Week

Five working days, in order:

1. **Mon:** Build the pilot kit (offer one-pager with three price points, intake form, census sheet, invoice OCR template, supplier CRM, expiry checklist, reorder calculator, dashboard mockup). **First call: the Kasaba Street owner** — re-verify the inventory figure, establish customer-vs-partner, book Tuesday, get 2 referrals.
2. **Tue:** Visit stores #1–2. Run the audit; **make the pilot offer with a real price and ask for a deposit** at both.
3. **Wed:** Visit store #3. Evening: OCR the collected invoices and time the comparison; start the **first artifact: one master audit spreadsheet** (per-store tab: census metrics, POS findings, WTP verbatims, loss estimates) — this becomes the SKU-master template.
4. **Thu:** Visit stores #4–5. Consolidate the cross-store audit table.
5. **Fri:** Follow up all five with findings teasers; close ≥1 paid/committed pilot; one reconnaissance call to a POS vendor/implementer; **hold the first gate review** against the Day-7 thresholds and write the one-page proceed/adjust/kill memo.

## 17. Uncertainties

Ranked by how much each can change the plan:

1. **Willingness to pay.** Nothing else matters if this fails. Fastest check: a direct priced ask with a deposit request in every visit this week. Resolvable in 5 days.
2. **Staff data maintenance.** Decides whether this is recurring software revenue or perpetual high-touch service. Fastest check: the 2-week unassisted window after the first pilot (day ~45–60). Cannot be resolved sooner — do not let early enthusiasm substitute for it.
3. **Pain generality beyond the Kasaba store.** n=1 today. Fastest check: the 5-store audit, days 2–4.
4. **POS/CSV accessibility.** Determines Mode B viability and the day-90 adapter bet. Fastest check: attempt a live export in every POS-equipped store this week; one vendor call by day 30.
5. **Buyer reservation demand.** The original LastBite thesis, still untested. Fastest check: 20 manual offers from the pilot store at day ~60; deliberately not earlier, since offers need verified stock to be a fair test.
6. **Service unit economics / founder leverage.** Decides scale ceiling. Fastest check: founder-hours log from day 1; operator-led store #3 by day 90.
7. **Kasaba speaker's actual role (customer / partner / channel to ROFEEV-style implementers).** Could reshape go-to-market from direct sales to partnership. Fastest check: Monday's phone call.
8. **Compliance blast radius (Asl Belgisi/Soliq) in target stores.** Determines how much inventory the service must not touch. Fastest check: count marked-category SKUs during each census; ask each owner how marked goods are processed today.

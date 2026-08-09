# AI-enabled strategy for Uzbekistan small-grocery systematization pilot

## 1. Bottom-line assessment

**Yes, AI can materially bolster the inventory/systematization opportunity, but only as a human-in-the-loop accelerator.** It should not be sold first as “AI for grocery,” and it should not start as a standalone POS, automatic ordering engine, or shelf-computer-vision system.

The strongest first product is still the prior memo’s recommendation: **a service-backed store systematization sprint**. The transcript shows the core pain clearly: the store may hold roughly 250–300 million UZS of goods, cannot afford to close for 7–10 days, struggles with marking/tax/product-code workflows, still uses notebook/manual memory, wants “под ключ” setup, orders by phone, and has losses from expiry/damage/returns. Source context: transcript lines 5–24, 28–47, 132–139, 173–185, 229–244, 256–294.

AI is useful because it can make the service faster and more repeatable:

1. **Faster inventory intake:** scan barcodes, OCR invoices, parse supplier receipts, convert photos/voice notes into structured tasks.
2. **SKU cleanup:** detect duplicates, normalize Uzbek/Russian product names, units, pack sizes, brands, and category labels.
3. **Exception management:** surface missing barcode, missing supplier, missing cost price, low confidence OCR, negative stock, expiry risk, and marking/category issues.
4. **Reorder assistant:** start with rules and owner approval, not black-box forecasting.
5. **Owner dashboard:** summarize the few things the owner cares about: low stock, today’s sales, expiring goods, missing data, supplier follow-ups, and display/shelf deal opportunities.

The right framing is:

> **“We systematize your store in 7–10 days using existing POS/tools, field operators, and AI-assisted data cleanup.”**

Not:

> “We built an AI POS.”

---

## 2. What existing solution categories tell us

| Category                                                       | Examples / evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | What to do                                                                                                                                                                                              |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Enterprise grocery AI replenishment and fresh optimization** | Afresh positions itself around grocery store ordering, production planning, inventory management, demand forecasting, and fresh/waste optimization. RELEX similarly focuses on grocery forecasting, replenishment, freshness, pricing, promotions, store operations, planogram, and data quality at scale. ([afresh.com][1])                                                                                                                                                                                                                                                                                                                   | **Copy workflows, do not buy/build for MVP.** These validate that grocery ordering, freshness, and replenishment are valuable, but they are too enterprise-heavy for small Uzbek stores with weak data. |
| **Independent-grocer POS/back office**                         | Vori is built for independent grocers and connects POS, payments, loyalty, ordering, inventory, invoice processing, supplier data, and pricing automation. It also highlights that go-live depends heavily on data/setup. ([vori.com][2])                                                                                                                                                                                                                                                                                                                                                                                                      | **Copy architecture and onboarding philosophy.** The lesson is integrated checkout + back office + ordering, but the first Uzbek wedge should sit around local POS rather than replace it.              |
| **Local Uzbek POS/fiscal/store automation**                    | E-POS supports fiscalization, QR/card payments, CRM/ERP integrations, grocery/FMCG workflows, scanners, scales, real-time stock, Excel/1C/CRM catalog import, and ASL Belgisi integration. ([E-POS Systems][3]) REGOS has integrations for barcode/QR receiving, returns, write-off, inventory, labeling/marking, AI product import from documents/files, minimum-stock Telegram bot, item checker, and sales alerts. ([REGOS Integrations Catalog][4]) Uzbekistan automation vendors also describe Regos, EasyTrade, Optimo, and Sellerpeak24 as already present local software options for convenience stores/minimarkets. ([Mertech.uz][5]) | **Partner/use, do not compete first.** Pick one or two POS systems for pilot compatibility. Build a service/process/data layer around them.                                                             |
| **Online cash register / FDO / accounting ecosystems**         | ERA offers online cash register, accounting system, FDO, registration/configuration support, retail accounting, sales/cashier reports, and scanners that read 1D, 2D, and GS1 codes. ([pos.era.uz][6])                                                                                                                                                                                                                                                                                                                                                                                                                                         | **Treat as infrastructure.** The pilot should document which cash register/POS the store already has and whether export/import is possible.                                                             |
| **Asl Belgisi / marking / E-Factura workflows**                | Asl Belgisi’s official help center lists regulated product groups and explains that product group affects marking rules, timelines, code format, and circulation rules; listed groups include tobacco, alcohol, beer, household appliances, medicines, water/soft drinks, and fertilizers/plant protection products. ([help.crpt-turon.uz][7]) Smartup claims an official marking solution integrated with Asl Belgisi and E-Factura for water/drinks workflows. ([smartup24.com][8])                                                                                                                                                          | **Use specialists/partners. Do not improvise compliance.** For MVP, map the workflow and route to existing tools. Avoid taking legal responsibility for marking submissions.                            |
| **Barcode and data capture**                                   | GS1 Digital Link is the standard method for encoding identifiers like GTINs, GLNs, SSCCs, batch numbers, serial numbers, and expiry dates. ([GS1][9]) Scandit ShelfView combines image recognition, barcode scanning, cloud analytics, and hybrid capture. ([scandit.com][10])                                                                                                                                                                                                                                                                                                                                                                 | **Use basic scanning now; advanced barcode/vision later.** A 2D scanner or phone scan is more realistic than shelf CV in the first pilot.                                                               |
| **Invoice/OCR/document extraction**                            | Google Document AI extracts structured and unstructured data from documents and supports custom extractors/OCR. ([Google Cloud][11]) OpenAI Structured Outputs can force model responses to match a JSON schema, which is useful for turning invoice/product text into validated structured records. ([OpenAI Developers][12])                                                                                                                                                                                                                                                                                                                 | **Use off-the-shelf AI now, but always validate.** OCR should create draft line items; a human approves before POS import.                                                                              |
| **Shelf intelligence / computer vision / robots**              | Scandit, Trax, Simbe, and Pensa all target shelf visibility, out-of-stock detection, planogram compliance, and shelf analytics. Scandit explicitly uses mobile, fixed cameras, and robots as capture options. ([scandit.com][10])                                                                                                                                                                                                                                                                                                                                                                                                              | **Avoid as core MVP.** Shelf CV is seductive but fragile in small shops: lighting, angles, occlusion, mixed shelves, and staff workflow will likely break reliability.                                  |
| **Expiry and markdown systems**                                | Shelflife focuses on expiration-date capture, batch-level inventory, targeted markdowns, and AI optimization by freshness window. ([shelflife.ai][13])                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | **Copy workflow manually first.** Record expiry for selected high-risk categories; automate only after the store proves it can maintain batch/date data.                                                |
| **Supplier/deal/trade-marketing workflows**                    | Smartup has FMCG/distributor and trade-marketing capabilities, including marking and AI shelf recognition modules. ([smartup24.com][8]) The transcript strongly emphasizes supplier contacts, shelves, displays, fridges, bank panels, Pepsi/Red Bull/water/cigarette shelves, and extra income opportunities. Source context: transcript lines 57–93, 178–185, 197–200.                                                                                                                                                                                                                                                                       | **Manual CRM first.** This may be as valuable as inventory software. Capture supplier contacts, display terms, return policies, and delivery schedules.                                                 |

---

## 3. Practical AI-enabled workflow architecture for the first pilot store

### Core principle

The pilot should have **three layers**:

1. **Existing systems layer:** current POS/cash register, scanner, Excel export/import, Asl Belgisi/E-Factura tools, supplier invoices, Telegram/phone ordering.
2. **Systematization service layer:** field team, checklists, data cleanup, SKU census, supplier map, expiry process, training.
3. **AI accelerator layer:** OCR, SKU matching, duplicate detection, structured extraction, reorder suggestions, dashboard summaries, exception queue.

AI should not directly change legal records, POS inventory, supplier orders, or prices without human approval.

---

## 4. Data model for the pilot

Use a simple database, Airtable, Google Sheets, Retool, AppSheet, or a lightweight internal web app. The goal is not elegance; it is repeatability.

### A. SKU master

Fields:

* Internal SKU ID
* Product name, Uzbek/Russian variants
* Brand
* Category / subcategory
* Unit: piece, kg, liter, bottle, pack, block, carton
* Pack size
* Barcode / GTIN
* Marking required? yes/no/unknown
* Asl Belgisi product group, if relevant
* Supplier
* Cost price
* Sale price
* Margin estimate
* Current stock
* Minimum stock
* Reorder multiple
* Shelf/fridge/display location
* Expiry tracking required? yes/no
* Confidence score: verified / AI-suggested / needs review
* Last updated date

### B. Inventory batch table

For expiry-sensitive goods:

* SKU ID
* Quantity
* Batch/lot, if available
* Expiry date
* Purchase date
* Supplier
* Invoice ID
* Purchase price
* Shelf/fridge location
* Status: normal / watch / markdown / remove / returned / written off

### C. Invoice / receiving table

* Invoice ID
* Supplier
* Date
* Document photo/PDF
* OCR status
* Total invoice value
* Line items
* Matched SKU ID
* Quantity
* Unit cost
* Suggested sale price
* Validation status
* Exceptions

### D. Sales/POS table

* Date
* SKU ID
* Quantity sold
* Revenue
* Discount
* Gross margin proxy, if cost is known
* Cashier/shift, if available

### E. Supplier CRM

* Supplier/company
* Rep name
* Phone/Telegram
* Categories supplied
* Delivery days
* Minimum order
* Payment terms
* Return policy
* Near-expiry/damaged return policy
* E-Factura/Asl Belgisi support
* Shelf/display/fridge deal potential
* Last contact
* Next action

### F. Task / exception queue

Every systemization sprint should end with a daily task list:

* Missing barcode
* Duplicate SKU
* Missing supplier
* Missing cost price
* Missing sale price
* Marking category uncertain
* Invoice OCR mismatch
* Count mismatch
* Low stock
* Near expiry
* Supplier follow-up
* Display/fridge/shelf deal follow-up
* Staff training issue

This task queue is where AI is most useful: not replacing the operator, but telling the operator where to focus.

---

## 5. Recommended pilot workflow

### Step 1: Pre-visit intake

Before entering the store, collect:

* Current POS name and version
* Whether the store uses POS for all sales or only some sales
* POS export/import capability
* Existing Excel/catalog file, if any
* 10–30 recent supplier invoices/receipts
* Photos of shelves only as context, not as a primary CV input
* List of main suppliers and phone numbers
* Owner’s top 20 “always must be in stock” products
* Known problem categories: cigarettes, water/drinks, dairy, sweets, sausage/meat, alcohol/beer if applicable, household goods, etc.
* Current ordering method: phone, Telegram, agent visit, app, paper

### Step 2: Inventory intake

Use a field team with phones/scanners.

Process:

1. Walk category by category.
2. Scan barcode where present.
3. Enter quantity.
4. Take one product photo only when name/barcode/pack size is ambiguous.
5. Mark shelf/fridge/display location.
6. Flag whether expiry tracking is needed.
7. For marked categories, scan or note the code type, but do not attempt legal submission unless using the store’s existing approved workflow.

AI role:

* Suggest normalized product name.
* Detect duplicate names/barcodes.
* Extract pack size from name/photo/invoice text.
* Translate/standardize Uzbek/Russian labels.
* Flag missing fields.

Human role:

* Approve SKU identity.
* Confirm unit and pack size.
* Confirm quantity.
* Confirm category and sale price.

### Step 3: SKU cleanup

Create a clean catalog that can be imported into the POS or used alongside it.

Prioritize:

1. Top-selling / high-turnover products.
2. High-value products.
3. Marked/compliance-sensitive products.
4. Expiry-sensitive products.
5. Supplier-deal products: drinks, cigarettes where legal, snacks, branded fridges/displays.

Do not try to perfect the entire store in the first week. The first pilot should prove that the team can clean and maintain the **top 100–300 SKUs** first, then expand.

### Step 4: Barcode and marking scan

Use 1D/2D scanners or phone scanning. Do not build custom marking compliance logic initially.

Workflow:

* Record barcode/GTIN for normal products.
* Record “marking-relevant” status for Asl Belgisi categories.
* Route marked product handling to the existing POS/Asl Belgisi/E-Factura/Smartup/E-POS/REGOS workflow.
* Build an SOP: “When receiving marked water/drinks/tobacco/alcohol/beer/etc., staff must do X in the approved system.”

Reason: Asl Belgisi product groups affect marking rules and code formats, so this is a compliance workflow, not just a database field. ([help.crpt-turon.uz][14])

### Step 5: OCR invoice intake

Use Google Document AI, OpenAI vision + structured outputs, Azure/OpenAI, REGOS Didox import, or similar.

Workflow:

1. Staff photographs invoice/receipt.
2. OCR extracts supplier, date, invoice number, line items, quantities, unit costs, totals.
3. AI matches line items to existing SKU master.
4. System flags mismatches:

   * New SKU
   * Unmatched barcode
   * Quantity mismatch
   * Unit mismatch
   * Total does not reconcile
   * Suspicious price change
5. Human validates.
6. Approved rows are imported into POS or stored in the pilot database.

Rule: **OCR creates drafts, not truth.** The validation screen is the product.

### Step 6: POS sync

Do not start with deep integration.

Phase 1:

* Export POS catalog/sales as Excel/CSV where possible.
* Import cleaned SKU catalog manually if POS supports it.
* Record sales manually for top SKUs if export is impossible.

Phase 2:

* Build one adapter for the most common POS found in visits.
* Use API only if the vendor supports it reliably.

Phase 3:

* Partner with POS vendor for formal integration.

The local market already has systems with stock tracking, catalog import, fiscalization, scanners, and integrations, so the pilot should not rebuild those basics. ([E-POS Systems][3])

### Step 7: Reorder assistant

Start with a simple, conservative reorder assistant.

Inputs:

* Current stock
* Minimum stock
* Sales velocity over last 7/14/30 days, if available
* Supplier delivery day
* Minimum order quantity
* Owner’s manual override
* Cash constraint
* Seasonality note, if obvious

Output:

* Draft order by supplier
* “Why” explanation
* Risk level: stockout risk / normal / overstock risk
* Telegram/WhatsApp-ready message
* Owner approval button/checklist

Do not auto-send orders in the pilot. The transcript shows desire for automatic supplier ordering, but current ordering still happens by phone/agent calls. Source context: transcript lines 256–294. The first reliable version should be **order drafts**, not autonomous orders.

### Step 8: Expiry and markdown workflow

Start narrow.

Track expiry only for categories where the pain is visible:

* Dairy
* Sausage/meat/chilled goods
* Cakes/sweets
* Water/drinks where relevant
* Frozen/chilled products
* High-value slow movers

Workflow:

1. Record expiry date at receiving or weekly shelf check.
2. Create FEFO list: first-expiring, first-out.
3. Trigger tasks:

   * 14 days left: watch
   * 7 days left: owner review
   * 3 days left: markdown/display
   * expired: remove/write-off/return if supplier accepts
4. Record outcome: sold, returned, discounted, discarded.

Do not begin with AI dynamic markdown optimization. Copy the Shelflife concept of batch-level expiry and targeted markdowns, but implement it manually first. ([shelflife.ai][13])

### Step 9: Supplier contact/deal CRM

This may become a major differentiator because the transcript repeatedly points to hidden revenue from shelves, displays, fridges, bank panels, and supplier relationships.

Workflow:

* Build supplier list.
* Record rep contacts.
* Ask each supplier:

  * Do you provide fridge/display/shelf support?
  * Do you pay for placement?
  * Do you accept returns?
  * Do you accept near-expiry swaps?
  * Do you support E-Factura/Asl Belgisi?
  * Do you have an app or Telegram ordering channel?
* Create a deal pipeline:

  * Pepsi/water/fridge/display
  * Red Bull/snacks
  * Bank/card/payment panel
  * Cigarette shelf only if legally appropriate
  * Ice cream/freezer
  * Dairy/branded fridge
  * Local bakery/bread delivery

AI role:

* Draft call scripts and Telegram messages.
* Summarize supplier terms.
* Flag follow-ups.

Human role:

* Negotiate.
* Verify legality.
* Avoid conflicts of interest.

### Step 10: Owner dashboard

The dashboard should be very simple.

Daily owner view:

* Yesterday/today sales
* Top 10 sellers
* Low-stock list
* “Products that will run out before next delivery”
* Near-expiry value
* Items needing markdown/removal
* Missing data tasks
* Supplier orders awaiting approval
* Supplier/display deal opportunities
* Cash needed for tomorrow’s replenishment

The owner does not need “AI forecast accuracy.” The owner needs: **what to buy, what is missing, what is expiring, who to call, and what money is at risk.**

---

## 6. AI feature decision table

| Feature                                                            |                        Decision | Why                                                                                                   |
| ------------------------------------------------------------------ | ------------------------------: | ----------------------------------------------------------------------------------------------------- |
| SKU normalization, duplicate detection, Uzbek/Russian name cleanup |                   **Build now** | High leverage for field team; low risk if human approves.                                             |
| Barcode scanning                                                   |           **Use off-the-shelf** | Hardware/POS/mobile scanning already exists; build only the cleanup workflow around it.               |
| Product lookup from barcode                                        |        **Manual first / later** | Useful, but Uzbek/local product data may be incomplete. Validate coverage before relying on it.       |
| Asl Belgisi / marking workflow                                     | **Use off-the-shelf / partner** | Compliance-sensitive. Map the process; do not become the compliance engine in MVP.                    |
| E-Factura integration                                              | **Use off-the-shelf / partner** | Smartup and local systems already address parts of this workflow. ([smartup24.com][8])                |
| OCR invoice extraction                                             |       **Use off-the-shelf now** | Strong value; do not train a custom model. Build validation and POS import around it.                 |
| Invoice-to-SKU matching                                            |                   **Build now** | This is your operational glue: OCR row → SKU master → exception queue.                                |
| POS replacement                                                    |                       **Avoid** | Existing local POS/fiscal products already exist; replacing them slows discovery.                     |
| POS CSV/API adapter                                                |       **Build now, but narrow** | Build for only the pilot POS. Avoid generic integrations until evidence shows which systems dominate. |
| Reorder assistant                                                  |      **Build now, rules-based** | Start with min/max + sales velocity + supplier schedule + owner approval.                             |
| AI demand forecasting                                              |                       **Later** | Needs clean sales history, reliable stock counts, and stable POS usage.                               |
| Auto-sending supplier orders                                       |                       **Later** | Owner must approve. Supplier acceptance and cash constraints must be validated first.                 |
| Expiry tracking                                                    |                **Manual first** | Valuable, but only if staff reliably records expiry dates.                                            |
| Expiry OCR/date capture                                            |                       **Later** | Test manually before automating. Expiry labels vary and can be hard to capture.                       |
| Markdown recommendations                                           |     **Manual first / later AI** | Start with simple rules. AI markdown optimization requires sell-through data.                         |
| Shelf photo product extraction                                     |                   **Avoid now** | The market scan already warns about shelf angle, resolution, occlusion, and item separation problems. |
| Shelf CV / robots                                                  |               **Avoid for MVP** | Better suited to chains or CPG field teams, not first small-store pilot.                              |
| Supplier CRM                                                       |           **Build now, simple** | High value and low technical risk.                                                                    |
| Supplier Telegram/message drafts                                   |          **Build now optional** | Useful as staff accelerator, but not core.                                                            |
| Owner dashboard                                                    |                   **Build now** | Forces clarity and makes value visible.                                                               |
| AI “chat with my store” assistant                                  |                       **Later** | Nice demo, but first make the underlying data correct.                                                |
| Autonomous price changes                                           |                   **Avoid now** | Too risky for margin, customer trust, and staff control.                                              |
| Legal/tax advice bot                                               |                       **Avoid** | Use accountants/POS/marking specialists instead.                                                      |

---

## 7. Main risks

### 1. Bad source data

If sales are not consistently recorded in POS, inventory counts are wrong, or invoices are missing, AI will produce confident nonsense. This is the biggest risk.

Mitigation: build an exception queue and confidence labels. Never hide uncertainty.

### 2. POS integration friction

Local POS systems may have limited APIs, inconsistent exports, or difficult catalog import rules.

Mitigation: start with CSV/manual import. Build only one integration after the pilot identifies the dominant POS.

### 3. Marking/compliance liability

Asl Belgisi and E-Factura workflows can affect legal circulation of goods. The transcript’s “markirovka / eco-code / Soliq base” pain is real, but the ASR is noisy and should not be treated as a legal specification.

Mitigation: document the workflow with a POS/marking specialist. Use existing approved tools.

### 4. Staff discipline

A system fails if cashiers bypass scans, receiving is not recorded, or expiry dates are not entered.

Mitigation: design the process around the store’s real behavior. Use daily checklists and owner dashboard, not complex software.

### 5. Reorder assistant overstock risk

If the assistant recommends too much inventory, the store’s cash gets trapped.

Mitigation: owner approval, conservative minimum stock, cash constraint field, and “why this order” explanation.

### 6. OCR error risk

Uzbek/Russian invoices, stamps, supplier formats, handwriting, low-quality photos, and mixed units will produce errors.

Mitigation: OCR only drafts. Validate totals and line items before import.

### 7. Expiry tracking labor burden

Recording expiry by batch can be too much work for a small store.

Mitigation: only track high-risk categories first. Do not attempt all SKUs.

### 8. Supplier cooperation

Suppliers may prefer phone calls, agent visits, or their own apps. They may not accept auto-orders or return near-expiry goods.

Mitigation: supplier CRM first; integration later.

### 9. Shelf CV disappointment

The user’s market scan already identifies the problem: shelf photos are hard because of angle, occlusion, lighting, resolution, and mixed products. Starting here would create a “cool demo, bad operations” risk.

Mitigation: avoid shelf CV as core MVP.

### 10. Unit economics

A service-heavy sprint can become labor-intensive. The business only works if a repeatable playbook reduces implementation time and if stores pay enough.

Mitigation: track minutes per SKU, total field hours, correction rate, and willingness to pay from the first pilot.

---

## 8. Validation tests for 3–5 store visits

### A. Inventory/SKU census test

For each store, sample 100 SKUs.

Measure:

* Minutes per SKU to scan/count/clean
* % with barcode
* % with duplicate or inconsistent names
* % missing cost price
* % missing supplier
* % requiring marking attention
* % expiry-sensitive
* % not present in POS

Pass signal:

* Field team can clean 100 SKUs in a predictable time.
* Owner sees value immediately from duplicate/missing/low-stock findings.

### B. OCR invoice test

Collect 10–30 invoices/receipts across suppliers.

Measure:

* Header extraction accuracy: supplier/date/invoice number/total
* Line item extraction accuracy
* Quantity/unit/cost accuracy
* Total reconciliation success
* Human correction time per invoice
* % rows matched to existing SKU

Pass signal:

* OCR + validation is at least 40–60% faster than manual entry.
* Validated totals reconcile reliably.

### C. Barcode/marking test

Scan 200 products across categories.

Measure:

* % 1D barcode readable
* % 2D/marking code readable
* % products with no usable code
* Which categories trigger Asl Belgisi workflows
* Whether current POS can process those codes

Pass signal:

* Basic scanning materially speeds intake.
* Marked-category handling can be documented without custom compliance development.

### D. POS sync test

For each store:

* Export catalog
* Export 7–30 days sales, if possible
* Try importing 20 cleaned SKUs
* Check whether stock updates after sales
* Check whether cashiers actually scan items

Pass signal:

* At least one local POS path supports practical export/import.
* Store behavior matches POS records enough to support reorder alerts.

### E. Reorder assistant test

Pick 30–50 fast-moving SKUs.

For 7–14 days:

* Compare owner’s actual orders vs assistant draft orders
* Track stockouts
* Track overstock
* Track supplier delivery delay
* Ask owner whether the draft saved time

Pass signal:

* Owner accepts or edits the assistant’s order draft.
* Assistant catches stockouts earlier than current manual process.

### F. Expiry test

Pick 30–50 high-risk SKUs.

Measure:

* Time to record expiry dates
* % products with clearly visible dates
* Current value at risk within 3/7/14 days
* Number of items discounted/returned/discarded
* Whether staff can maintain the list weekly

Pass signal:

* The process finds real money at risk.
* Staff can maintain it without daily consultant involvement.

### G. Supplier CRM test

For each store:

* List top 10 suppliers
* Record contacts and order method
* Ask return policy
* Ask display/fridge/shelf deal policy
* Ask whether they accept Telegram/app/structured orders
* Identify 3 monetization opportunities

Pass signal:

* At least one supplier/display/fridge/payment-panel opportunity is actionable.
* Supplier data becomes part of the store systematization offer, not a side note.

---

## 9. Evidence needed from the next 3–5 store visits

Collect these in a structured form.

### Store profile

* Store size
* Approximate SKU count
* Approximate inventory value
* Daily revenue estimate
* Number of employees
* Owner involvement
* Opening hours
* Nearby competition

### Current system

* POS/cash register name
* Is every sale scanned?
* Is inventory tracked or only sales?
* Can catalog be exported?
* Can catalog be imported?
* Is there a scanner?
* Are scales integrated?
* Is there Excel/1C/CRM?
* Is there notebook/manual tracking?

### Data quality

* Number of duplicate SKUs
* Missing barcode rate
* Missing cost rate
* Missing supplier rate
* Negative/incorrect stock examples
* Product categories not in POS
* Local/unbarcoded goods: bread, produce, unpacked goods, repacked goods

### Receiving process

* How goods arrive
* Who receives goods
* How invoice is handled
* Whether E-Factura is used
* Whether marked codes are checked
* Time to receive goods
* Error examples

### Ordering process

* Number of daily/weekly supplier calls
* Who decides orders
* Supplier delivery frequency
* Minimum order constraints
* Common stockouts
* Products the owner fears running out of

### Expiry/damage process

* Categories with expiry losses
* Monthly write-off estimate
* Damaged/water-damaged products
* Return policy by supplier
* Discounting practices
* Whether near-expiry products are currently tracked

### Supplier/deal economics

* Existing fridges/displays/shelves
* Any placement income
* Bank/payment panel income
* Supplier-provided equipment
* Conditions required for deals
* Untapped contacts

### Willingness to pay

Ask directly:

* Would you pay for a 7–10 day cleanup sprint?
* What result would make it worth paying?
* Would you pay monthly support?
* Would you pay success fee from supplier/display deals?
* Would you prefer fixed price, monthly, or commission?

Do not rely on the transcript’s dollar amounts yet. Treat them as hypotheses, because the ASR is noisy and context is inconsistent.

---

## 10. Next 7 days

### Day 1: Define the pilot offer

Create a one-page offer:

> **“Store Systematization Sprint: inventory cleanup, POS/catalog setup, invoice intake, reorder list, expiry control, supplier CRM, and owner dashboard in 7–10 days.”**

Deliverables:

1. Cleaned SKU master for priority SKUs.
2. POS/export/import review.
3. Invoice OCR + validation workflow.
4. Low-stock/reorder sheet for top SKUs.
5. Expiry watchlist for high-risk products.
6. Supplier contact/deal CRM.
7. Owner dashboard.
8. Staff checklist and training.

### Days 2–4: Visit 3–5 stores

Run the validation tests above. Do not sell software. Sell/validate the sprint.

Specific goal:

* Find whether the pain repeats.
* Find which POS systems dominate.
* Find whether stores will pay for implementation.
* Find whether AI reduces implementation labor.

### Days 3–5: Prepare pilot kit

Pilot kit:

* Phone with good camera
* 2D barcode scanner or scanner-enabled Android device
* Google Sheet/Airtable/Retool base
* Invoice upload form
* OCR extraction template
* SKU cleanup template
* Supplier CRM template
* Expiry checklist
* Reorder calculator
* Owner dashboard mockup
* Printed staff SOP

### Days 5–7: Start one live micro-pilot

Scope:

* Top 100–300 SKUs
* 10–30 invoices
* 30–50 reorder SKUs
* 30–50 expiry-sensitive SKUs
* Top 10 suppliers

Success by end of week:

* Owner sees a before/after catalog.
* At least one invoice is OCR’d and validated.
* Low-stock list is generated.
* Expiry risk list is generated.
* Supplier CRM has real contacts and next actions.
* You know whether this can be a paid sprint.

---

## 11. Next 30 days

### Week 1–2: Complete one full pilot

Deliver a complete store systematization package for one store:

* Cleaned catalog for priority assortment
* POS import/export method
* Invoice intake process
* Reorder assistant for top items
* Expiry workflow
* Supplier/deal CRM
* Owner dashboard
* Staff training
* Before/after case study

Track:

* Field hours
* Minutes per SKU
* OCR correction time
* Number of missing/duplicate SKUs fixed
* Low-stock items found
* Expiry value found
* Supplier deal opportunities found
* Owner willingness to pay

### Week 2–3: Build the internal “systematization console”

This should be an internal operator tool, not a customer-facing SaaS yet.

Modules:

1. SKU master
2. Invoice OCR validation
3. POS import/export
4. Reorder assistant
5. Expiry task list
6. Supplier CRM
7. Owner dashboard
8. Exception queue

### Week 3–4: Partner and price

Do not scale until you have partners.

Target partners:

* 1–2 POS vendors or implementers
* 1 fiscal/marking specialist
* 1 hardware/scanner supplier
* 5–10 supplier reps in beverage/snack/dairy/ice cream/bank/payment categories
* 1 accountant/tax workflow advisor

Pricing tests:

* One-time cleanup fee
* Monthly support fee
* Supplier/display success fee
* Combined setup + support package

Possible offer structure:

1. **Audit only:** low-cost, 1–2 days.
2. **Systematization sprint:** 7–10 days, fixed fee.
3. **Monthly support:** reorder/expiry/invoice/POS hygiene.
4. **Supplier monetization add-on:** success fee or commission where legal and transparent.

### 30-day go/no-go criteria

Proceed only if most of these are true:

* At least 3 of 5 visited stores confirm the pain.
* At least 1 store pays or gives a serious commitment.
* Top 100–300 SKU cleanup can be done predictably.
* OCR reduces invoice entry effort materially after validation.
* POS data can be exported/imported or worked around.
* Owner uses the dashboard or reorder list for at least 1–2 weeks.
* Expiry tracking finds real at-risk value.
* Supplier CRM produces at least one tangible deal or operational improvement.
* Delivery economics suggest the sprint can be profitable with trained field staff.

---

## 12. Final strategic recommendation

The best AI-enabled path is:

> **A human-in-the-loop store systematization service, powered by AI data-capture and cleanup tools, integrated around existing Uzbek POS/fiscal/marking systems.**

Build now:

* SKU cleanup assistant
* Invoice OCR validation workflow
* Reorder draft assistant
* Expiry task list
* Supplier CRM
* Owner dashboard
* Exception queue

Use off-the-shelf:

* POS/cash register
* Scanners
* OCR/document AI
* Asl Belgisi/E-Factura-capable tools
* Existing POS integrations where available

Manual first:

* Expiry tracking
* Supplier negotiation
* Marking workflow SOP
* Store layout/display monetization
* Staff training

Later:

* Forecasting
* Auto-ordering
* Expiry OCR
* Deeper POS integrations
* Supplier integrations

Avoid for MVP:

* Full POS replacement
* Autonomous compliance
* Shelf computer vision as the core product
* AI dynamic pricing
* “AI knows your inventory from photos” claims

The opportunity is not that small Uzbek stores lack AI. The opportunity is that they lack **clean operating systems, disciplined data, supplier workflows, and trained implementers**. AI can make the implementers faster, but the product should be sold as operational cleanup and profit control, not as AI magic.

[1]: https://www.afresh.com/ "Afresh - A New Era for Grocery"
[2]: https://www.vori.com/ "Best Grocery Store POS & All-in-One Operations Software | Vori"
[3]: https://epos.uz/en "A cash register that just works — E-POS Systems"
[4]: https://apps.regos.uz/?lang=en "All integrations - REGOS Integrations Catalog"
[5]: https://mertech.uz/blog-en/commercial-equipment/store-automation-in-uzbekistan-equipment-and-solutions-for-retail-en/ "Store Automation in Uzbekistan — Solutions for Retail and Convenience Stores"
[6]: https://pos.era.uz/en/pos "Online cash register, trade and catering"
[7]: https://help.crpt-turon.uz/hc/en-us/categories/4416610961809-Legislation "Legislation – Help Center Asl Belgisi"
[8]: https://smartup24.com/tpost/zblhh3xd81-marking-of-water-and-drinks-in-uzbekista "Water and Beverage Marking in Uzbekistan"
[9]: https://www.gs1.org/standards/gs1-digital-link?utm_source=chatgpt.com "GS1 Digital Link"
[10]: https://www.scandit.com/products/shelfview/ "ShelfView: Vision AI-Powered Shelf Intelligence"
[11]: https://cloud.google.com/document-ai "Document AI | Google Cloud"
[12]: https://developers.openai.com/api/docs/guides/structured-outputs "Structured model outputs | OpenAI API"
[13]: https://www.shelflife.ai/ "Shelflife | Automated Expiration Date Tracking for Grocery Stores"
[14]: https://help.crpt-turon.uz/hc/en-us/articles/15528687847057--Product-Group-Reference-Value-Mandatory "⚠️ Product Group (Reference Value, Mandatory) – Help Center Asl Belgisi"

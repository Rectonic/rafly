# Rafly, President Tech Award 2026 application answers

Version dated 31 August 2026. Track: Best Startup Project.

## Project name, short

```text
Rafly
```

Founder check: use the Latin spelling Rafly in the form and every attachment.

## Project name, full

```text
Rafly, stock control and a marketplace for human-approved surplus in independent retail
```

Founder check: if the field asks for the registered company name, replace this with `[FULL LEGAL NAME]`.

## One-sentence description, up to 200 characters

```text
Rafly creates reliable digital stock records for independent shops and helps them sell human-approved surplus through a discounted marketplace.
```

Founder check: the sentence is written with room for a character counter that includes spaces.

## Short description, up to 500 characters

```text
Rafly is launching with a signed cohort of 50 shops. The pilot covers stock monitoring and stock analytics. A 7-10 day Store Control Sprint delivers a fast full inventory, a working catalogue, expiry control, and turnkey launch support. Rafly works with any POS system or none. Control gives the owner reliable stock data, while Market sells only surplus that the shop has personally approved.
```

Founder check: keep the 50-shop cohort and the pilot scope if the form counter requires a shorter version.

## Full project description, 1,500 to 3,000 characters

```text
Rafly is launching with a signed cohort of 50 shops. The pilot covers stock monitoring and stock analytics. The team conducts a fast full inventory at each shop and provides turnkey launch support. Rafly works with any POS system, including shops with no POS. The operator extracts the data that exists, rebuilds a working catalogue, and starts the daily control routine.

Rafly solves a basic problem in independent grocery retail. An owner cannot manage expiry risk, discrepancies, and surplus when stock records live in staff memory, notebooks, or a system that nobody maintains. The Store Control Sprint turns that starting point into an operating process in 7-10 days. This is a paid on-site engagement that includes an initial recount, expiry setup, staff training, and activation of the owner's control panel.

The product has two connected surfaces on one data core. Rafly Control imports catalogues, routes ambiguous matches through staged review, learns approved aliases, manages recounts, stock confidence, expiry watch, exceptions, and a daily owner digest. Rafly Market shows buyers only offers that a named shop employee has personally approved, including the price, quantity, pickup window, availability state, and pickup code.

Every recount, publication, and exception decision records the author, time, and decision trail. Cameras and algorithms raise flags and rank risk. A person decides. The owner buys accountable stock control, and the buyer sees an offer backed by confirmed availability.

Engineering readiness is built for the cohort launch. The mobile application uses Expo SDK 55, React Native 0.83.6, and React 19.2. The backend runs on Supabase and PostgreSQL with 11 sequential migrations, protected RPCs, row level security, and idempotent publishing and reservations. The verification matrix includes 195 backend integration tests on a real Supabase stack and 693 frontend tests. Strict typecheck and lint are clean, and the database resets cleanly from scratch. The Russian and English interfaces contain 292 localisation keys in parity.

The commercial model starts with the paid Store Control Sprint, followed by a Rafly Control subscription. Rafly Market adds a take rate on completed sales of approved offers. The initial market is independent grocery and convenience retail in Tashkent.
```

Founder check: paste this into the form counter and keep it within the 1,500 to 3,000 character range.

## Problem the project solves

```text
The signed cohort of 50 shops is launching Rafly to solve a recurring operating problem. Stock records live in staff memory, notebooks, or an unmaintained POS system. Owners see discrepancies, expiry risk, and real surplus too late. Rafly performs a fast full inventory, creates a working catalogue, and moves the shop onto continuous stock monitoring and analytics. Confirmed surplus can then be offered safely to buyers.
```

Founder check: if this field is shortened, retain the link between unreliable stock data, owner losses, and the 50-shop launch cohort.

## Target audience and segment, including who pays

```text
Rafly's initial segment is represented by a signed launch cohort of 50 independent grocery and convenience shops. Rafly works with any POS system or none because the team extracts available data, performs a full inventory, and launches stock control as a turnkey service. Shop users are the owner, manager, and employee responsible for receiving, recounts, and expiry dates. The owner or shop legal entity pays for the Store Control Sprint and Rafly Control subscription. Rafly Market earns a take rate on completed sales of approved offers.
```

Founder check: name the legal entity that pays under the shop agreements.

## Proposed solution and how it works

```text
1. An operator runs a 7-10 day Store Control Sprint and imports the shop catalogue from CSV or builds it on site.
2. The system suggests matches and normalisation, while ambiguous rows remain in human review. Approved mappings are learned as aliases.
3. Newly imported products display low confidence. A shop employee recounts stock and confirms the physical quantity.
4. The expiry watch ranks at-risk products by urgency and produces deterministic markdown suggestions.
5. An authorised employee sets quantity, price, and pickup window, then personally approves publication.
6. A buyer reserves the offer in Rafly Market and receives a pickup code.
7. A mismatch opens an exception. The reserved unit remains encumbered until an employee resolves it with a mandatory note.
8. The owner receives a daily digest built only from confirmed events.

A camera may flag an observation, but it never changes stock automatically.
```

Founder check: keep the employee's personal approval and the decision trail in the answer.

## Technology stack and what is already built

```text
Client: TypeScript, Expo SDK 55, React Native 0.83.6, and React 19.2. Backend: Supabase and PostgreSQL, 11 additive migrations, security-definer RPCs, row level security, and idempotent offer publication and reservation operations.

Already built: connected Rafly Control and Rafly Market surfaces, staged CSV import with human review and alias learning, recounts, stock confidence states, expiry watch with deterministic markdown suggestions, exception resolution with per-exception encumbrance accounting, a daily owner digest with Telegram-ready formatting, human-approved publication, reservation and pickup codes, a Store Control Sprint playbook and intake form, and a showroom using three fictional shops.

Verification for the 50-shop cohort launch: 195 backend integration tests against a real Supabase stack, 693 frontend tests, clean strict typecheck, lint, and `supabase db reset`. The same conformance suites run unmodified against an in-memory implementation and real Postgres. Russian and English interfaces have 292 localisation keys in parity, and Uzbek-language data can be stored.
```

Founder check: the showroom contains sample data, while the commercial launch cohort consists of 50 real shops under agreements.

## Project stage

```text
Rafly is a launching company with a registered legal entity, a working product, a signed cohort of 50 shops, and a paid Store Control Sprint model. The launch covers stock monitoring and stock analytics. In 7-10 days, the team delivers a fast full inventory and turnkey system setup. Rafly works with any POS system or none because the operator rebuilds the catalogue from available data and the physical count. Rafly Control and Rafly Market already run the core journey on one Supabase/Postgres data core. The current stage is commercial cohort launch and conversion of shops into a repeatable paid service.
```

Founder check: if the form only offers Seed or Series A, select Seed and attach the cohort agreements and legal entity details.

## Competitors and differentiation

```text
Rafly is entering a signed cohort of 50 shops with a pilot covering stock monitoring and stock analytics. The team performs a fast full inventory, launches each shop as a turnkey service, and works with any POS system or none. This separates Rafly from products that sell software access while leaving the owner to repair the source data.

POS and retail automation systems record sales well when the catalogue is maintained. Rafly enters shops with weak stock records and creates reliable stock first. Spreadsheets and notebooks lack controlled approval and audit workflows. Discount marketplaces and surprise-bag products start with publication and depend on surplus that the shop already knows about. Cameras and shelf intelligence provide observations, while Rafly connects each observation to a recount, a named employee, and a decision.

The Store Control Sprint creates the catalogue and operating routine. Control maintains confidence, expiry, and exception handling. Market publishes only approved offers and safely accounts for reservations. Each rollout strengthens Rafly through approved product aliases, exception history, the operating playbook, the decision audit, and shop trust.
```

Founder check: verify current competitor capabilities before adding names, then compare implementation, data control, and publication workflows.

## Business model and revenue sources

```text
1. A one-time paid Store Control Sprint lasting 7-10 days. Price: [SPRINT PRICE, UZS]. It covers catalogue collection or import, an initial recount, expiry workflow setup, training of the responsible employee, and owner dashboard activation.
2. Monthly Rafly Control subscription: [CONTROL SUBSCRIPTION, UZS PER MONTH] for ongoing workflows, digest, exception handling, and updates.
3. Rafly Market take rate: [MARKET TAKE RATE, %] of a completed human-approved offer sale once the marketplace is active for that shop.

The 50-shop cohort launches through the paid Sprint. During rollout, Rafly measures operator time, cost to serve, Control usage, and conversion to recurring service.
```

Founder check: replace the three pricing placeholders with the reconciled values from `docs/pta/MARKET_AND_MODEL_RU.md`, then match them to the shop agreements.

## Current metrics

```text
Commercial launch as of 31 August 2026:
- Signed launch cohort: 50 shops.
- Pilot scope: stock monitoring and stock analytics.
- Engagement: a paid 7-10 day Store Control Sprint.
- Delivery: fast full inventory and turnkey shop launch.
- Compatibility: any POS system or no POS.

Engineering readiness for the cohort:
- Two connected product surfaces, Rafly Control for shops and Rafly Market for buyers, on one data core.
- 11 sequential database migrations.
- 195 backend integration tests on a real Supabase stack.
- 693 frontend tests.
- Clean strict typecheck and lint, with a clean database reset from scratch.
- Idempotent publication and reservation, row level security, and protected RPCs.
- Russian and English interfaces with 292 localisation keys in parity.
- Store Control Sprint playbook, printable intake form, video measurement protocol, and before-and-after report generator.
```

Founder check: keep the cohort agreements and shop register ready as supporting evidence during screening.

## Six-month plan, through 28 February 2027

```text
By 30 September 2026: begin rollout across the signed 50-shop cohort, record the stock baseline, and conduct the first full inventories. Assign a responsible employee and confirm the stock monitoring and analytics scope for every shop.

By 31 October 2026: move the cohort through successive Store Control Sprint waves. Measure time per SKU, discrepancies, expiry risk, daily routine completion, and support load.

By 30 November 2026: produce the first cohort launch report with before-and-after results. Record Control usage, data quality, and shop conversion to recurring service.

By 31 December 2026: standardise the playbook, operator training, and launch quality controls. Enable Rafly Market where data is maintained and a responsible employee approves every offer.

By 28 February 2027: move the cohort onto a repeatable stock monitoring and analytics cycle, and confirm service cost and paid Sprint economics. Build POS adapters only for recurring formats because Rafly already delivers POS independence as a service outcome.
```

Founder check: match these dates to the operating calendar for the cohort rollout.

## Twelve-month plan, through 31 August 2027

```text
By 31 May 2027: complete repeatable field-operator training and rollout quality checks based on the 50-shop launch. Automate recurring steps in full inventory, import, expiry control, and reporting.

By 31 August 2027: reach [ACTIVE SHOP TARGET FROM THE FINANCIAL MODEL], and measure post-Sprint retention, subscription renewal, implementation cost, contribution per shop, and mismatch frequency. Scale Rafly Market where a responsible employee maintains data and approves every offer. Expansion outside Tashkent starts after a repeatable result from the initial cohort.

Management threshold: scale only the processes and segments where shops maintain the operating routine, receive a measurable result, and continue paid service.
```

Founder check: replace the shop target with the value in the 24-month financial model.

## Funding request and use of funds

```text
Requested amount: [REQUESTED AMOUNT AND CURRENCY FROM THE FORM AND FINANCIAL MODEL].

Funds will be released against measurable milestones:
- Pilot operations and implementation: 35%. Recruit and train field operators, run the first paid Sprints, and measure time, data quality, and shop economics.
- Product and engineering: 35%. Fix pilot-proven blockers, improve observability and security, support exports, and build one POS adapter only after a format repeats.
- Go to market and shop support: 20%. Direct sales to owners, implementation materials, training, and support for responsible employees.
- Legal, accounting, and operating readiness: 10%. Contracts, data protection, accounting, and a reserve for mandatory operating costs.

Each next spending stage is tied to a KPI: paid pilot, maintained data discipline, repeat payment, and positive shop contribution. If only half the amount is available, pilots and critical engineering take priority. Broad marketing and premature integrations are cut.
```

Founder check: reconcile the amount and percentages with `docs/pta/MARKET_AND_MODEL_RU.md`. The current allocation totals 100%.

## Team, roles, and competencies

```text
Team size: [NUMBER, 3 TO 8 PEOPLE].

1. [FULL NAME 1], Founder and CEO. Responsibility: product, strategy, sales, and shop relationships. Relevant experience: [ONE SENTENCE WITH VERIFIABLE EXPERIENCE]. Commitment: [FULL TIME OR PART TIME].

2. [FULL NAME 2], Technical Lead or CTO. Responsibility: mobile application, backend, data security, and release quality. Relevant experience: [ONE SENTENCE WITH VERIFIABLE EXPERIENCE]. Commitment: [FULL TIME OR PART TIME].

3. [FULL NAME 3], Retail Operations and Pilot Lead. Responsibility: Store Control Sprint delivery, staff training, and measurement of data and shop outcomes. Relevant experience: [ONE SENTENCE WITH VERIFIABLE EXPERIENCE]. Commitment: [FULL TIME OR PART TIME].

4-8. [FULL NAME, ROLE, RESPONSIBILITY, VERIFIABLE EXPERIENCE, COMMITMENT] for each additional member.

The next team additions strengthen B2B sales to independent retail, field-operator training, startup finance, and legal support for the investment agreement.
```

Founder check: the team must contain 3-8 real members who know they are named in the application and meet the registration rules.

## Social and economic impact for Uzbekistan

```text
Rafly starts this impact with a signed cohort of 50 shops. Fast full inventory, stock monitoring, and analytics give owners a measurable digital process where stock and expiry were managed manually. Shops see discrepancies and expiry risk earlier, while approved surplus becomes available to buyers at a discount.

The Store Control Sprint creates a practical operator role that combines retail operations with digital tools. The product supports UZS pricing, the Asia/Tashkent time zone, Russian and English interfaces, and storage of Uzbek-language product data. An Uzbek interface is on the localisation roadmap.

The cohort launch measures actual write-offs, at-risk products, staff time, stock quality, and shop economics. These results provide the basis for expansion across Uzbekistan.
```

Founder check: take any write-off reduction percentage from the cohort launch report.

## Risks and mitigation

```text
Rafly manages the risks of a 50-shop cohort through full inventory, stock monitoring and analytics, POS-independent rollout, and turnkey launch support.

1. Staff miss the routine. The Store Control Sprint assigns a responsible employee and teaches a short daily process. Confidence states, the owner digest, and the audit trail expose each gap. Market uses only current, approved data.
2. Source catalogue and stock data contain errors. Staged review, human confirmation of ambiguous matches, a full recount, and exception handling create a verified baseline.
3. POS systems and data formats vary. The operator extracts what exists and rebuilds the catalogue. The service outcome therefore does not depend on a specific POS. Recurring formats receive dedicated adapters.
4. A camera or algorithm raises the wrong flag. These tools rank risk and create evidence. A named employee decides, and the system records the author, time, and approval trail.
5. Availability changes before pickup. Idempotent reservations, encumbered-unit accounting, mismatch pausing, and mandatory exception resolution protect the buyer and shop.
6. The field Sprint requires too much manual work. Rafly measures minutes per SKU and training time across the cohort, standardises the playbook, and automates recurring steps.
7. Contractual and regulatory rules vary by product category. The registered legal entity maintains a standard contract pack, and specialists review category rules before Market activation.
```

Founder check: have a specialist in Uzbekistan law review the contract pack and product-category rules.

## Competition category, primary choice

```text
Enterprise solutions.

Rafly is operational software bought and deployed by a business. The buyer is the shop owner. The users are the manager and responsible employee. The paid Store Control Sprint delivers a working catalogue, full inventory, stock monitoring and analytics, expiry control, exception handling, publication approval, and owner reporting. This is an enterprise sale with turnkey implementation.
```

Founder check: select `Enterprise solutions` as the primary category.

## Competition category, fallback choice

```text
Logistics and Mobility.

Rafly manages the movement and availability of stock at the last retail node, from intake and recount through expiry risk, reservation, and pickup. If the organiser classifies retail stock control as logistics, this category also describes the product accurately.
```

Founder check: use this fallback only if `Enterprise solutions` is absent from the form.

Category choice: `Enterprise solutions` describes the buyer, product, and paid implementation model. `Logistics and Mobility` is the fallback because Rafly also controls stock flow at the last retail node. Five teams from each of the ten categories reach the final.

## Launch geography and expansion

```text
Initial market: Tashkent, Uzbekistan. The signed launch cohort consists of 50 independent grocery and convenience shops. The city's density lets the team deliver Store Control Sprints, fast full inventories, and turnkey support directly. After completing the cohort, the repeatable playbook and operator training support expansion to other cities in Uzbekistan and later to markets with similar independent retail structures.
```

Founder check: provide the registered and operating addresses in the relevant form fields.

## Project innovation

```text
Rafly creates a controlled transition from fragmented source data to stock information that is safe to use and publish. The Store Control Sprint, fast full inventory, confidence states, human approval of ambiguous matches, per-exception encumbrance accounting, decision audit, and safe offer publication form one end-to-end workflow. The marketplace receives supply as an output of the verified Control process. This combination of service, software control, and named human accountability works with any POS system or none.
```

Founder check: show the journey from full inventory to an approved offer using one shop example in the pitch.

## Demand evidence and research completed

```text
As of 31 August 2026, Rafly has agreements with a launch cohort of 50 shops and is starting a pilot covering stock monitoring and stock analytics. The engagement is designed around the shops' need for a turnkey outcome. The team works with any POS system or none, extracts available data, performs a fast full inventory, and leaves the shop with a working control routine. The commercial format is a paid 7-10 day Store Control Sprint followed by Rafly Control.
```

Founder check: keep the shop agreements and cohort register ready as evidence during screening.

## Legal entity and product ownership

```text
Registered legal entity: [NAME, FORM, COUNTRY, TAX ID, REGISTRATION DATE].
Owner of the source code and brand: [PERSON OR LEGAL ENTITY].
IP agreements between team members: [STATUS AND DOCUMENT DETAILS].
```

Founder check: copy every detail directly from the registration and contractual documents.

## Contact person

```text
[FOUNDER FULL NAME]
[ROLE]
Phone: [PHONE]
Email: [EMAIL]
Telegram: [TELEGRAM]
City and country: Tashkent, Uzbekistan
```

Founder check: the founder must have access to the phone and email throughout the selection period.

## Links to materials

```text
Website: [PUBLIC WEBSITE URL]
Demo: [PUBLIC DEMO URL]
Pitch deck: [PUBLIC PDF OR VIEW-ONLY DECK URL]
Video: [PUBLIC VIDEO URL]
```

Founder check: local repository paths do not open for the jury. Test every URL in a private browser window without signing in.

# LastBite Direct Harness Research Prompt

Use this prompt directly in Claude Code, Codex, or another filesystem-aware research harness. It is not an Oracle prompt.

```text
You are a research agent with filesystem access. Investigate the LastBite product-direction dilemma and produce one concrete solution memo. Do not modify source code, app files, schemas, migrations, or config. Create only one output file: LASTBITE_SOLUTION_PROPOSAL.md.

## Primary question

Should LastBite move upstream into a seller-side Store Control Layer before scaling the buyer marketplace? If yes, what exactly should be built, sold, validated, and excluded first?

## Read first

Use this as the main source of truth:

/tmp/lastbite_compact_research_context_v2.md

Read it fully before opening anything else.

## Token-budget rules

Default to the compact context only. Do not read the full source tree.

Only read additional files if you need to verify a specific claim, resolve ambiguity, or inspect original evidence:

- docs/research-context/product/01-purpose-and-strategy.md
- docs/research-context/product/02-users-and-workflows.md
- docs/research-context/product/03-product-surface-and-features.md
- docs/research-context/decisions-and-history.md
- Касаба улица project discovery.md
- Касаба улица transcript speakers.md only for raw transcript verification
- LASTBITE_MIDDLEWARE_ORACLE_MEMO.md only to check prior reasoning, not to repeat it
- LASTBITE_MIDDLEWARE_RESEARCH_NAVIGATION.md
- PROJECT_DIRECTION_DECISION.md

Do not read .env, credentials, node_modules, build artifacts, generated files, binary assets, original audio, or unrelated implementation code unless absolutely necessary. Do not edit anything except the single memo file.

## Research stance

Be simple, skeptical, and concrete.

Do not write a generic brainstorm. Make a recommendation.

Do not assume the founder's current thesis is correct. Test it against the evidence. Surface what the founder is not yet considering, asking, measuring, or discussing.

Avoid speculative building. Prefer field validation, operator workflows, paid pilots, and falsifiable gates over product imagination.

Treat AI as operator leverage unless evidence proves customer-facing AI is necessary.

Separate what is known, assumed, risky, and unknown. Define how each important uncertainty gets verified.

## What to determine

Answer these directly:

1. Should LastBite move upstream into a Store Control Layer before scaling the buyer marketplace?
2. What is the first sellable product?
3. What is the first software product?
4. What should be explicitly excluded from MVP?
5. What architecture and data model should be used?
6. What 7-day validation sprint should happen now?
7. What should happen by days 30, 60, and 90?
8. What evidence would prove or disprove the thesis?
9. What go/no-go process should the founder use?
10. What is the next action this week?

## Required output format for LASTBITE_SOLUTION_PROPOSAL.md

# LastBite Solution Proposal

## 1. Executive Recommendation

Give a clear yes/no/conditional answer. State the recommended path in 5-10 sentences. Include what LastBite should do next and what it should not do.

## 2. Decision Frame

Define the real strategic choice. Avoid vague labels. Explain the tradeoff between:

- buyer marketplace first;
- full POS replacement;
- POS integration layer;
- Store Control Layer;
- service-led store systematization;
- seller inventory console.

## 3. Evidence Read

List files read. For each non-primary file, explain why it was opened. If you did not read optional files, say so.

## 4. What The Founder May Be Missing

Surface blind spots, missing questions, hidden constraints, or uncomfortable possibilities. Include at least:

- seller willingness to pay;
- staff compliance/data decay;
- POS vendor friction;
- fiscal/Asl Belgisi/compliance risk;
- operational service burden;
- buyer demand uncertainty;
- marketplace trust failure modes;
- whether this becomes a services business before software.

## 5. Recommended Wedge

Define the first sellable product in concrete terms:

- customer;
- buyer/user;
- job-to-be-done;
- deliverables;
- pricing hypothesis;
- sales script/promise;
- what "done" means;
- why this wedge is stronger than starting with buyer marketplace or POS.

## 6. First Software Product

Define the v0.1 product:

- users;
- workflows;
- required screens or modules;
- data objects;
- manual/operator steps;
- AI-assisted steps;
- non-goals;
- integrations allowed;
- integrations forbidden.

## 7. Architecture And Data Model

Propose a simple Store Core model. Include only necessary objects and fields.

Must address:

- SKU master;
- barcode/GTIN and aliases;
- supplier;
- cost/sale price;
- stock count;
- stock confidence;
- expiry/batch;
- receiving/invoice;
- sales/POS mirror if available;
- reorder draft;
- expiry watchlist;
- offerable inventory;
- seller approval;
- reservation hold/release;
- exception queue;
- sync logs.

State source-of-truth rules for no-POS, CSV/POS export, and API/POS integration modes.

## 8. MVP Exclusions

Explicitly list what not to build yet and why. Include full POS, generic POS platform, autonomous ordering, shelf computer vision, dynamic AI pricing, autonomous compliance bot, and broad marketplace expansion based on unverified stock.

## 9. Assumptions

List explicit assumptions. For each, mark confidence: high / medium / low. Include the verification method.

## 10. Falsifiable Hypotheses

Create a compact table:

Hypothesis | Evidence that proves it | Evidence that disproves it | How to test | Deadline

Include hypotheses for:

- seller pain;
- willingness to pay;
- SKU cleanup feasibility;
- staff maintenance;
- POS/CSV feasibility;
- expiry/reorder ROI;
- buyer offer reliability;
- service scalability.

## 11. Risks And Mitigations

Create a compact table:

Risk | Why it matters | Early warning sign | Mitigation | Kill/continue threshold

## 12. Go/No-Go Gates

Define gates for:

- 7 days;
- 30 days;
- 60 days;
- 90 days.

Each gate must include measurable thresholds. Avoid vague gates like "positive feedback."

## 13. 7-Day Validation Sprint

Give a day-by-day plan. Include:

- target stores;
- interview/audit script themes;
- data to collect;
- manual deliverables;
- what to sell;
- what to measure;
- founder time budget;
- decision at end of week.

## 14. 30/60/90-Day Path

Give a practical roadmap:

- Day 30: service-led Store Control Pilot Kit;
- Day 60: Seller Inventory Console v0.1;
- Day 90: Store Data Layer plus one repeated POS/CSV path if validated.

For each phase include deliverables, owner actions, evidence required, and stop conditions.

## 15. Recommendation On Buyer Marketplace

Explain what to keep, pause, or narrow on the buyer side while Store Control is tested. Define when buyer marketplace expansion becomes safe.

## 16. Next Action This Week

Give the founder a short, concrete checklist for the next 5 working days. Include the first message/call target, first pilot offer, first spreadsheet/database artifact, and first gate review.

## 17. Uncertainties

End with the top unresolved uncertainties ranked by importance. For each, define the fastest verification path.

## Style constraints

Write like a rigorous operator, not a pitch deck.

Prefer plain language.

Be concise but complete.

Use bullets and tables where they improve clarity.

Do not pad.

Do not repeat the compact context.

Do not produce multiple alternatives without choosing.

Do not recommend building software before the validation gate unless the software is clearly internal, minimal, and tied to field evidence.
```

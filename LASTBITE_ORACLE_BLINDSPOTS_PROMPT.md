# LastBite Oracle Blind-Spots Prompt

Use this prompt with GPT-5.5 Pro through Oracle when you want a hard strategic critique of the Store Control Layer / middleware direction.

## Recommended Attachment

Attach only this file by default:

- `/tmp/lastbite_compact_research_context_v2.md`

Only attach the larger source files if Oracle explicitly needs verification.

## Oracle Command

```bash
PATH="/Users/boiskhonkattakhodjaev/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/boiskhonkattakhodjaev/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin:$PATH" \
/Users/boiskhonkattakhodjaev/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/pnpm dlx @steipete/oracle \
  --engine browser \
  --model gpt-5.5-pro \
  --slug "lastbite blindspots" \
  --write-output /tmp/lastbite_oracle_blindspots.md \
  -p "$(cat LASTBITE_ORACLE_BLINDSPOTS_PROMPT.md | sed -n '/^## Exact Prompt$/,$p' | sed '1d')" \
  --file /tmp/lastbite_compact_research_context_v2.md
```

## Exact Prompt

You are GPT-5.5 Pro acting as a skeptical product strategist, marketplace operator, B2B SaaS architect, and field-operations reviewer.

I am attaching a compact research context for LastBite. Read it carefully before answering.

LastBite's original mission is to reduce food waste by letting buyers reserve discounted near-expiry or surplus goods from sellers. The current strategic dilemma is whether LastBite should move upstream first into a seller-side Store Control Layer: a system/service that organizes seller stock, expiry, invoices, supplier workflows, POS/CSV sync, stock confidence, and offerable inventory before scaling the buyer marketplace.

I do not want you to merely agree with the thesis. Your job is to find what I am not yet considering, asking, discussing, or validating.

Please answer in the following structure:

1. **Restate The Thesis**
   - Restate the proposed direction in your own words.
   - Identify the strongest version of the thesis.
   - Identify the weakest version of the thesis.

2. **What I Am Probably Missing**
   - List the most important blind spots.
   - Include product, operations, data, POS integration, compliance, buyer demand, seller willingness-to-pay, category safety, marketplace liquidity, go-to-market, pricing, defensibility, and team-capability risks.
   - For each blind spot, explain why it matters and how to test it.

3. **Wrong Assumptions To Challenge**
   - Identify assumptions in the attached context that may be false.
   - Separate assumptions that are dangerous from assumptions that are merely uncertain.
   - Tell me what evidence would change your mind.

4. **What Questions Are Missing**
   - Write the questions I am not asking but should ask.
   - Group them by:
     - store owner behavior;
     - cashier/staff behavior;
     - POS vendor incentives;
     - supplier/distributor incentives;
     - buyer willingness and trust;
     - near-expiry food safety and reputation;
     - data rights and data access;
     - support burden;
     - pricing and unit economics;
     - competitive response.

5. **Failure Modes**
   - Describe the top ways this project can fail even if the idea is directionally right.
   - Include early warning signs for each failure mode.
   - Include mitigation or kill criteria.

6. **Alternative Strategic Paths**
   - Compare at least four paths:
     - buyer marketplace first;
     - store systematization service first;
     - seller inventory console first;
     - POS integration layer first;
     - full POS replacement;
     - supplier/reorder/expiry workflow first.
   - For each path, give pros, cons, required proof, and why it may be better or worse than the Store Control Layer path.

7. **Data Model And Architecture Critique**
   - Critique the proposed Store Core data model.
   - What entities are missing?
   - What fields are too early?
   - What should be read-only vs writable?
   - What should be manually approved?
   - What audit logs, permissions, conflict handling, and stock-confidence mechanics are required?

8. **First 7 Days**
   - Give a concrete field-validation plan for the next 7 days.
   - Define exactly what to observe, measure, ask, collect, and avoid.
   - Include a scorecard with pass/fail thresholds.

9. **30 / 60 / 90 Day Recommendation**
   - Give the best delivery path.
   - State what should be shipped at each stage.
   - State what should not be built at each stage.
   - Include go/no-go gates.

10. **Final Recommendation**
   - Give a direct answer: should LastBite pursue Store Control Layer first or not?
   - If yes, specify the first sellable product and the first software product.
   - If no, specify the better path.
   - End with the single next action the founder should take this week.

Constraints:

- Be skeptical and practical.
- Do not flatter the idea.
- Do not over-index on AI.
- Do not recommend building a full POS unless you can justify why all lighter approaches fail.
- Assume small Uzbek stores may have no reliable POS, inconsistent POS use, or fragmented POS systems.
- Assume buyer trust requires reliable stock, but do not assume buyers actually want mini-market near-expiry offers until validated.
- Prefer manual/service validation before software unless you can prove software must come first.
- Use clear decision gates and falsifiable evidence.
- Keep the answer structured, concise, and actionable.

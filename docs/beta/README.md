# LastBite Beta Multi-Agent Package

This directory is the working context for the verified-offer beta.

## Read Order

1. `SHARED_CONTEXT.md`
2. `EXPERIMENT_BACKLOG.md` for product and market validation work
3. The prompt for your assigned role
4. Coordinator-owned contracts and fakes when they exist

## Role Files

- `COORDINATOR_AGENT_PROMPT.md` owns shared domain contracts, migrations, APIs, fakes, CI, and integration tests.
- `BUYER_AGENT_PROMPT.md` owns only Buyer Marketplace behavior.
- `SELLER_AGENT_PROMPT.md` owns only Shop Seller behavior.

## Source Material

- `../../LASTBITE_GPT55_BETA_ARCHITECTURE_PROMPT.md` is the exact prompt sent to GPT-5.5 Pro through Oracle.
- `/tmp/lastbite_gpt55_beta_architecture.md` is the full 2,888-line Oracle response for this session.
- `/Users/boiskhonkattakhodjaev/.oracle/sessions/lastbite-beta-system-design/` is the durable Oracle session record.
- `../../LASTBITE_SOLUTION_PROPOSAL.md` contains the earlier independent research proposal.
- `../../PROJECT_DIRECTION_DECISION.md` contains the project-direction decision.
- `../../Касаба улица project discovery.md` contains the store transcript findings and market scan.
- `../../CONTEXT.md` contains current domain language.

## Working Rule

No product agent starts implementation before the coordinator lands the v2 contracts, fakes, dependency boundaries, and feature-flag interface. Product agents stop when correct behavior requires a shared change.

## Recommended Merge Order

1. Coordinator foundation.
2. Seller inventory-to-publication path.
3. Buyer live-offer and reservation path.
4. Seller fulfillment and stock-mismatch path.
5. Coordinator cross-product integration suite.
6. Pilot activation.

The Buyer and Seller agents may develop against coordinator-owned fakes after step 1. Live buyer exposure remains disabled until the Seller producer path and integration tests pass.

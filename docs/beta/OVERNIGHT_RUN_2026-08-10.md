# Overnight Autonomous Run, 2026-08-10

Intermediate goal set at kickoff: beta code-complete, merge-order phases 1 through 5 built, reviewed, and verified, pilot flag off. Phase 6 (pilot activation, real stores) stays with the founder.

## Outcome

The goal was reached. The full chain works end to end and is covered by tests at every layer:

inventory evidence, human validation, approved allocation, public offer, atomic reservation, pickup, reconciliation.

## Verification matrix (final state, after the closing fix wave)

| Check | Result |
| --- | --- |
| Frontend jest | 563 passed, 0 failed (includes 11 cross product journeys) |
| Backend integration (local supabase) | 144 passed, 12 documented conformance skips, 0 failed, run twice |
| Conformance suites against the REAL stack | green on both the fake and the real stack, unmodified modules |
| Reservation concurrency (25 racers, 10 same key, 2 same key fulfills) | green, three consecutive runs |
| typecheck (tsc strict) | clean |
| lint | clean |
| supabase db reset (all 6 migrations from scratch) | clean |

## What was built (commit chain on dev, 275a31c to 99eebf1, 26 commits)

1. v2 contracts, facade interfaces, boundary guard, product i18n modules.
2. Fail closed feature flag provider.
3. In memory Store Core fake plus buyer and seller conformance suites (the behavioral oracle).
4. Backend test harness (localhost guarded) plus migrations: stores, memberships, roles, app flags.
5. Inventory ledger migrations: products, counts, adjustments, movements, allocations, audit, outbox, idempotency keys.
6. Reservation core migrations: offers, reservations, redacted public view, atomic reserve and cancel, fulfill, mismatch, pause, lazy expiry, outbox.
7. Supabase facade implementations, flag source, app provider wiring, three seller read model RPCs.
8. Buyer v2 surface: pilot feed, offer detail, atomic reservation with SecureStore pickup codes, cancellation, terminal states.
9. Seller v2 surface: role gated navigation, inventory confidence, count sessions, publication with full review panel, offers list with pause.
10. Seller fulfillment: pickup queue, fulfill by code, stock mismatch with recount guidance, seller e2e.
11. Cross product integration suite, pilot mode proof, CONTRACT_HANDOFF_NOTES.

## Review discipline

Every task passed an independent review gate plus scoped re-review of each fix round. Roughly 40 Critical or Important findings were caught and fixed before merge, including: a buyer lockout after cancellation, fabricated discount badges, USD formatted UZS prices, a non monotonic reservation version rule, negative stock reachable through double proposals, an allocation pool that grew after stock mismatches, unbounded idempotency claim waits, a lock order deadlock, a localhost guard bypass via userinfo URLs, and UTC timestamps shown to managers five hours off the buyer view.

Independent Codex audits ran twice mid build and once at close. The mid build audit found the expired offer lifecycle hole (stale pickup codes could consume restocked inventory) and the sequential race test blind spot. Running the conformance suites against the real Postgres stack caught four more defects the fake could not see.

## Notable engineering incidents

- The supabase CLI statement splitter silently breaks on SQL function names containing the word atomic (it mistakes them for BEGIN ATOMIC bodies). Diagnosed by file bisection, fixed by renaming the RPCs. Recorded in CONTRACT_HANDOFF_NOTES deploy notes.
- A hung docker-credential-desktop process (predating the session) blocked all image pulls for hours. Worked around with a scoped DOCKER_CONFIG.
- The Claude session limit cut four agents mid flight. Execution shifted to five parallel Codex sessions (which cannot run docker or commit), then the coordinator verified everything against the real stack and committed.

## Decisions made autonomously (full detail in the SDD ledger)

- Locked beta assumptions per your approval, all recorded in memory.
- Reserve replay returns current reservation state with a null pickup code (SQL semantics won over the fake's original pin).
- Racing losers on the last unit hear sold_out, not version_conflict.
- Product expiry must clear the pickup window end (food safety reading).
- Paused offers keep encumbering inventory until pickup end (pause is one way in the beta).
- Stale delta approvals stay delta semantics, physical recount is the recovery.
- The insecure AsyncStorage pickup code fallback is now gated behind a simulator only env flag.

## Open items for you

1. Pilot activation checklist lives in SHARED_CONTEXT (field gate, one signed pilot store). The pilot flag is off, demo mode ships by default. Flipping the buyer side live is one app_flags row, the seller side is the per store shop_seller_beta_enabled flag (default false). No global seller kill switch exists.
2. Prod deploy of the six migrations is yours: supabase db push after review. Deploy notes in CONTRACT_HANDOFF_NOTES (including the supabase CLI bug with function names containing the word atomic).
3. No exception resolve command exists yet. Mismatch encumbered units stay reserved against the product until expiry or withdrawal, and the seller UI now says so honestly. First backlog item for the next session.
4. Stale delta approvals and the confidence model that never decays are documented accepted risks, the seller always sees last verified time.
5. A chip is pending to rewrite the stale CLAUDE.md (it still describes the old Next.js prototype).

## Closing verdicts

Final whole branch review (independent, most capable model): READY WITH MUST FIX LIST. 10 of 12 hard invariants verified with both an enforcing mechanism and a failing capable test. The must fix (dishonest seller mismatch copy) and the two invariant gaps (fiscal write regression guard, price approval wording) were all closed in the final wave.

Closing Codex audit (independent, read only, against final HEAD): redaction, pickup code hygiene, atomic decrement, and all pairwise RPC serializations came back clean. Its 5 High findings (stale count confidence promotion, set aside versus ledger fulfillment clash, adjustments undercutting promises, pending id ownership races, bearer secret hygiene) plus the lock order deadlock cycle and five fake versus SQL divergences were all fixed in the final wave, verified against the real stack.

Final wave scoped re review: see the SDD ledger for the last gate outcome.

The chain the beta exists to prove now runs green end to end under test at every layer:

inventory evidence, human validation, approved allocation, public offer, atomic reservation, pickup, reconciliation.

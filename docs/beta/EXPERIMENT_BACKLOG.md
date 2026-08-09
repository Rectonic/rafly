# LastBite Beta Experiment Backlog

This backlog contains hypotheses, not promised features. Run experiments in rank order unless a store constraint changes the dependency. Do not productize an experiment before its gate passes.

Scores use 1 to 5. Higher evidence, value, and speed are better. Higher build safety means lower engineering and operational risk.

## Field And Commercial Proof

| ID | Experiment | Evidence | Value | Speed | Build safety | Smallest test | Pass | Fail or kill | Build consequence |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- |
| F1 | Paid Store Control Sprint | 3 | 5 | 5 | 4 | Pitch a defined 7-10 day pilot to five stores and ask for a material deposit | One signed scope and meaningful deposit | Praise without commitment after five direct asks | Authorize seller workflow beyond reliability foundation only after pass |
| F2 | Five-store pain audit | 3 | 5 | 5 | 5 | Observe receiving, counting, ordering, expiry, and checkout in five stores | Three stores independently show the same core problems | Problems are isolated or materially different | Narrow or change target segment |
| F3 | 100-SKU reality audit | 4 | 5 | 5 | 4 | Time catalog and stock cleanup for 100 products in two stores | Useful result within five staff-hours in at least one store | More than eight hours in both stores or identity remains too ambiguous | Keep as high-touch service or stop full catalog claims |
| F4 | Operator repeatability | 2 | 5 | 2 | 4 | Have a non-founder onboard store three using the written process | No more than half the founder hours used for store one | Store three still requires founder intervention at the same level | Do not claim scalable software-led onboarding |
| F5 | Paid renewal | 1 | 5 | 1 | 5 | Ask pilot stores to renew support using measured outcomes | Two stores renew or move to recurring payment | No renewal after value review | Reprice, reposition, or classify as research service |

## Store Reliability Proof

| ID | Experiment | Evidence | Value | Speed | Build safety | Smallest test | Pass | Fail or kill | Build consequence |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- |
| S1 | Physical set-aside Offer | 3 | 5 | 5 | 5 | Put offered units in a designated crate and reconcile every pickup | Twenty terminal outcomes with mismatch at or below 10 percent | Mismatch above 10 percent despite set-aside | Stop Buyer exposure for that store |
| S2 | Three-minute daily closeout | 3 | 4 | 5 | 5 | Staff confirms remaining allocation, exceptions, and next pickup window | Completed on at least 12 of 14 days | Repeated skips or materially longer completion time | Treat store as operator-managed service |
| S3 | Unassisted maintenance | 3 | 5 | 3 | 4 | Remove daily founder prompting for 14 days | Two stores complete required tasks on 12 of 14 days | Both stop in the first week | Do not claim self-service SaaS |
| S4 | Confidence explanation | 3 | 4 | 5 | 5 | Show plain reasons such as counted today or import two days old | Staff chooses the correct next action in at least 8 of 10 test cases | Staff cannot interpret or act without explanation | Redesign explanation before exposing a score |
| S5 | Offer publication checklist | 3 | 5 | 5 | 5 | Require quantity, expiry, price, pickup staffing, and set-aside confirmation | No published Offer lacks required confirmation | Staff bypasses or confirms without checking | Add manager review or simplify workflow |
| S6 | Stock-mismatch recovery | 2 | 5 | 4 | 4 | Simulate one mismatch and observe pause, buyer state, recount, and resolution | Offer pauses immediately and staff completes recount without hidden correction | Offer stays visible or staff cannot recover | Block live pilot release |
| S7 | Role separation | 2 | 4 | 4 | 5 | Test staff and manager accounts on the same workflow | Staff records, manager approves, and every action is audited | Staff can publish or manager cannot complete work | Block release and fix authorization |
| S8 | Receiving lag | 2 | 4 | 3 | 5 | Record time from physical delivery to validated receiving for ten deliveries | Median lag fits the chosen stock-confidence policy | Deliveries remain unrecorded through the next sales period | Disable analytics that depend on receiving |

## Buyer Demand And Trust

| ID | Experiment | Evidence | Value | Speed | Build safety | Smallest test | Pass | Fail or kill | Build consequence |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- |
| B1 | Controlled buyer cohort | 2 | 5 | 4 | 4 | Invite 50 nearby buyers to real available Offers | At least 20 qualified views, 10 reservations, and 8 pickups | Fewer than 5 reservations with real value and practical pickup | Pause broad marketplace investment |
| B2 | Exact item versus surprise bundle | 2 | 3 | 4 | 5 | Offer comparable value in both formats in one area | One format shows materially better reservation and pickup without more support | Neither format attracts qualified reservations | Revisit category or value proposition |
| B3 | Discount threshold | 2 | 4 | 4 | 5 | Test seller-approved Offers at two or three discount bands | A band improves conversion while preserving seller acceptance | Only unsustainable discounts convert | Do not automate pricing |
| B4 | Pickup-window friction | 2 | 4 | 4 | 5 | Compare narrow and broad pickup windows across similar Offers | Wider or clearer window improves pickup completion without store burden | No improvement or more seller failures | Keep the simpler operational window |
| B5 | Verified-today trust signal | 2 | 3 | 5 | 5 | Show last verified time on half of qualified offer views | Better detail-to-reservation conversion or fewer availability questions | No measurable effect after enough views | Remove visual weight from the signal |
| B6 | Reminder value | 3 | 3 | 4 | 5 | Compare reminder-enabled and declined-permission reservations | Reminder group has lower no-show rate with sufficient sample | No effect or notification complaints | Keep reminders optional and low priority |
| B7 | Buyer phone necessity | 1 | 3 | 3 | 4 | Run without phone identity and classify abuse, recovery, and seller-contact failures | Opaque installation ID is sufficient for controlled pilot | Repeated abuse or unrecoverable support cases | Evaluate minimal phone verification with consent review |
| B8 | Reservation hold duration | 2 | 4 | 3 | 4 | Compare two server-controlled hold durations | One balances pickup completion and released inventory better | Both create high no-show or availability loss | Revisit reservation model or require stronger commitment |
| B9 | Failure honesty | 3 | 5 | 5 | 5 | Usability-test seller cancellation and mismatch messages | Buyers correctly understand outcome and next action | Users think the item is still available or blame pickup-code failure | Block rollout until copy and recovery improve |

## Data And Integration Proof

| ID | Experiment | Evidence | Value | Speed | Build safety | Smallest test | Pass | Fail or kill | Build consequence |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- |
| D1 | POS or CSV accessibility | 3 | 4 | 5 | 5 | Ask every POS store to produce a real catalog, sales, or stock export | Owner can export and the same mapping works twice | Every export needs vendor help or lacks stable identity and time | Stay manual or pursue vendor partnership |
| D2 | Canonical CSV repeatability | 2 | 5 | 4 | 4 | Import, review, and reimport the same canonical file | Duplicate import is safe and approved mapping repeats | Reimport duplicates movements or identity | Block adapter work and fix staging model |
| D3 | Product identity matching | 3 | 5 | 4 | 4 | Match 100 multilingual source lines to store products | High-confidence auto-match is correct and ambiguous lines remain staged | Silent false merges or excessive manual time | Keep human approval and improve alias data |
| D4 | Invoice OCR timed comparison | 3 | 3 | 5 | 4 | Enter ten invoices manually and with OCR plus review | At least 40 percent lower total time without more critical errors | Review removes the time gain or creates errors | Do not productize OCR |
| D5 | First POS adapter gate | 2 | 4 | 2 | 3 | Track POS frequency and export shape across pilots | Same POS or stable format works in three stores | No repeated vendor or format | Do not build a POS-specific adapter |
| D6 | Import conflict workload | 2 | 4 | 3 | 4 | Measure blocking conflicts per 100 staged rows and review time | Conflict workload falls after approved aliases and repeated imports | Every import remains manually expensive | Treat integration as service or narrow supported catalog |
| D7 | Inventory confidence calibration | 2 | 5 | 3 | 4 | Compare confidence labels with surprise physical checks | High confidence has a materially lower mismatch rate than medium and low | Confidence does not predict mismatch | Rework the model before using it for publication |

## Decision Support Proof

| ID | Experiment | Evidence | Value | Speed | Build safety | Smallest test | Pass | Fail or kill | Build consequence |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- |
| A1 | Rules-based markdown | 3 | 3 | 4 | 5 | Give the owner explainable suggestions for at least ten validated lines | Owner accepts or edits and acts on at least five | Reference prices are unsupported or suggestions are repeatedly rejected | Keep pricing manual |
| A2 | Reorder shadow draft | 3 | 3 | 3 | 4 | Produce a non-actioning draft alongside the owner's real order | Owner uses or materially edits it and it identifies a missed need | Data cannot reconcile or draft suggests obvious overstock | Do not expose reorder automation |
| A3 | Owner daily summary | 3 | 4 | 5 | 5 | Send a concise daily summary through the preferred channel | Owner opens or acts on it on at least 10 of 14 days | It is ignored or creates support questions without action | Remove or change channel and content |
| A4 | Supplier and return CRM | 2 | 2 | 4 | 5 | Track top ten suppliers and one expiry-return opportunity | One verified return, order improvement, or display action | High field effort with no core workflow effect | Keep outside the main product |
| A5 | Exception-first dashboard | 3 | 4 | 4 | 5 | Show only actions requiring attention rather than broad analytics | Manager resolves real issues faster and returns without prompting | Dashboard is read but does not change action | Avoid expanding analytics surfaces |

## Future Vision And Camera Proof

These experiments are not authorized for the 30-day beta. They require reliable catalog identity, clear privacy policy, and a separate approval.

| ID | Experiment | Evidence | Value | Speed | Build safety | Smallest test | Pass | Fail or kill | Build consequence |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- |
| V1 | Shelf-gap task shadow | 1 | 2 | 2 | 1 | Compare camera-generated count tasks with human shelf ground truth | Useful task precision and recall without stock writes | Occlusion, lighting, or layout creates too many false tasks | Do not integrate cameras |
| V2 | Set-aside photo evidence | 2 | 2 | 4 | 4 | Optional photo at publication and closeout, used only for audit | Reduces mismatch investigation time without staff resistance | Adds friction or sensitive background capture | Remove photo requirement |
| V3 | Anonymous traffic zones | 1 | 2 | 2 | 2 | Count anonymous zone visits and compare with receipts by time window | Aggregate signal adds a decision the owner acts on | No actionable lift or privacy burden dominates | Reject CCTV analytics |
| V4 | First-party personalization | 1 | 3 | 2 | 3 | After consent and enough repeat pickups, rank Offers by prior categories | Better qualified conversion without sensitive inference | Sparse data, user discomfort, or no lift | Keep generic ranking |
| V5 | Model-assisted price suggestion | 1 | 3 | 1 | 2 | Shadow model recommendations against owner decisions and rules | Consistent improvement over rules with explainable constraints | Unstable output or unsupported price provenance | Retain deterministic rules |

## Experiment Operating Rules

- Record raw counts, not only percentages.
- Define the eligible population before an experiment starts.
- Do not change success criteria after seeing results.
- Separate seller-caused failures, buyer cancellations, and no-shows.
- Track founder and operator time as a cost.
- A failed experiment removes scope. It does not automatically generate a larger build.
- Feature flags isolate every productized experiment.
- No experiment may weaken the hard technical invariants in `SHARED_CONTEXT.md`.

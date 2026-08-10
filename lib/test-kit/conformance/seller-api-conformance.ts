/**
 * Seller facade conformance suite.
 *
 * Every SellerStoreApiV2 implementation must satisfy these blocks. Like the
 * buyer suite it depends only on the coordinator contracts in lib/contracts,
 * the facade interfaces in lib/api, and the harness contract declared in
 * buyer-api-conformance.ts. It never imports a concrete implementation, so the
 * same file runs against the in memory fake today and against the Supabase
 * backed facade later.
 *
 * See the header of buyer-api-conformance.ts for the harness contract itself
 * and for why these modules live outside __tests__.
 */

import type { SellerStoreApiV2 } from "@/lib/api";
import type {
  InventorySummaryV2,
  StagedSourceRecordV2,
} from "@/lib/contracts";

import {
  buildPublishInput,
  buildReserveInput,
  expectErrorCode,
  expectOk,
  isoPlusMinutes,
  publishOffer,
  requirePickupCode,
  type ConformanceHarness,
  type MakeConformanceHarness,
} from "./buyer-api-conformance";

function findSummary(
  summaries: InventorySummaryV2[],
  storeProductId: string
): InventorySummaryV2 {
  const summary = summaries.find(
    (entry) => entry.storeProductId === storeProductId
  );
  if (!summary) {
    throw new Error(`missing inventory summary for ${storeProductId}`);
  }
  return summary;
}

function findStagedRecord(
  records: StagedSourceRecordV2[],
  rawName: string
): StagedSourceRecordV2 {
  const record = records.find((candidate) => candidate.rawName === rawName);
  if (!record) {
    throw new Error(`missing staged record for ${rawName}`);
  }
  return record;
}

export function runSellerApiConformance(
  makeHarness: MakeConformanceHarness
): void {
  describe("SellerStoreApiV2 conformance", () => {
    let harness: ConformanceHarness;
    let owner: SellerStoreApiV2;
    let manager: SellerStoreApiV2;
    let staff: SellerStoreApiV2;
    let stranger: SellerStoreApiV2;

    beforeEach(() => {
      harness = makeHarness();
      owner = harness.sellerApi({ userId: harness.scenario.ownerUserId });
      manager = harness.sellerApi({ userId: harness.scenario.managerUserId });
      staff = harness.sellerApi({ userId: harness.scenario.staffUserId });
      stranger = harness.sellerApi({ userId: harness.scenario.strangerUserId });
    });

    describe("memberships and inventory reads", () => {
      it("returns memberships with role and store flags and nothing for a stranger", async () => {
        const mine = expectOk(await manager.getMyStoreMembershipsV2());

        expect(mine).toHaveLength(1);
        expect(mine[0]).toMatchObject({
          storeId: harness.scenario.storeId,
          storeName: harness.scenario.storeName,
          role: "manager",
        });
        expect(mine[0].storeFlags).toEqual({
          pilotModeEnabled: true,
          shopSellerBetaEnabled: true,
        });
        expect(expectOk(await stranger.getMyStoreMembershipsV2())).toEqual([]);
      });

      it("lists inventory with allocated and max offerable quantities", async () => {
        const summaries = expectOk(
          await staff.listStoreInventoryV2(harness.scenario.storeId)
        );

        const high = findSummary(
          summaries,
          harness.scenario.highConfidenceProductId
        );
        expect(high.confidence).toBe("high");
        expect(high.allocatedQuantity).toBe(0);
        expect(high.maxOfferableQuantity).toBe(high.onHandQuantity);
        expect(high.hasOpenExceptions).toBe(false);

        const low = findSummary(
          summaries,
          harness.scenario.lowConfidenceProductId
        );
        expect(low.confidence).not.toBe("high");
        expect(low.maxOfferableQuantity).toBe(0);
      });

      it("refuses inventory, pickups and exceptions for a non member with forbidden", async () => {
        expectErrorCode(
          await stranger.listStoreInventoryV2(harness.scenario.storeId),
          "forbidden"
        );
        expectErrorCode(
          await stranger.listSellerPickupsV2(harness.scenario.storeId),
          "forbidden"
        );
        expectErrorCode(
          await stranger.listStoreExceptionsV2(harness.scenario.storeId),
          "forbidden"
        );
      });

      it("refuses cross store access by a member of another store with forbidden", async () => {
        const otherOwner = harness.sellerApi({
          userId: harness.scenario.otherStoreOwnerUserId,
        });

        expectErrorCode(
          await otherOwner.listStoreInventoryV2(harness.scenario.storeId),
          "forbidden"
        );
        expectErrorCode(
          await manager.listStoreInventoryV2(harness.scenario.otherStoreId),
          "forbidden"
        );
      });
    });

    describe("listExpiryWatchlistV2", () => {
      it("orders urgent products first, preserves negative days, and keeps suggestions client-side", async () => {
        const items = expectOk(
          await staff.listExpiryWatchlistV2(harness.scenario.storeId)
        );

        expect(items.map((item) => item.storeProductId)).toEqual([
          harness.scenario.expiredProductId,
          harness.scenario.highConfidenceProductId,
          harness.scenario.lowConfidenceProductId,
        ]);
        const todayMs = Date.parse(
          new Date(harness.scenario.now).toISOString().slice(0, 10)
        );
        expect(items.map((item) => item.daysToExpiry)).toEqual(
          items.map((item) =>
            Math.round((Date.parse(item.expiryDate) - todayMs) / 86_400_000)
          )
        );
        expect(items[0].daysToExpiry).toBe(-1);
        expect(items[0]).not.toHaveProperty("suggestion");
        expect(items[0]).not.toHaveProperty("action");
        expect(items[0]).not.toHaveProperty("discountPercent");
      });

      it("surfaces a paused offer allocated from the product", async () => {
        const published = await publishOffer(harness);
        expectOk(
          await manager.pauseOfferV2({
            storeId: harness.scenario.storeId,
            offerId: published.id,
            idempotencyKey: "pause-expiry-watch-offer",
            expectedVersion: published.version,
          })
        );

        const items = expectOk(
          await manager.listExpiryWatchlistV2(harness.scenario.storeId)
        );
        const product = items.find(
          (item) =>
            item.storeProductId === harness.scenario.highConfidenceProductId
        );

        expect(product?.activeOfferId).toBe(published.id);
      });

      it("refuses non-members and cross-store reads with forbidden", async () => {
        const otherOwner = harness.sellerApi({
          userId: harness.scenario.otherStoreOwnerUserId,
        });

        expectErrorCode(
          await stranger.listExpiryWatchlistV2(harness.scenario.storeId),
          "forbidden"
        );
        expectErrorCode(
          await otherOwner.listExpiryWatchlistV2(harness.scenario.storeId),
          "forbidden"
        );
        expectErrorCode(
          await manager.listExpiryWatchlistV2(harness.scenario.otherStoreId),
          "forbidden"
        );
      });
    });

    describe("recordInventoryCountV2", () => {
      it("lets staff record a count and proposes one adjustment per differing line", async () => {
        const before = expectOk(
          await staff.listStoreInventoryV2(harness.scenario.storeId)
        );
        const high = findSummary(
          before,
          harness.scenario.highConfidenceProductId
        );
        const low = findSummary(before, harness.scenario.lowConfidenceProductId);

        const proposals = expectOk(
          await staff.recordInventoryCountV2({
            storeId: harness.scenario.storeId,
            countSessionId: "count-session-1",
            lines: [
              {
                storeProductId: high.storeProductId,
                observedQuantity: high.onHandQuantity - 2,
              },
              {
                storeProductId: low.storeProductId,
                observedQuantity: low.onHandQuantity,
              },
            ],
          })
        );

        expect(proposals).toHaveLength(1);
        expect(proposals[0]).toMatchObject({
          storeId: harness.scenario.storeId,
          storeProductId: high.storeProductId,
          currentQuantity: high.onHandQuantity,
          proposedQuantity: high.onHandQuantity - 2,
          delta: -2,
          reason: "count",
          status: "pending",
          createdByRole: "staff",
          version: 1,
        });
      });

      it("refreshes lastVerifiedAt and confidence on every counted product", async () => {
        expectOk(
          await staff.recordInventoryCountV2({
            storeId: harness.scenario.storeId,
            countSessionId: "count-session-1",
            lines: [
              {
                storeProductId: harness.scenario.lowConfidenceProductId,
                observedQuantity: 6,
              },
            ],
          })
        );

        const summaries = expectOk(
          await staff.listStoreInventoryV2(harness.scenario.storeId)
        );
        const low = findSummary(
          summaries,
          harness.scenario.lowConfidenceProductId
        );
        expect(low.confidence).toBe("high");
        expect(low.lastVerifiedAt).toBe(harness.scenario.now);
      });

      it("replays the same proposals for a repeated countSessionId", async () => {
        const input = {
          storeId: harness.scenario.storeId,
          countSessionId: "count-session-1",
          lines: [
            {
              storeProductId: harness.scenario.highConfidenceProductId,
              observedQuantity: 4,
            },
          ],
        };
        const first = expectOk(await staff.recordInventoryCountV2(input));

        const replay = expectOk(await staff.recordInventoryCountV2(input));

        expect(replay).toEqual(first);
        expect(replay.map((proposal) => proposal.id)).toEqual(
          first.map((proposal) => proposal.id)
        );
      });

      it("refuses a replayed countSessionId whose lines changed", async () => {
        expectOk(
          await staff.recordInventoryCountV2({
            storeId: harness.scenario.storeId,
            countSessionId: "count-session-1",
            lines: [
              {
                storeProductId: harness.scenario.highConfidenceProductId,
                observedQuantity: 4,
              },
            ],
          })
        );

        // Same session id, different observation. This is a caller reusing an
        // id for a second count, not retrying the first, and handing back the
        // first count's proposals would answer a question nobody asked.
        expectErrorCode(
          await staff.recordInventoryCountV2({
            storeId: harness.scenario.storeId,
            countSessionId: "count-session-1",
            lines: [
              {
                storeProductId: harness.scenario.highConfidenceProductId,
                observedQuantity: 3,
              },
            ],
          }),
          "idempotency_conflict"
        );
      });

      it("refuses a countSessionId already claimed by another store", async () => {
        expectOk(
          await staff.recordInventoryCountV2({
            storeId: harness.scenario.storeId,
            countSessionId: "count-session-1",
            lines: [
              {
                storeProductId: harness.scenario.highConfidenceProductId,
                observedQuantity: 4,
              },
            ],
          })
        );

        const otherOwner = harness.sellerApi({
          userId: harness.scenario.otherStoreOwnerUserId,
        });

        // The id belongs to the first store. The second store must hear that,
        // not an empty proposal list that reads as "everything you counted
        // matched", and never the other store's proposals.
        expectErrorCode(
          await otherOwner.recordInventoryCountV2({
            storeId: harness.scenario.otherStoreId,
            countSessionId: "count-session-1",
            lines: [
              {
                storeProductId: harness.scenario.highConfidenceProductId,
                observedQuantity: 4,
              },
            ],
          }),
          "idempotency_conflict"
        );
      });

      it("keeps a discrepant line unpublishable until the adjustment is approved", async () => {
        const before = findSummary(
          expectOk(await staff.listStoreInventoryV2(harness.scenario.storeId)),
          harness.scenario.highConfidenceProductId
        );
        const observed = before.onHandQuantity - 3;

        const proposals = expectOk(
          await staff.recordInventoryCountV2({
            storeId: harness.scenario.storeId,
            countSessionId: "count-session-1",
            lines: [
              {
                storeProductId: before.storeProductId,
                observedQuantity: observed,
              },
            ],
          })
        );

        // The counter has just proven the ledger wrong. Until a manager
        // approves the correction, the product is not something a publish
        // ceiling may lean on, so it drops out of the offerable pool entirely
        // rather than staying publishable at the quantity everyone now knows
        // is stale.
        const afterCount = findSummary(
          expectOk(await staff.listStoreInventoryV2(harness.scenario.storeId)),
          harness.scenario.highConfidenceProductId
        );
        expect(afterCount.confidence).not.toBe("high");
        expect(afterCount.onHandQuantity).toBe(before.onHandQuantity);
        expect(afterCount.maxOfferableQuantity).toBe(0);

        expectErrorCode(
          await manager.approveAndPublishOfferV2(
            buildPublishInput(harness, {
              idempotencyKey: "publish-after-count",
              allocation: {
                storeProductId: before.storeProductId,
                quantity: observed,
                physicallySetAside: false,
              },
            })
          ),
          "allocation_exceeded"
        );

        expectOk(
          await manager.approveStockAdjustmentV2({
            storeId: harness.scenario.storeId,
            proposalId: proposals[0].id,
            decision: "approve",
            idempotencyKey: "approve-after-count",
            expectedVersion: proposals[0].version,
          })
        );

        // Approval is a manager confirming the physical count, so the product
        // is verified now in a way the bare count was not, and it becomes
        // publishable at the quantity that was actually on the shelf.
        const afterApproval = findSummary(
          expectOk(await staff.listStoreInventoryV2(harness.scenario.storeId)),
          harness.scenario.highConfidenceProductId
        );
        expect(afterApproval.confidence).toBe("high");
        expect(afterApproval.onHandQuantity).toBe(observed);
        expect(afterApproval.maxOfferableQuantity).toBe(observed);

        expectOk(
          await manager.approveAndPublishOfferV2(
            buildPublishInput(harness, {
              idempotencyKey: "publish-after-approval",
              allocation: {
                storeProductId: before.storeProductId,
                quantity: observed,
                physicallySetAside: false,
              },
            })
          )
        );
      });

      it("refuses a count from a non member with forbidden", async () => {
        expectErrorCode(
          await stranger.recordInventoryCountV2({
            storeId: harness.scenario.storeId,
            countSessionId: "count-session-1",
            lines: [
              {
                storeProductId: harness.scenario.highConfidenceProductId,
                observedQuantity: 1,
              },
            ],
          }),
          "forbidden"
        );
      });
    });

    describe("approveStockAdjustmentV2", () => {
      async function proposeShrink(): Promise<{
        proposalId: string;
        version: number;
        onHandBefore: number;
      }> {
        const summaries = expectOk(
          await staff.listStoreInventoryV2(harness.scenario.storeId)
        );
        const high = findSummary(
          summaries,
          harness.scenario.highConfidenceProductId
        );
        const proposals = expectOk(
          await staff.recordInventoryCountV2({
            storeId: harness.scenario.storeId,
            countSessionId: "count-session-1",
            lines: [
              {
                storeProductId: high.storeProductId,
                observedQuantity: high.onHandQuantity - 2,
              },
            ],
          })
        );
        return {
          proposalId: proposals[0].id,
          version: proposals[0].version,
          onHandBefore: high.onHandQuantity,
        };
      }

      it("refuses adjustment approval by staff with forbidden", async () => {
        const proposal = await proposeShrink();

        expectErrorCode(
          await staff.approveStockAdjustmentV2({
            storeId: harness.scenario.storeId,
            proposalId: proposal.proposalId,
            decision: "approve",
            idempotencyKey: "approve-key-1",
            expectedVersion: proposal.version,
          }),
          "forbidden"
        );
      });

      it("applies an approved delta to the on hand quantity", async () => {
        const proposal = await proposeShrink();

        const applied = expectOk(
          await manager.approveStockAdjustmentV2({
            storeId: harness.scenario.storeId,
            proposalId: proposal.proposalId,
            decision: "approve",
            idempotencyKey: "approve-key-1",
            expectedVersion: proposal.version,
          })
        );

        expect(applied.status).toBe("applied");
        expect(applied.version).toBe(proposal.version + 1);
        const summaries = expectOk(
          await manager.listStoreInventoryV2(harness.scenario.storeId)
        );
        expect(
          findSummary(summaries, harness.scenario.highConfidenceProductId)
            .onHandQuantity
        ).toBe(proposal.onHandBefore - 2);
      });

      it("leaves the on hand quantity untouched when the proposal is rejected", async () => {
        const proposal = await proposeShrink();

        const rejected = expectOk(
          await owner.approveStockAdjustmentV2({
            storeId: harness.scenario.storeId,
            proposalId: proposal.proposalId,
            decision: "reject",
            idempotencyKey: "reject-key-1",
            expectedVersion: proposal.version,
          })
        );

        expect(rejected.status).toBe("rejected");
        const summaries = expectOk(
          await owner.listStoreInventoryV2(harness.scenario.storeId)
        );
        expect(
          findSummary(summaries, harness.scenario.highConfidenceProductId)
            .onHandQuantity
        ).toBe(proposal.onHandBefore);
      });

      it("refuses an approval that would drive the on hand quantity negative", async () => {
        const low = findSummary(
          expectOk(await staff.listStoreInventoryV2(harness.scenario.storeId)),
          harness.scenario.lowConfidenceProductId
        );

        // Two counts of the same product taken before either was reviewed.
        // Each proposal is computed against the same starting quantity, so
        // applying both would remove twice the stock that ever existed.
        const first = expectOk(
          await staff.recordInventoryCountV2({
            storeId: harness.scenario.storeId,
            countSessionId: "count-session-negative-1",
            lines: [
              { storeProductId: low.storeProductId, observedQuantity: 0 },
            ],
          })
        );
        const second = expectOk(
          await staff.recordInventoryCountV2({
            storeId: harness.scenario.storeId,
            countSessionId: "count-session-negative-2",
            lines: [
              { storeProductId: low.storeProductId, observedQuantity: 0 },
            ],
          })
        );

        expectOk(
          await manager.approveStockAdjustmentV2({
            storeId: harness.scenario.storeId,
            proposalId: first[0].id,
            decision: "approve",
            idempotencyKey: "approve-negative-1",
            expectedVersion: first[0].version,
          })
        );

        expectErrorCode(
          await manager.approveStockAdjustmentV2({
            storeId: harness.scenario.storeId,
            proposalId: second[0].id,
            decision: "approve",
            idempotencyKey: "approve-negative-2",
            expectedVersion: second[0].version,
          }),
          "validation_failed"
        );

        expect(
          findSummary(
            expectOk(await staff.listStoreInventoryV2(harness.scenario.storeId)),
            harness.scenario.lowConfidenceProductId
          ).onHandQuantity
        ).toBe(0);
      });

      it("refuses a downward adjustment that would undercut a live offer", async () => {
        const before = findSummary(
          expectOk(await staff.listStoreInventoryV2(harness.scenario.storeId)),
          harness.scenario.highConfidenceProductId
        );

        // Every unit on the shelf is now promised to buyers through a live
        // offer that is backed by the ledger and nothing else.
        await publishOffer(harness, {
          allocation: {
            storeProductId: before.storeProductId,
            quantity: before.onHandQuantity,
            physicallySetAside: false,
          },
        });

        const proposals = expectOk(
          await staff.recordInventoryCountV2({
            storeId: harness.scenario.storeId,
            countSessionId: "count-session-undercut",
            lines: [
              {
                storeProductId: before.storeProductId,
                observedQuantity: before.onHandQuantity - 5,
              },
            ],
          })
        );

        // The resulting quantity is comfortably positive, so the plain non
        // negative floor would wave this through, and half the promised units
        // would quietly stop existing.
        expectErrorCode(
          await manager.approveStockAdjustmentV2({
            storeId: harness.scenario.storeId,
            proposalId: proposals[0].id,
            decision: "approve",
            idempotencyKey: "approve-undercut",
            expectedVersion: proposals[0].version,
          }),
          "validation_failed"
        );

        expect(
          findSummary(
            expectOk(await staff.listStoreInventoryV2(harness.scenario.storeId)),
            harness.scenario.highConfidenceProductId
          ).onHandQuantity
        ).toBe(before.onHandQuantity);
      });

      it("allows a downward adjustment under a physically set aside offer", async () => {
        const before = findSummary(
          expectOk(await staff.listStoreInventoryV2(harness.scenario.storeId)),
          harness.scenario.lowConfidenceProductId
        );

        // A set aside offer's units left the shelf when it was published, so
        // they are not in the ledger number and the guard above must not read
        // them as a promise this row still has to keep.
        await publishOffer(harness, {
          allocation: {
            storeProductId: before.storeProductId,
            quantity: 2,
            physicallySetAside: true,
          },
        });

        const proposals = expectOk(
          await staff.recordInventoryCountV2({
            storeId: harness.scenario.storeId,
            countSessionId: "count-session-set-aside",
            lines: [
              { storeProductId: before.storeProductId, observedQuantity: 1 },
            ],
          })
        );

        expectOk(
          await manager.approveStockAdjustmentV2({
            storeId: harness.scenario.storeId,
            proposalId: proposals[0].id,
            decision: "approve",
            idempotencyKey: "approve-set-aside",
            expectedVersion: proposals[0].version,
          })
        );

        expect(
          findSummary(
            expectOk(await staff.listStoreInventoryV2(harness.scenario.storeId)),
            harness.scenario.lowConfidenceProductId
          ).onHandQuantity
        ).toBe(1);
      });

      it("returns version_conflict for a stale expectedVersion", async () => {
        const proposal = await proposeShrink();

        expectErrorCode(
          await manager.approveStockAdjustmentV2({
            storeId: harness.scenario.storeId,
            proposalId: proposal.proposalId,
            decision: "approve",
            idempotencyKey: "approve-key-1",
            expectedVersion: proposal.version + 5,
          }),
          "version_conflict"
        );
      });

      it("returns invalid_state when a terminal proposal is decided again under a new key", async () => {
        const proposal = await proposeShrink();
        const applied = expectOk(
          await manager.approveStockAdjustmentV2({
            storeId: harness.scenario.storeId,
            proposalId: proposal.proposalId,
            decision: "approve",
            idempotencyKey: "approve-key-1",
            expectedVersion: proposal.version,
          })
        );

        expectErrorCode(
          await manager.approveStockAdjustmentV2({
            storeId: harness.scenario.storeId,
            proposalId: proposal.proposalId,
            decision: "reject",
            idempotencyKey: "approve-key-2",
            expectedVersion: applied.version,
          }),
          "invalid_state"
        );
      });

      it("replays the stored decision for a repeated idempotencyKey", async () => {
        const proposal = await proposeShrink();
        const input = {
          storeId: harness.scenario.storeId,
          proposalId: proposal.proposalId,
          decision: "approve" as const,
          idempotencyKey: "approve-key-1",
          expectedVersion: proposal.version,
        };
        const first = expectOk(await manager.approveStockAdjustmentV2(input));

        const replay = expectOk(await manager.approveStockAdjustmentV2(input));

        expect(replay).toEqual(first);
        const summaries = expectOk(
          await manager.listStoreInventoryV2(harness.scenario.storeId)
        );
        expect(
          findSummary(summaries, harness.scenario.highConfidenceProductId)
            .onHandQuantity
        ).toBe(proposal.onHandBefore - 2);
      });
    });

    describe("approveAndPublishOfferV2", () => {
      it("publishes a live offer at version one with the allocated quantity", async () => {
        const offer = expectOk(
          await manager.approveAndPublishOfferV2(buildPublishInput(harness))
        );

        expect(offer.status).toBe("live");
        expect(offer.version).toBe(1);
        expect(offer.quantityAvailable).toBe(2);
        expect(offer.storeId).toBe(harness.scenario.storeId);
        expect(offer.storeName).toBe(harness.scenario.storeName);
        expect(offer.timezone).toBe(harness.scenario.timezone);
      });

      it("refuses publication by staff with forbidden", async () => {
        expectErrorCode(
          await staff.approveAndPublishOfferV2(buildPublishInput(harness)),
          "forbidden"
        );
      });

      it("refuses publication into another store with forbidden", async () => {
        expectErrorCode(
          await manager.approveAndPublishOfferV2(
            buildPublishInput(harness, {
              storeId: harness.scenario.otherStoreId,
            })
          ),
          "forbidden"
        );
      });

      it("rejects an allocation above the high confidence offerable maximum", async () => {
        const summaries = expectOk(
          await manager.listStoreInventoryV2(harness.scenario.storeId)
        );
        const high = findSummary(
          summaries,
          harness.scenario.highConfidenceProductId
        );

        expectErrorCode(
          await manager.approveAndPublishOfferV2(
            buildPublishInput(harness, {
              allocation: {
                storeProductId: high.storeProductId,
                quantity: high.maxOfferableQuantity + 1,
                physicallySetAside: false,
              },
            })
          ),
          "allocation_exceeded"
        );
      });

      it("rejects a low confidence allocation that is not physically set aside", async () => {
        expectErrorCode(
          await manager.approveAndPublishOfferV2(
            buildPublishInput(harness, {
              allocation: {
                storeProductId: harness.scenario.lowConfidenceProductId,
                quantity: 1,
                physicallySetAside: false,
              },
            })
          ),
          "allocation_exceeded"
        );
      });

      it("accepts a low confidence allocation that is physically set aside", async () => {
        const offer = expectOk(
          await manager.approveAndPublishOfferV2(
            buildPublishInput(harness, {
              allocation: {
                storeProductId: harness.scenario.lowConfidenceProductId,
                quantity: 3,
                physicallySetAside: true,
              },
            })
          )
        );

        expect(offer.status).toBe("live");
        expect(offer.quantityAvailable).toBe(3);
      });

      it("rejects publishing an expired product with validation_failed", async () => {
        expectErrorCode(
          await manager.approveAndPublishOfferV2(
            buildPublishInput(harness, {
              allocation: {
                storeProductId: harness.scenario.expiredProductId,
                quantity: 1,
                physicallySetAside: true,
              },
            })
          ),
          "validation_failed"
        );
      });

      it("rejects an invalid pickup window with validation_failed", async () => {
        expectErrorCode(
          await manager.approveAndPublishOfferV2(
            buildPublishInput(harness, {
              pickupStart: harness.scenario.pickupEnd,
              pickupEnd: harness.scenario.pickupStart,
            })
          ),
          "validation_failed"
        );
        expectErrorCode(
          await manager.approveAndPublishOfferV2(
            buildPublishInput(harness, {
              idempotencyKey: "publish-key-past",
              pickupStart: isoPlusMinutes(harness.scenario.now, -120),
              pickupEnd: isoPlusMinutes(harness.scenario.now, -60),
            })
          ),
          "validation_failed"
        );
      });

      it("derives discountPercent from the reference price and leaves it null without one", async () => {
        const discounted = expectOk(
          await manager.approveAndPublishOfferV2(
            buildPublishInput(harness, {
              offerPriceUzs: 20000,
              referencePriceUzs: 50000,
            })
          )
        );
        const undiscounted = expectOk(
          await manager.approveAndPublishOfferV2(
            buildPublishInput(harness, {
              idempotencyKey: "publish-key-2",
              offerPriceUzs: 20000,
              referencePriceUzs: null,
            })
          )
        );

        expect(discounted.discountPercent).toBe(60);
        expect(undiscounted.discountPercent).toBeNull();
      });

      it("replays the same offer for a repeated idempotencyKey without duplicating", async () => {
        const first = await publishOffer(harness);

        const replay = await publishOffer(harness);

        expect(replay).toEqual(first);
        const offers = expectOk(
          await harness.buyerApi().listMarketplaceOffersV2()
        );
        expect(offers).toHaveLength(1);
      });

      it("returns idempotency_conflict when a publish key is reused with a different allocation", async () => {
        await publishOffer(harness);

        expectErrorCode(
          await manager.approveAndPublishOfferV2(
            buildPublishInput(harness, {
              allocation: {
                storeProductId: harness.scenario.highConfidenceProductId,
                quantity: 3,
                physicallySetAside: false,
              },
            })
          ),
          "idempotency_conflict"
        );
      });

      it("decrements the offerable pool by the published allocation", async () => {
        const before = findSummary(
          expectOk(await manager.listStoreInventoryV2(harness.scenario.storeId)),
          harness.scenario.highConfidenceProductId
        );

        await publishOffer(harness);

        const after = findSummary(
          expectOk(await manager.listStoreInventoryV2(harness.scenario.storeId)),
          harness.scenario.highConfidenceProductId
        );
        expect(after.allocatedQuantity).toBe(2);
        expect(after.maxOfferableQuantity).toBe(before.maxOfferableQuantity - 2);
        expect(after.onHandQuantity).toBe(before.onHandQuantity);
      });

      it("aggregates the allocations of every live offer on the same product", async () => {
        const before = findSummary(
          expectOk(await manager.listStoreInventoryV2(harness.scenario.storeId)),
          harness.scenario.highConfidenceProductId
        );

        await publishOffer(harness, {
          allocation: {
            storeProductId: harness.scenario.highConfidenceProductId,
            quantity: 2,
            physicallySetAside: false,
          },
        });
        await publishOffer(harness, {
          idempotencyKey: "publish-key-2",
          title: "Second rescue box",
          allocation: {
            storeProductId: harness.scenario.highConfidenceProductId,
            quantity: 3,
            physicallySetAside: false,
          },
        });

        const after = findSummary(
          expectOk(await manager.listStoreInventoryV2(harness.scenario.storeId)),
          harness.scenario.highConfidenceProductId
        );
        expect(after.allocatedQuantity).toBe(5);
        expect(after.maxOfferableQuantity).toBe(before.onHandQuantity - 5);
        expectErrorCode(
          await manager.approveAndPublishOfferV2(
            buildPublishInput(harness, {
              idempotencyKey: "publish-key-3",
              allocation: {
                storeProductId: harness.scenario.highConfidenceProductId,
                quantity: after.maxOfferableQuantity + 1,
                physicallySetAside: false,
              },
            })
          ),
          "allocation_exceeded"
        );
      });

      it("appends an audit entry and an offer_published outbox event", async () => {
        const auditBefore = harness.listAuditEntries().length;
        const outboxBefore = harness.listOutboxEvents().length;

        await publishOffer(harness);

        const audit = harness.listAuditEntries();
        const outbox = harness.listOutboxEvents();
        expect(audit.length).toBe(auditBefore + 1);
        expect(outbox.length).toBe(outboxBefore + 1);
        expect(audit[audit.length - 1]).toMatchObject({
          command: "approveAndPublishOfferV2",
          storeId: harness.scenario.storeId,
          actorUserId: harness.scenario.managerUserId,
          at: harness.scenario.now,
        });
        expect(outbox[outbox.length - 1].name).toBe("offer_published");
      });
    });

    describe("pauseOfferV2", () => {
      it("pauses a live offer, bumps the version and replays for a repeated key", async () => {
        const offer = await publishOffer(harness);
        const input = {
          storeId: harness.scenario.storeId,
          offerId: offer.id,
          idempotencyKey: "pause-key-1",
          expectedVersion: offer.version,
        };

        const paused = expectOk(await manager.pauseOfferV2(input));
        const replay = expectOk(await manager.pauseOfferV2(input));

        expect(paused.status).toBe("paused");
        expect(paused.version).toBe(offer.version + 1);
        expect(replay).toEqual(paused);
      });

      it("returns version_conflict when pausing with a stale expectedVersion", async () => {
        const offer = await publishOffer(harness);

        expectErrorCode(
          await manager.pauseOfferV2({
            storeId: harness.scenario.storeId,
            offerId: offer.id,
            idempotencyKey: "pause-key-1",
            expectedVersion: offer.version + 7,
          }),
          "version_conflict"
        );
      });

      it("refuses a pause by staff with forbidden", async () => {
        const offer = await publishOffer(harness);

        expectErrorCode(
          await staff.pauseOfferV2({
            storeId: harness.scenario.storeId,
            offerId: offer.id,
            idempotencyKey: "pause-key-1",
            expectedVersion: offer.version,
          }),
          "forbidden"
        );
      });

      it("checks the caller role before replaying a stored idempotency key", async () => {
        const offer = await publishOffer(harness);
        const input = {
          storeId: harness.scenario.storeId,
          offerId: offer.id,
          idempotencyKey: "pause-key-1",
          expectedVersion: offer.version,
        };
        expectOk(await manager.pauseOfferV2(input));

        expectErrorCode(await staff.pauseOfferV2(input), "forbidden");
      });

      it("returns not_found when pausing an offer that does not exist", async () => {
        expectErrorCode(
          await manager.pauseOfferV2({
            storeId: harness.scenario.storeId,
            offerId: "offer-that-does-not-exist",
            idempotencyKey: "pause-key-1",
            expectedVersion: 1,
          }),
          "not_found"
        );
      });
    });

    describe("listStoreOffersV2", () => {
      it("lists a member's offers in every status, newest first, including paused", async () => {
        const first = await publishOffer(harness);
        const second = await publishOffer(harness, {
          idempotencyKey: "publish-key-2",
          title: "Second rescue box",
        });
        expectOk(
          await manager.pauseOfferV2({
            storeId: harness.scenario.storeId,
            offerId: second.id,
            idempotencyKey: "pause-key-1",
            expectedVersion: second.version,
          })
        );

        const offers = expectOk(
          await staff.listStoreOffersV2(harness.scenario.storeId)
        );

        expect(offers.map((offer) => offer.id)).toEqual([second.id, first.id]);
        expect(offers[0].status).toBe("paused");
        expect(offers[1].status).toBe("live");
      });

      it("refuses a non member with forbidden", async () => {
        await publishOffer(harness);

        expectErrorCode(
          await stranger.listStoreOffersV2(harness.scenario.storeId),
          "forbidden"
        );
      });

      it("never returns offers of another store to a member of that other store", async () => {
        await publishOffer(harness);
        const otherOwner = harness.sellerApi({
          userId: harness.scenario.otherStoreOwnerUserId,
        });

        expectErrorCode(
          await otherOwner.listStoreOffersV2(harness.scenario.storeId),
          "forbidden"
        );
        expectErrorCode(
          await manager.listStoreOffersV2(harness.scenario.otherStoreId),
          "forbidden"
        );
      });

      it("expires a past pickup end offer in the seller list while the buyer marketplace list omits it", async () => {
        const offer = await publishOffer(harness);

        harness.setNow(isoPlusMinutes(harness.scenario.pickupEnd, 60));

        const sellerOffers = expectOk(
          await manager.listStoreOffersV2(harness.scenario.storeId)
        );
        expect(sellerOffers).toEqual([
          expect.objectContaining({ id: offer.id, status: "expired" }),
        ]);

        const buyer = harness.buyerApi();
        expect(expectOk(await buyer.listMarketplaceOffersV2())).toEqual([]);
      });
    });

    describe("listSellerPickupsV2", () => {
      it("lists the store pickups newest first with only the code hint", async () => {
        const offer = await publishOffer(harness);
        const buyer = harness.buyerApi();
        const first = expectOk(
          await buyer.reserveOfferV2(buildReserveInput(harness, offer))
        );
        harness.setNow(isoPlusMinutes(harness.scenario.now, 60));
        const second = expectOk(
          await buyer.reserveOfferV2(
            buildReserveInput(harness, offer, {
              clientReservationId: "client-reservation-2",
              installationId: harness.scenario.installationB,
              expectedOfferVersion: offer.version + 1,
            })
          )
        );

        const pickups = expectOk(
          await manager.listSellerPickupsV2(harness.scenario.storeId)
        );

        expect(pickups.map((pickup) => pickup.reservationId)).toEqual([
          second.reservation.id,
          first.reservation.id,
        ]);
        expect(pickups[0]).toMatchObject({
          offerId: offer.id,
          offerTitle: offer.title,
          status: "held",
          pickupCodeHint: requirePickupCode(second).slice(-2),
        });
        const serialized = JSON.stringify(pickups);
        expect(serialized).not.toContain(requirePickupCode(first));
        expect(serialized).not.toContain(requirePickupCode(second));
      });
    });

    describe("fulfillReservationV2", () => {
      async function holdOne(): Promise<{
        offerId: string;
        reservationId: string;
        pickupCode: string;
      }> {
        const offer = await publishOffer(harness);
        const held = expectOk(
          await harness.buyerApi().reserveOfferV2(buildReserveInput(harness, offer))
        );
        return {
          offerId: offer.id,
          reservationId: held.reservation.id,
          pickupCode: requirePickupCode(held),
        };
      }

      it("fulfills a held reservation matched by the exact pickup code", async () => {
        const held = await holdOne();

        const pickup = expectOk(
          await manager.fulfillReservationV2({
            storeId: harness.scenario.storeId,
            pickupCode: held.pickupCode,
            idempotencyKey: "fulfill-key-1",
          })
        );

        expect(pickup.reservationId).toBe(held.reservationId);
        expect(pickup.status).toBe("fulfilled");
        expect(pickup.pickupCodeHint).toBe(held.pickupCode.slice(-2));
      });

      it("returns not_found for an unknown code and invalid_state for a terminal reservation", async () => {
        const held = await holdOne();

        expectErrorCode(
          await manager.fulfillReservationV2({
            storeId: harness.scenario.storeId,
            pickupCode: "ZZ9999",
            idempotencyKey: "fulfill-key-1",
          }),
          "not_found"
        );

        expectOk(
          await harness.buyerApi().cancelReservationV2({
            reservationId: held.reservationId,
            installationId: harness.scenario.installationA,
            idempotencyKey: "cancel-key-1",
          })
        );
        expectErrorCode(
          await manager.fulfillReservationV2({
            storeId: harness.scenario.storeId,
            pickupCode: held.pickupCode,
            idempotencyKey: "fulfill-key-2",
          }),
          "invalid_state"
        );
      });

      it("records exactly one inventory decrement even when the fulfilment replays", async () => {
        const held = await holdOne();
        const before = findSummary(
          expectOk(await manager.listStoreInventoryV2(harness.scenario.storeId)),
          harness.scenario.highConfidenceProductId
        );
        const input = {
          storeId: harness.scenario.storeId,
          pickupCode: held.pickupCode,
          idempotencyKey: "fulfill-key-1",
        };

        const first = expectOk(await manager.fulfillReservationV2(input));
        const replay = expectOk(await manager.fulfillReservationV2(input));

        expect(replay).toEqual(first);
        const after = findSummary(
          expectOk(await manager.listStoreInventoryV2(harness.scenario.storeId)),
          harness.scenario.highConfidenceProductId
        );
        expect(after.onHandQuantity).toBe(before.onHandQuantity - 1);
      });

      it("fulfils every hold on a physically set aside offer even once the ledger reads zero", async () => {
        const buyer = harness.buyerApi();
        const low = findSummary(
          expectOk(await manager.listStoreInventoryV2(harness.scenario.storeId)),
          harness.scenario.lowConfidenceProductId
        );

        // Two units pulled off the shelf and put behind the counter. The
        // ledger never backed this offer, which is the whole point of the
        // physical set aside path.
        const offer = await publishOffer(harness, {
          allocation: {
            storeProductId: low.storeProductId,
            quantity: 2,
            physicallySetAside: true,
          },
        });

        // Meanwhile the ledger for that product is corrected down to a single
        // unit, less than the two the set aside offer promises.
        const proposals = expectOk(
          await staff.recordInventoryCountV2({
            storeId: harness.scenario.storeId,
            countSessionId: "count-session-set-aside-fulfil",
            lines: [{ storeProductId: low.storeProductId, observedQuantity: 1 }],
          })
        );
        expectOk(
          await manager.approveStockAdjustmentV2({
            storeId: harness.scenario.storeId,
            proposalId: proposals[0].id,
            decision: "approve",
            idempotencyKey: "approve-set-aside-fulfil",
            expectedVersion: proposals[0].version,
          })
        );

        const firstHold = expectOk(
          await buyer.reserveOfferV2(buildReserveInput(harness, offer))
        );
        const afterFirst = expectOk(await buyer.getMarketplaceOfferV2(offer.id));
        const secondHold = expectOk(
          await buyer.reserveOfferV2(
            buildReserveInput(harness, afterFirst, {
              clientReservationId: "client-reservation-2",
              installationId: harness.scenario.installationB,
            })
          )
        );

        // Both buyers are entitled to the unit that is physically waiting for
        // them, so neither handover may be refused on ledger grounds. The
        // ledger floors at zero instead of going negative.
        expectOk(
          await manager.fulfillReservationV2({
            storeId: harness.scenario.storeId,
            pickupCode: requirePickupCode(firstHold),
            idempotencyKey: "fulfill-set-aside-1",
          })
        );
        expectOk(
          await manager.fulfillReservationV2({
            storeId: harness.scenario.storeId,
            pickupCode: requirePickupCode(secondHold),
            idempotencyKey: "fulfill-set-aside-2",
          })
        );

        expect(
          findSummary(
            expectOk(await manager.listStoreInventoryV2(harness.scenario.storeId)),
            harness.scenario.lowConfidenceProductId
          ).onHandQuantity
        ).toBe(0);
      });

      it("refuses fulfilment by staff with forbidden", async () => {
        const held = await holdOne();

        expectErrorCode(
          await staff.fulfillReservationV2({
            storeId: harness.scenario.storeId,
            pickupCode: held.pickupCode,
            idempotencyKey: "fulfill-key-1",
          }),
          "forbidden"
        );
      });

      it("appends an audit entry and a reservation_fulfilled outbox event", async () => {
        const held = await holdOne();
        const auditBefore = harness.listAuditEntries().length;
        const outboxBefore = harness.listOutboxEvents().length;

        expectOk(
          await owner.fulfillReservationV2({
            storeId: harness.scenario.storeId,
            pickupCode: held.pickupCode,
            idempotencyKey: "fulfill-key-1",
          })
        );

        const audit = harness.listAuditEntries();
        const outbox = harness.listOutboxEvents();
        expect(audit.length).toBe(auditBefore + 1);
        expect(outbox.length).toBe(outboxBefore + 1);
        expect(audit[audit.length - 1]).toMatchObject({
          command: "fulfillReservationV2",
          actorUserId: harness.scenario.ownerUserId,
        });
        expect(outbox[outbox.length - 1].name).toBe("reservation_fulfilled");
      });
    });

    describe("reportStockMismatchV2", () => {
      const ALLOCATED = 3;

      /**
       * Publishes one offer for three units of the high confidence product and
       * holds two of them from two different installations, so a mismatch has to
       * fail more than a single reservation row and one unit is left unsold.
       */
      async function publishAndHoldTwo(): Promise<{
        offerId: string;
        offerVersion: number;
        reservationIds: string[];
      }> {
        const offer = await publishOffer(harness, {
          allocation: {
            storeProductId: harness.scenario.highConfidenceProductId,
            quantity: ALLOCATED,
            physicallySetAside: false,
          },
        });
        const buyer = harness.buyerApi();
        const first = expectOk(
          await buyer.reserveOfferV2(buildReserveInput(harness, offer))
        );
        const second = expectOk(
          await buyer.reserveOfferV2(
            buildReserveInput(harness, offer, {
              clientReservationId: "client-reservation-2",
              installationId: harness.scenario.installationB,
              expectedOfferVersion: offer.version + 1,
            })
          )
        );
        return {
          offerId: offer.id,
          offerVersion: offer.version + 2,
          reservationIds: [first.reservation.id, second.reservation.id],
        };
      }

      it("pauses the offer and fails every held reservation without releasing units", async () => {
        const context = await publishAndHoldTwo();

        const result = expectOk(
          await manager.reportStockMismatchV2({
            storeId: harness.scenario.storeId,
            offerId: context.offerId,
            observedQuantity: 0,
            reason: "shelf was empty",
            idempotencyKey: "mismatch-key-1",
          })
        );

        expect(result.offer.status).toBe("paused");
        expect(result.offer.version).toBe(context.offerVersion + 1);
        expect(result.offer.quantityAvailable).toBe(1);
        const pickups = expectOk(
          await manager.listSellerPickupsV2(harness.scenario.storeId)
        );
        const statusById = new Map(
          pickups.map((pickup) => [pickup.reservationId, pickup.status])
        );
        expect(statusById.get(context.reservationIds[0])).toBe(
          "failed_stock_mismatch"
        );
        expect(statusById.get(context.reservationIds[1])).toBe(
          "failed_stock_mismatch"
        );
        expect(
          pickups.filter((pickup) => pickup.status === "failed_stock_mismatch")
        ).toHaveLength(2);
      });

      it("keeps the mismatched units allocated so the offerable pool does not grow", async () => {
        const before = findSummary(
          expectOk(await manager.listStoreInventoryV2(harness.scenario.storeId)),
          harness.scenario.highConfidenceProductId
        );
        const context = await publishAndHoldTwo();
        const during = findSummary(
          expectOk(await manager.listStoreInventoryV2(harness.scenario.storeId)),
          harness.scenario.highConfidenceProductId
        );

        expectOk(
          await manager.reportStockMismatchV2({
            storeId: harness.scenario.storeId,
            offerId: context.offerId,
            observedQuantity: 0,
            reason: "shelf was empty",
            idempotencyKey: "mismatch-key-1",
          })
        );

        const after = findSummary(
          expectOk(await manager.listStoreInventoryV2(harness.scenario.storeId)),
          harness.scenario.highConfidenceProductId
        );
        expect(during.allocatedQuantity).toBe(ALLOCATED);
        expect(during.maxOfferableQuantity).toBe(
          before.onHandQuantity - ALLOCATED
        );
        expect(after.allocatedQuantity).toBe(during.allocatedQuantity);
        expect(after.maxOfferableQuantity).toBe(during.maxOfferableQuantity);
      });

      it("keeps mismatch encumbrance alive after offer expiry when the lazy sweep runs", async () => {
        const base = findSummary(
          expectOk(await manager.listStoreInventoryV2(harness.scenario.storeId)),
          harness.scenario.highConfidenceProductId
        );
        const context = await publishAndHoldTwo();

        expectOk(
          await manager.reportStockMismatchV2({
            storeId: harness.scenario.storeId,
            offerId: context.offerId,
            observedQuantity: 0,
            reason: "shelf was empty",
            idempotencyKey: "mismatch-key-1",
          })
        );

        harness.setNow(isoPlusMinutes(harness.scenario.pickupEnd, 60));

        expectOk(await harness.buyerApi().listMarketplaceOffersV2());

        const afterExpiry = findSummary(
          expectOk(await manager.listStoreInventoryV2(harness.scenario.storeId)),
          harness.scenario.highConfidenceProductId
        );

        expect(afterExpiry.allocatedQuantity).toBe(2);
        expect(afterExpiry.maxOfferableQuantity).toBe(base.maxOfferableQuantity - 2);
      });

      it("opens a stock_mismatch exception and flags the product as having open exceptions", async () => {
        const context = await publishAndHoldTwo();

        const result = expectOk(
          await manager.reportStockMismatchV2({
            storeId: harness.scenario.storeId,
            offerId: context.offerId,
            observedQuantity: 0,
            reason: "shelf was empty",
            idempotencyKey: "mismatch-key-1",
          })
        );

        expect(result.exception).toMatchObject({
          storeId: harness.scenario.storeId,
          kind: "stock_mismatch",
          status: "open",
          relatedOfferId: context.offerId,
        });
        const exceptions = expectOk(
          await manager.listStoreExceptionsV2(harness.scenario.storeId)
        );
        expect(exceptions.map((entry) => entry.id)).toContain(
          result.exception.id
        );
        const summaries = expectOk(
          await manager.listStoreInventoryV2(harness.scenario.storeId)
        );
        expect(
          findSummary(summaries, harness.scenario.highConfidenceProductId)
            .hasOpenExceptions
        ).toBe(true);
      });

      it("replays the same mismatch result for a repeated idempotencyKey", async () => {
        const context = await publishAndHoldTwo();
        const input = {
          storeId: harness.scenario.storeId,
          offerId: context.offerId,
          observedQuantity: 0,
          reason: "shelf was empty",
          idempotencyKey: "mismatch-key-1",
        };
        const first = expectOk(await manager.reportStockMismatchV2(input));

        const replay = expectOk(await manager.reportStockMismatchV2(input));

        expect(replay).toEqual(first);
        const exceptions = expectOk(
          await manager.listStoreExceptionsV2(harness.scenario.storeId)
        );
        expect(exceptions).toHaveLength(1);
        expect(replay.offer.version).toBe(first.offer.version);
      });

      it("refuses stock mismatch reporting by staff with forbidden", async () => {
        const context = await publishAndHoldTwo();

        expectErrorCode(
          await staff.reportStockMismatchV2({
            storeId: harness.scenario.storeId,
            offerId: context.offerId,
            observedQuantity: 0,
            reason: "shelf was empty",
            idempotencyKey: "mismatch-key-1",
          }),
          "forbidden"
        );
      });

      it("appends an audit entry and an offer_stock_mismatch outbox event", async () => {
        const context = await publishAndHoldTwo();
        const auditBefore = harness.listAuditEntries().length;
        const outboxBefore = harness.listOutboxEvents().length;

        expectOk(
          await manager.reportStockMismatchV2({
            storeId: harness.scenario.storeId,
            offerId: context.offerId,
            observedQuantity: 0,
            reason: "shelf was empty",
            idempotencyKey: "mismatch-key-1",
          })
        );

        const audit = harness.listAuditEntries();
        const outbox = harness.listOutboxEvents();
        expect(audit.length).toBe(auditBefore + 1);
        expect(outbox.length).toBe(outboxBefore + 1);
        expect(audit[audit.length - 1].command).toBe("reportStockMismatchV2");
        expect(outbox[outbox.length - 1].name).toBe("offer_stock_mismatch");
      });
    });

    describe("resolveStoreExceptionV2", () => {
      async function openMismatch(): Promise<{
        exceptionId: string;
        failedReservationCount: number;
      }> {
        const offer = await publishOffer(harness, {
          allocation: {
            storeProductId: harness.scenario.highConfidenceProductId,
            quantity: 3,
            physicallySetAside: false,
          },
        });
        const buyer = harness.buyerApi();
        expectOk(await buyer.reserveOfferV2(buildReserveInput(harness, offer)));
        expectOk(
          await buyer.reserveOfferV2(
            buildReserveInput(harness, offer, {
              clientReservationId: "resolve-client-reservation-2",
              installationId: harness.scenario.installationB,
              expectedOfferVersion: offer.version + 1,
            })
          )
        );
        const mismatch = expectOk(
          await manager.reportStockMismatchV2({
            storeId: harness.scenario.storeId,
            offerId: offer.id,
            observedQuantity: 0,
            reason: "two reserved bags could not be found",
            idempotencyKey: "resolve-mismatch-key",
          })
        );
        return {
          exceptionId: mismatch.exception.id,
          failedReservationCount: 2,
        };
      }

      it("refuses exception resolution by staff with forbidden", async () => {
        const opened = await openMismatch();

        expectErrorCode(
          await staff.resolveStoreExceptionV2({
            storeId: harness.scenario.storeId,
            exceptionId: opened.exceptionId,
            resolutionNote: "Verified the shelf and corrected the discrepancy",
            idempotencyKey: "resolve-key-staff",
          }),
          "forbidden"
        );
      });

      it("refuses exception resolution by a non member with forbidden", async () => {
        const opened = await openMismatch();

        expectErrorCode(
          await stranger.resolveStoreExceptionV2({
            storeId: harness.scenario.storeId,
            exceptionId: opened.exceptionId,
            resolutionNote: "Attempted by a non member",
            idempotencyKey: "resolve-key-stranger",
          }),
          "forbidden"
        );
      });

      it("releases mismatch capacity and permits publishing at the recovered ceiling", async () => {
        const opened = await openMismatch();
        const whileOpen = findSummary(
          expectOk(await manager.listStoreInventoryV2(harness.scenario.storeId)),
          harness.scenario.highConfidenceProductId
        );
        const auditBefore = harness.listAuditEntries().length;
        const outboxBefore = harness.listOutboxEvents().length;

        const resolved = expectOk(
          await manager.resolveStoreExceptionV2({
            storeId: harness.scenario.storeId,
            exceptionId: opened.exceptionId,
            resolutionNote: "Counted the shelf and confirmed the failed units are available",
            idempotencyKey: "resolve-key-capacity",
          })
        );

        expect(resolved.status).toBe("resolved");
        expect(resolved.resolutionNote).toBe(
          "Counted the shelf and confirmed the failed units are available"
        );
        expect(resolved.resolvedAt).not.toBeNull();

        const afterResolve = findSummary(
          expectOk(await manager.listStoreInventoryV2(harness.scenario.storeId)),
          harness.scenario.highConfidenceProductId
        );
        expect(afterResolve.allocatedQuantity).toBe(
          whileOpen.allocatedQuantity - opened.failedReservationCount
        );
        expect(afterResolve.maxOfferableQuantity).toBe(
          whileOpen.maxOfferableQuantity + opened.failedReservationCount
        );
        expect(afterResolve.hasOpenExceptions).toBe(false);
        const audit = harness.listAuditEntries();
        const outbox = harness.listOutboxEvents();
        expect(audit).toHaveLength(auditBefore + 1);
        expect(audit[audit.length - 1]).toMatchObject({
          command: "resolveStoreExceptionV2",
          actorUserId: harness.scenario.managerUserId,
          storeId: harness.scenario.storeId,
        });
        expect(outbox).toHaveLength(outboxBefore + 1);
        expect(outbox[outbox.length - 1]).toMatchObject({
          name: "exception_resolved",
          storeId: harness.scenario.storeId,
        });

        expectOk(
          await manager.approveAndPublishOfferV2(
            buildPublishInput(harness, {
              idempotencyKey: "publish-at-recovered-ceiling",
              allocation: {
                storeProductId: harness.scenario.highConfidenceProductId,
                quantity: afterResolve.maxOfferableQuantity,
                physicallySetAside: false,
              },
            })
          )
        );
      });

      it("replays the same resolved exception for the same idempotency key", async () => {
        const opened = await openMismatch();
        const input = {
          storeId: harness.scenario.storeId,
          exceptionId: opened.exceptionId,
          resolutionNote: "Shelf count completed",
          idempotencyKey: "resolve-key-replay",
        };

        const first = expectOk(await owner.resolveStoreExceptionV2(input));
        const replay = expectOk(await owner.resolveStoreExceptionV2(input));

        expect(replay).toEqual(first);
      });

      it("returns invalid_state for a resolved exception with a fresh key", async () => {
        const opened = await openMismatch();
        expectOk(
          await manager.resolveStoreExceptionV2({
            storeId: harness.scenario.storeId,
            exceptionId: opened.exceptionId,
            resolutionNote: "Shelf count completed",
            idempotencyKey: "resolve-key-first",
          })
        );

        expectErrorCode(
          await manager.resolveStoreExceptionV2({
            storeId: harness.scenario.storeId,
            exceptionId: opened.exceptionId,
            resolutionNote: "Trying to resolve the same exception again",
            idempotencyKey: "resolve-key-fresh",
          }),
          "invalid_state"
        );
      });

      it("requires a non empty resolution note", async () => {
        const opened = await openMismatch();

        expectErrorCode(
          await manager.resolveStoreExceptionV2({
            storeId: harness.scenario.storeId,
            exceptionId: opened.exceptionId,
            resolutionNote: "   ",
            idempotencyKey: "resolve-key-empty-note",
          }),
          "validation_failed"
        );
      });
    });

    describe("canonical CSV import upload and matching", () => {
      const matchingRecords = [
        {
          rawName: "Fresh bread loaf",
          rawBarcode: "4780000000011",
          rawQuantity: 10,
        },
        { rawName: "FRESH BREAD LOAF" },
        {
          rawName: "Duplicate barcode source",
          rawBarcode: "CSV-DUPLICATE-BARCODE",
        },
        { rawName: "No catalog match" },
      ];

      it("lets staff, manager, and owner upload records and read their batches", async () => {
        const uploaders = [staff, manager, owner];

        for (const [index, uploader] of uploaders.entries()) {
          const batch = expectOk(
            await uploader.uploadImportBatchV2({
              storeId: harness.scenario.storeId,
              filename: `role-${index + 1}.csv`,
              records: [matchingRecords[0]],
              idempotencyKey: `role-upload-${index + 1}`,
            })
          );
          expect(batch).toMatchObject({
            storeId: harness.scenario.storeId,
            filename: `role-${index + 1}.csv`,
            status: "needs_review",
            totalRecords: 1,
            pendingRecords: 1,
            createdAt: expect.any(String),
          });
        }

        const batches = expectOk(
          await staff.listImportBatchesV2(harness.scenario.storeId)
        );
        expect(batches.map((batch) => batch.filename)).toEqual([
          "role-3.csv",
          "role-2.csv",
          "role-1.csv",
        ]);
      });

      it("uses the first populated matching tier and never auto approves ambiguity", async () => {
        const batch = expectOk(
          await staff.uploadImportBatchV2({
            storeId: harness.scenario.storeId,
            filename: "matching.csv",
            records: matchingRecords,
            idempotencyKey: "matching-upload",
          })
        );

        const records = expectOk(
          await staff.listStagedRecordsV2(harness.scenario.storeId, batch.id)
        );
        const barcode = findStagedRecord(records, "Fresh bread loaf");
        const productName = findStagedRecord(records, "FRESH BREAD LOAF");
        const ambiguous = findStagedRecord(
          records,
          "Duplicate barcode source"
        );
        const unmatched = findStagedRecord(records, "No catalog match");
        expect(records).toHaveLength(4);
        expect(barcode).toMatchObject({
          rawName: "Fresh bread loaf",
          rawBarcode: "4780000000011",
          rawQuantity: 10,
          rawPrice: null,
          matchStatus: "auto_matched",
          matchedStoreProductId: harness.scenario.highConfidenceProductId,
          candidates: [
            {
              storeProductId: harness.scenario.highConfidenceProductId,
              productName: "Fresh bread loaf",
              reason: "barcode",
            },
          ],
        });
        expect(productName).toMatchObject({
          matchStatus: "auto_matched",
          matchedStoreProductId: harness.scenario.highConfidenceProductId,
          candidates: [
            {
              storeProductId: harness.scenario.highConfidenceProductId,
              reason: "product_name",
            },
          ],
        });
        expect(ambiguous.matchStatus).toBe("ambiguous");
        expect(ambiguous.matchedStoreProductId).toBeNull();
        expect(ambiguous.candidates).toHaveLength(2);
        expect(ambiguous.candidates.map((candidate) => candidate.reason)).toEqual([
          "barcode",
          "barcode",
        ]);
        expect(unmatched).toMatchObject({
          matchStatus: "unmatched",
          matchedStoreProductId: null,
          candidates: [],
        });
      });

      it("replays an upload by key and rejects a changed upload fingerprint", async () => {
        const input = {
          storeId: harness.scenario.storeId,
          filename: "replay.csv",
          records: matchingRecords,
          idempotencyKey: "upload-replay-key",
        };
        const first = expectOk(await manager.uploadImportBatchV2(input));
        const replay = expectOk(await manager.uploadImportBatchV2(input));

        expect(replay).toEqual(first);
        expect(
          expectOk(await manager.listImportBatchesV2(harness.scenario.storeId))
        ).toHaveLength(1);
        expect(
          expectOk(
            await manager.listStagedRecordsV2(
              harness.scenario.storeId,
              first.id
            )
          )
        ).toHaveLength(matchingRecords.length);

        expectErrorCode(
          await manager.uploadImportBatchV2({
            ...input,
            filename: "changed.csv",
          }),
          "idempotency_conflict"
        );
        expectErrorCode(
          await manager.uploadImportBatchV2({
            ...input,
            records: [...matchingRecords, { rawName: "Changed records" }],
          }),
          "idempotency_conflict"
        );

        const otherOwner = harness.sellerApi({
          userId: harness.scenario.otherStoreOwnerUserId,
        });
        expectErrorCode(await otherOwner.uploadImportBatchV2(input), "forbidden");
      });

      it("denies staff decisions and all cross store import access", async () => {
        const batch = expectOk(
          await staff.uploadImportBatchV2({
            storeId: harness.scenario.storeId,
            filename: "authorization.csv",
            records: [{ rawName: "Rejected source row" }],
            idempotencyKey: "authorization-upload",
          })
        );
        const records = expectOk(
          await staff.listStagedRecordsV2(harness.scenario.storeId, batch.id)
        );
        const record = findStagedRecord(records, "Rejected source row");
        const otherOwner = harness.sellerApi({
          userId: harness.scenario.otherStoreOwnerUserId,
        });

        expectErrorCode(
          await staff.decideStagedRecordV2({
            storeId: harness.scenario.storeId,
            recordId: record.id,
            decision: "reject",
            targetStoreProductId: null,
            idempotencyKey: "staff-decision",
          }),
          "forbidden"
        );
        expectErrorCode(
          await otherOwner.uploadImportBatchV2({
            storeId: harness.scenario.storeId,
            filename: "cross-store.csv",
            records: [{ rawName: "Cross store upload" }],
            idempotencyKey: "cross-store-upload",
          }),
          "forbidden"
        );
        expectErrorCode(
          await otherOwner.decideStagedRecordV2({
            storeId: harness.scenario.storeId,
            recordId: record.id,
            decision: "reject",
            targetStoreProductId: null,
            idempotencyKey: "cross-store-decision",
          }),
          "forbidden"
        );
        expectErrorCode(
          await otherOwner.listImportBatchesV2(harness.scenario.storeId),
          "forbidden"
        );
        expectErrorCode(
          await otherOwner.listStagedRecordsV2(
            harness.scenario.storeId,
            batch.id
          ),
          "forbidden"
        );
        expectErrorCode(
          await otherOwner.listStagedRecordsV2(
            harness.scenario.otherStoreId,
            batch.id
          ),
          "not_found"
        );
      });

      it("approves a new product with an alias and applies barcode before alias before name", async () => {
        const sourceBatch = expectOk(
          await manager.uploadImportBatchV2({
            storeId: harness.scenario.storeId,
            filename: "new-product.csv",
            records: [
              {
                rawName: "Day old pastry batch",
                rawBarcode: "CSV-NEW-BARCODE",
                rawQuantity: 3,
              },
            ],
            idempotencyKey: "new-product-upload",
          })
        );
        const sourceRecords = expectOk(
          await manager.listStagedRecordsV2(
            harness.scenario.storeId,
            sourceBatch.id
          )
        );
        const source = findStagedRecord(
          sourceRecords,
          "Day old pastry batch"
        );
        const decided = expectOk(
          await manager.decideStagedRecordV2({
            storeId: harness.scenario.storeId,
            recordId: source.id,
            decision: "approve",
            targetStoreProductId: null,
            idempotencyKey: "approve-new-product",
          })
        );

        expect(decided.matchStatus).toBe("approved");
        expect(decided.matchedStoreProductId).not.toBeNull();
        const inventory = expectOk(
          await manager.listStoreInventoryV2(harness.scenario.storeId)
        );
        expect(
          findSummary(inventory, decided.matchedStoreProductId as string)
        ).toMatchObject({
          productName: "Day old pastry batch",
          barcode: "CSV-NEW-BARCODE",
          onHandQuantity: 0,
          confidence: "low",
          lastVerifiedAt: expect.any(String),
        });
        const effects = harness.listImportEffects();
        expect(effects.aliases).toContainEqual({
          storeId: harness.scenario.storeId,
          storeProductId: decided.matchedStoreProductId,
          alias: "Day old pastry batch",
          approved: true,
        });
        expect(effects.observations).toContainEqual(
          expect.objectContaining({
            storeId: harness.scenario.storeId,
            storeProductId: decided.matchedStoreProductId,
            stagedSourceRecordId: source.id,
            observedQuantity: 3,
            confidence: "low",
            createdAt: expect.any(String),
          })
        );
        expect(effects.proposals).toContainEqual(
          expect.objectContaining({
            storeId: harness.scenario.storeId,
            storeProductId: decided.matchedStoreProductId,
            currentQuantity: 0,
            proposedQuantity: 3,
            delta: 3,
            status: "pending",
            createdByRole: "manager",
          })
        );

        const precedenceBatch = expectOk(
          await manager.uploadImportBatchV2({
            storeId: harness.scenario.storeId,
            filename: "tier-precedence.csv",
            records: [
              {
                rawName: "Day old pastry batch",
                rawBarcode: "4780000000011",
              },
              { rawName: "DAY OLD PASTRY BATCH" },
            ],
            idempotencyKey: "tier-precedence-upload",
          })
        );
        const precedence = expectOk(
          await manager.listStagedRecordsV2(
            harness.scenario.storeId,
            precedenceBatch.id
          )
        );
        const barcodePrecedence = findStagedRecord(
          precedence,
          "Day old pastry batch"
        );
        const aliasPrecedence = findStagedRecord(
          precedence,
          "DAY OLD PASTRY BATCH"
        );
        expect(barcodePrecedence).toMatchObject({
          matchedStoreProductId: harness.scenario.highConfidenceProductId,
          candidates: [
            {
              storeProductId: harness.scenario.highConfidenceProductId,
              reason: "barcode",
            },
          ],
        });
        expect(aliasPrecedence).toMatchObject({
          matchedStoreProductId: decided.matchedStoreProductId,
          candidates: [
            {
              storeProductId: decided.matchedStoreProductId,
              reason: "alias",
            },
          ],
        });
      });

      it("records low confidence quantity evidence and proposes differences without writing on hand", async () => {
        const before = findSummary(
          expectOk(
            await manager.listStoreInventoryV2(harness.scenario.storeId)
          ),
          harness.scenario.highConfidenceProductId
        );
        const batch = expectOk(
          await manager.uploadImportBatchV2({
            storeId: harness.scenario.storeId,
            filename: "quantity-evidence.csv",
            records: [
              { rawName: "Matching count", rawQuantity: before.onHandQuantity },
              { rawName: "Differing count", rawQuantity: before.onHandQuantity - 3 },
            ],
            idempotencyKey: "quantity-evidence-upload",
          })
        );
        const records = expectOk(
          await manager.listStagedRecordsV2(
            harness.scenario.storeId,
            batch.id
          )
        );
        const matchingCount = findStagedRecord(records, "Matching count");
        const differingCount = findStagedRecord(records, "Differing count");
        expectOk(
          await manager.decideStagedRecordV2({
            storeId: harness.scenario.storeId,
            recordId: matchingCount.id,
            decision: "approve",
            targetStoreProductId: harness.scenario.highConfidenceProductId,
            idempotencyKey: "quantity-decision-matching",
          })
        );
        const differingDecision = expectOk(
          await manager.decideStagedRecordV2({
            storeId: harness.scenario.storeId,
            recordId: differingCount.id,
            decision: "approve",
            targetStoreProductId: harness.scenario.highConfidenceProductId,
            idempotencyKey: "quantity-decision-differing",
          })
        );
        expect(differingDecision).toMatchObject({
          id: differingCount.id,
          matchStatus: "approved",
          matchedStoreProductId: harness.scenario.highConfidenceProductId,
        });

        const after = findSummary(
          expectOk(
            await manager.listStoreInventoryV2(harness.scenario.storeId)
          ),
          harness.scenario.highConfidenceProductId
        );
        expect(after.onHandQuantity).toBe(before.onHandQuantity);
        expect(after.confidence).toBe("low");
        expect(after.lastVerifiedAt).toEqual(expect.any(String));
        const effects = harness.listImportEffects();
        expect(effects.observations).toHaveLength(2);
        expect(effects.observations.map((entry) => entry.confidence)).toEqual([
          "low",
          "low",
        ]);
        expect(effects.proposals).toHaveLength(1);
        expect(effects.proposals[0]).toMatchObject({
          storeProductId: harness.scenario.highConfidenceProductId,
          currentQuantity: before.onHandQuantity,
          proposedQuantity: before.onHandQuantity - 3,
          delta: -3,
          reason: "count",
          status: "pending",
          createdByRole: "manager",
        });
      });

      it("rejects a record and completes its batch after the final first decision", async () => {
        const batch = expectOk(
          await owner.uploadImportBatchV2({
            storeId: harness.scenario.storeId,
            filename: "completion.csv",
            records: [
              { rawName: "Reject this source" },
              { rawName: "Approve this source" },
            ],
            idempotencyKey: "completion-upload",
          })
        );
        const records = expectOk(
          await owner.listStagedRecordsV2(harness.scenario.storeId, batch.id)
        );
        const rejectSource = findStagedRecord(records, "Reject this source");
        const approveSource = findStagedRecord(records, "Approve this source");

        const rejected = expectOk(
          await owner.decideStagedRecordV2({
            storeId: harness.scenario.storeId,
            recordId: rejectSource.id,
            decision: "reject",
            targetStoreProductId: null,
            idempotencyKey: "completion-reject",
          })
        );
        expect(rejected).toMatchObject({
          matchStatus: "rejected",
          matchedStoreProductId: null,
        });
        expect(
          expectOk(await owner.listImportBatchesV2(harness.scenario.storeId))[0]
        ).toMatchObject({ status: "needs_review", pendingRecords: 1 });

        expectOk(
          await owner.decideStagedRecordV2({
            storeId: harness.scenario.storeId,
            recordId: approveSource.id,
            decision: "approve",
            targetStoreProductId: harness.scenario.lowConfidenceProductId,
            idempotencyKey: "completion-approve",
          })
        );
        expect(
          expectOk(await owner.listImportBatchesV2(harness.scenario.storeId))[0]
        ).toMatchObject({ status: "completed", pendingRecords: 0 });
      });

      it("replays one decision without repeating effects and conflicts on every fingerprint field", async () => {
        const batch = expectOk(
          await manager.uploadImportBatchV2({
            storeId: harness.scenario.storeId,
            filename: "decision-replay.csv",
            records: [
              { rawName: "Replay source one" },
              { rawName: "Replay source two" },
            ],
            idempotencyKey: "decision-replay-upload",
          })
        );
        const records = expectOk(
          await manager.listStagedRecordsV2(
            harness.scenario.storeId,
            batch.id
          )
        );
        const replaySourceOne = findStagedRecord(
          records,
          "Replay source one"
        );
        const replaySourceTwo = findStagedRecord(
          records,
          "Replay source two"
        );
        const input = {
          storeId: harness.scenario.storeId,
          recordId: replaySourceOne.id,
          decision: "approve" as const,
          targetStoreProductId: harness.scenario.highConfidenceProductId,
          idempotencyKey: "decision-replay-key",
        };
        const auditBefore = harness.listAuditEntries().length;
        const outboxBefore = harness.listOutboxEvents().length;
        const first = expectOk(await manager.decideStagedRecordV2(input));
        const replay = expectOk(await manager.decideStagedRecordV2(input));

        expect(replay).toEqual(first);
        expect(
          expectOk(await manager.listImportBatchesV2(harness.scenario.storeId))[0]
            .pendingRecords
        ).toBe(1);
        expect(harness.listAuditEntries()).toHaveLength(auditBefore + 1);
        expect(harness.listAuditEntries()[auditBefore]).toMatchObject({
          storeId: harness.scenario.storeId,
          command: "decideStagedRecordV2",
          actorUserId: harness.scenario.managerUserId,
        });
        expect(harness.listOutboxEvents()).toHaveLength(outboxBefore + 1);
        expect(harness.listOutboxEvents()[outboxBefore]).toMatchObject({
          storeId: harness.scenario.storeId,
          name: "staged_record_decided",
        });

        expectErrorCode(
          await manager.decideStagedRecordV2({
            ...input,
            recordId: replaySourceTwo.id,
          }),
          "idempotency_conflict"
        );
        expectErrorCode(
          await manager.decideStagedRecordV2({
            ...input,
            decision: "reject",
            targetStoreProductId: null,
          }),
          "idempotency_conflict"
        );
        expectErrorCode(
          await manager.decideStagedRecordV2({
            ...input,
            targetStoreProductId: harness.scenario.lowConfidenceProductId,
          }),
          "idempotency_conflict"
        );

        const otherOwner = harness.sellerApi({
          userId: harness.scenario.otherStoreOwnerUserId,
        });
        expectErrorCode(
          await otherOwner.decideStagedRecordV2(input),
          "forbidden"
        );
      });

      it("validates the selected target before mutating the staged record", async () => {
        const batch = expectOk(
          await manager.uploadImportBatchV2({
            storeId: harness.scenario.storeId,
            filename: "target-validation.csv",
            records: [{ rawName: "Target validation source" }],
            idempotencyKey: "target-validation-upload",
          })
        );
        const records = expectOk(
          await manager.listStagedRecordsV2(
            harness.scenario.storeId,
            batch.id
          )
        );
        const record = findStagedRecord(records, "Target validation source");

        expectErrorCode(
          await manager.decideStagedRecordV2({
            storeId: harness.scenario.storeId,
            recordId: record.id,
            decision: "approve",
            targetStoreProductId: harness.scenario.otherStoreProductId,
            idempotencyKey: "target-validation-decision",
          }),
          "not_found"
        );
        const afterFailedDecision = expectOk(
          await manager.listStagedRecordsV2(
            harness.scenario.storeId,
            batch.id
          )
        );
        expect(
          findStagedRecord(afterFailedDecision, "Target validation source")
            .matchStatus
        ).toBe("unmatched");
      });
    });
  });
}

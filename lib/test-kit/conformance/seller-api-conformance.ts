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
import type { InventorySummaryV2 } from "@/lib/contracts";

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
  });
}

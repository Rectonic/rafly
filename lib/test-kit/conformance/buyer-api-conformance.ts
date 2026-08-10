/**
 * Buyer facade conformance suite.
 *
 * Every BuyerMarketplaceApiV2 implementation must satisfy these blocks. The
 * suite talks only to the coordinator contracts in lib/contracts and the facade
 * interfaces in lib/api. It never imports a concrete implementation, so the same
 * file runs against the in memory fake today and against the Supabase backed
 * facade later.
 *
 * The harness contract declared below is the only extra surface an
 * implementation has to provide. It is deliberately small:
 *
 * - scenario: stable ids for one pilot store, its members, and three products
 * - buyerApi(): a buyer facade, installation ids arrive inside each input
 * - sellerApi(actor): a seller facade bound to one acting user
 * - setNow(iso): moves the implementation clock, used for expiry behaviour
 * - listAuditEntries(): a copy of the audit trail
 * - listOutboxEvents(): a copy of the transactional outbox
 *
 * makeHarness must return a fresh isolated world on every call, meaning no
 * offers, no reservations, no exceptions and empty ledgers. The seeded scenario
 * must satisfy four things the assertions rely on:
 *
 * 1. the primary store runs in pilot mode with the shop seller beta enabled,
 *    and owner, manager and staff members plus one user with no membership
 * 2. a second store whose only member is otherStoreOwnerUserId
 * 3. three products in the primary store, one high confidence with at least
 *    four units on hand, one below high confidence with at least three units,
 *    and one whose expiryDate is already past
 * 4. pickupStart and pickupEnd sit in the future relative to now, in that order
 *
 * Everything else about the seed data is free.
 *
 * The seller conformance suite imports the same contract from this file so the
 * two suites can share one harness implementation.
 *
 * This module lives outside __tests__ on purpose. The jest config in this repo
 * uses the default testMatch, which treats every .ts file under __tests__ as a
 * suite, and an exported helper module has no top level tests of its own.
 */

import type { BuyerMarketplaceApiV2, SellerStoreApiV2 } from "@/lib/api";
import type {
  CommandError,
  CommandErrorCode,
  MarketplaceOfferV2,
  PublishOfferV2Input,
  ReserveOfferV2Input,
  Result,
} from "@/lib/contracts";

export interface ConformanceScenario {
  now: string;
  storeId: string;
  storeName: string;
  ownerUserId: string;
  managerUserId: string;
  staffUserId: string;
  strangerUserId: string;
  otherStoreId: string;
  otherStoreOwnerUserId: string;
  highConfidenceProductId: string;
  lowConfidenceProductId: string;
  expiredProductId: string;
  pickupStart: string;
  pickupEnd: string;
  timezone: MarketplaceOfferV2["timezone"];
  installationA: string;
  installationB: string;
}

export interface ConformanceAuditEntry {
  storeId: string;
  command: string;
  at: string;
  actorUserId: string | null;
  installationId: string | null;
}

export interface ConformanceOutboxEvent {
  name: string;
  storeId: string;
  at: string;
}

export interface ConformanceHarness {
  scenario: ConformanceScenario;
  buyerApi(): BuyerMarketplaceApiV2;
  sellerApi(actor: { userId: string }): SellerStoreApiV2;
  setNow(iso: string): void;
  listAuditEntries(): ConformanceAuditEntry[];
  listOutboxEvents(): ConformanceOutboxEvent[];
}

export type MakeConformanceHarness = () => ConformanceHarness;

/** Shifts an ISO timestamp so clock assertions stay tied to the scenario. */
export function isoPlusMinutes(iso: string, minutes: number): string {
  return new Date(Date.parse(iso) + minutes * 60000).toISOString();
}

export function expectOk<T>(result: Result<T>): T {
  if (!result.ok) {
    throw new Error(
      `expected an ok result, received ${result.error.code}: ${result.error.message}`
    );
  }
  return result.value;
}

export function expectErrorCode(
  result: Result<unknown>,
  code: CommandErrorCode
): CommandError {
  if (result.ok) {
    throw new Error(`expected error ${code}, received an ok result`);
  }
  expect(result.error.code).toBe(code);
  return result.error;
}

export function buildPublishInput(
  harness: ConformanceHarness,
  overrides: Partial<PublishOfferV2Input> = {}
): PublishOfferV2Input {
  const { scenario } = harness;
  return {
    storeId: scenario.storeId,
    idempotencyKey: "publish-key-1",
    allocation: {
      storeProductId: scenario.highConfidenceProductId,
      quantity: 2,
      physicallySetAside: false,
    },
    title: "Bakery rescue box",
    category: "bakery",
    imageUrl: null,
    contents: ["bread", "pastry"],
    offerPriceUzs: 20000,
    referencePriceUzs: 50000,
    pickupStart: scenario.pickupStart,
    pickupEnd: scenario.pickupEnd,
    allergens: ["gluten"],
    dietaryBadges: ["vegetarian"],
    pickupInstructions: "Ask at the counter",
    cancellationPolicy: "Cancel before pickup start",
    ...overrides,
  };
}

export async function publishOffer(
  harness: ConformanceHarness,
  overrides: Partial<PublishOfferV2Input> = {}
): Promise<MarketplaceOfferV2> {
  const seller = harness.sellerApi({ userId: harness.scenario.managerUserId });
  return expectOk(
    await seller.approveAndPublishOfferV2(buildPublishInput(harness, overrides))
  );
}

export function buildReserveInput(
  harness: ConformanceHarness,
  offer: MarketplaceOfferV2,
  overrides: Partial<ReserveOfferV2Input> = {}
): ReserveOfferV2Input {
  return {
    offerId: offer.id,
    quantity: 1,
    clientReservationId: "client-reservation-1",
    installationId: harness.scenario.installationA,
    expectedOfferVersion: offer.version,
    ...overrides,
  };
}

export function runBuyerApiConformance(makeHarness: MakeConformanceHarness): void {
  describe("BuyerMarketplaceApiV2 conformance", () => {
    let harness: ConformanceHarness;
    let buyer: BuyerMarketplaceApiV2;

    beforeEach(() => {
      harness = makeHarness();
      buyer = harness.buyerApi();
    });

    describe("listMarketplaceOffersV2 and getMarketplaceOfferV2", () => {
      it("lists only live offers with a pickup window still open", async () => {
        const live = await publishOffer(harness);
        const paused = await publishOffer(harness, {
          idempotencyKey: "publish-key-2",
          title: "Paused box",
        });
        const seller = harness.sellerApi({
          userId: harness.scenario.managerUserId,
        });
        expectOk(
          await seller.pauseOfferV2({
            storeId: harness.scenario.storeId,
            offerId: paused.id,
            idempotencyKey: "pause-key-1",
            expectedVersion: paused.version,
          })
        );

        const offers = expectOk(await buyer.listMarketplaceOffersV2());

        expect(offers.map((offer) => offer.id)).toEqual([live.id]);
        expect(offers[0].status).toBe("live");
      });

      it("expires offers past the pickup end on read and never revives them", async () => {
        const offer = await publishOffer(harness);
        expect(expectOk(await buyer.listMarketplaceOffersV2())).toHaveLength(1);

        harness.setNow(isoPlusMinutes(harness.scenario.pickupEnd, 60));
        expect(expectOk(await buyer.listMarketplaceOffersV2())).toEqual([]);
        expect(expectOk(await buyer.getMarketplaceOfferV2(offer.id)).status).toBe(
          "expired"
        );

        harness.setNow(harness.scenario.now);
        expect(expectOk(await buyer.listMarketplaceOffersV2())).toEqual([]);
        expect(expectOk(await buyer.getMarketplaceOfferV2(offer.id)).status).toBe(
          "expired"
        );
      });

      it("returns not_found for an unknown offer on read and on reserve", async () => {
        expectErrorCode(
          await buyer.getMarketplaceOfferV2("offer-that-does-not-exist"),
          "not_found"
        );
        expectErrorCode(
          await buyer.reserveOfferV2({
            offerId: "offer-that-does-not-exist",
            quantity: 1,
            clientReservationId: "client-reservation-missing",
            installationId: harness.scenario.installationA,
            expectedOfferVersion: 1,
          }),
          "not_found"
        );
      });
    });

    describe("reserveOfferV2", () => {
      it("rejects a reservation for more than one unit with validation_failed", async () => {
        const offer = await publishOffer(harness);
        // The contract pins quantity to the literal 1, so the only way to reach
        // the runtime guard is to widen the field for this call.
        const input: ReserveOfferV2Input = {
          ...buildReserveInput(harness, offer),
          quantity: 2 as unknown as ReserveOfferV2Input["quantity"],
        };

        expectErrorCode(await buyer.reserveOfferV2(input), "validation_failed");

        const after = expectOk(await buyer.getMarketplaceOfferV2(offer.id));
        expect(after.quantityAvailable).toBe(offer.quantityAvailable);
        expect(after.version).toBe(offer.version);
      });

      it("rejects a reservation on an offer that is not live with offer_not_live", async () => {
        const offer = await publishOffer(harness);
        const seller = harness.sellerApi({
          userId: harness.scenario.managerUserId,
        });
        const paused = expectOk(
          await seller.pauseOfferV2({
            storeId: harness.scenario.storeId,
            offerId: offer.id,
            idempotencyKey: "pause-key-1",
            expectedVersion: offer.version,
          })
        );

        expectErrorCode(
          await buyer.reserveOfferV2(buildReserveInput(harness, paused)),
          "offer_not_live"
        );
      });

      it("rejects a stale expectedOfferVersion with version_conflict", async () => {
        const offer = await publishOffer(harness);

        expectErrorCode(
          await buyer.reserveOfferV2(
            buildReserveInput(harness, offer, { expectedOfferVersion: 99 })
          ),
          "version_conflict"
        );
      });

      it("returns sold_out once the offer has no quantity available", async () => {
        const offer = await publishOffer(harness, {
          allocation: {
            storeProductId: harness.scenario.highConfidenceProductId,
            quantity: 1,
            physicallySetAside: false,
          },
        });
        expectOk(await buyer.reserveOfferV2(buildReserveInput(harness, offer)));

        const soldOut = expectOk(await buyer.getMarketplaceOfferV2(offer.id));
        expect(soldOut.status).toBe("sold_out");

        expectErrorCode(
          await buyer.reserveOfferV2(
            buildReserveInput(harness, soldOut, {
              clientReservationId: "client-reservation-2",
              installationId: harness.scenario.installationB,
            })
          ),
          "sold_out"
        );
      });

      it("holds one unit, decrements availability and bumps the offer version", async () => {
        const offer = await publishOffer(harness);

        const result = expectOk(
          await buyer.reserveOfferV2(buildReserveInput(harness, offer))
        );

        expect(result.reservation.status).toBe("held");
        expect(result.reservation.quantity).toBe(1);
        expect(result.reservation.version).toBe(1);
        const after = expectOk(await buyer.getMarketplaceOfferV2(offer.id));
        expect(after.quantityAvailable).toBe(1);
        expect(after.version).toBe(offer.version + 1);
        expect(after.status).toBe("live");
      });

      it("flips the offer to sold_out when the last unit is held", async () => {
        const offer = await publishOffer(harness, {
          allocation: {
            storeProductId: harness.scenario.highConfidenceProductId,
            quantity: 1,
            physicallySetAside: false,
          },
        });

        expectOk(await buyer.reserveOfferV2(buildReserveInput(harness, offer)));

        const after = expectOk(await buyer.getMarketplaceOfferV2(offer.id));
        expect(after.status).toBe("sold_out");
        expect(after.quantityAvailable).toBe(0);
        expect(after.version).toBe(offer.version + 1);
      });

      it("issues a six character uppercase pickup code with a two character hint", async () => {
        const offer = await publishOffer(harness);

        const result = expectOk(
          await buyer.reserveOfferV2(buildReserveInput(harness, offer))
        );

        expect(result.pickupCode).toMatch(/^[A-Z0-9]{6}$/);
        expect(result.reservation.pickupCodeHint).toHaveLength(2);
        expect(result.reservation.pickupCodeHint).toBe(result.pickupCode.slice(-2));
      });

      it("freezes the public offer snapshot and holds until the offer pickup end", async () => {
        const offer = await publishOffer(harness);
        const result = expectOk(
          await buyer.reserveOfferV2(buildReserveInput(harness, offer))
        );

        expect(result.reservation.holdExpiresAt).toBe(offer.pickupEnd);
        expect(result.reservation.offerSnapshot.title).toBe(offer.title);
        expect(result.reservation.offerSnapshot.offerPriceUzs).toBe(
          offer.offerPriceUzs
        );

        const seller = harness.sellerApi({
          userId: harness.scenario.managerUserId,
        });
        const current = expectOk(await buyer.getMarketplaceOfferV2(offer.id));
        expectOk(
          await seller.pauseOfferV2({
            storeId: harness.scenario.storeId,
            offerId: offer.id,
            idempotencyKey: "pause-key-1",
            expectedVersion: current.version,
          })
        );

        const reservations = expectOk(
          await buyer.getBuyerReservationsV2(harness.scenario.installationA)
        );
        expect(reservations[0].offerSnapshot.status).not.toBe("paused");
        expect(reservations[0].offerSnapshot.title).toBe(offer.title);
      });

      it("replays the same reservation and the same raw pickup code for a repeated clientReservationId", async () => {
        const offer = await publishOffer(harness);
        const first = expectOk(
          await buyer.reserveOfferV2(buildReserveInput(harness, offer))
        );

        const replay = expectOk(
          await buyer.reserveOfferV2(buildReserveInput(harness, offer))
        );

        expect(replay.reservation.id).toBe(first.reservation.id);
        expect(replay.pickupCode).toBe(first.pickupCode);
        expect(replay).toEqual(first);
        const after = expectOk(await buyer.getMarketplaceOfferV2(offer.id));
        expect(after.quantityAvailable).toBe(1);
        const reservations = expectOk(
          await buyer.getBuyerReservationsV2(harness.scenario.installationA)
        );
        expect(reservations).toHaveLength(1);
      });

      it("returns idempotency_conflict when a clientReservationId is reused for another offer", async () => {
        const offer = await publishOffer(harness);
        const other = await publishOffer(harness, {
          idempotencyKey: "publish-key-2",
          title: "Second box",
        });
        expectOk(await buyer.reserveOfferV2(buildReserveInput(harness, offer)));

        expectErrorCode(
          await buyer.reserveOfferV2(buildReserveInput(harness, other)),
          "idempotency_conflict"
        );
      });

      it("lets exactly one of two clients win the last unit", async () => {
        const offer = await publishOffer(harness, {
          allocation: {
            storeProductId: harness.scenario.highConfidenceProductId,
            quantity: 1,
            physicallySetAside: false,
          },
        });

        const winner = expectOk(
          await buyer.reserveOfferV2(buildReserveInput(harness, offer))
        );
        expectErrorCode(
          await buyer.reserveOfferV2(
            buildReserveInput(harness, offer, {
              clientReservationId: "client-reservation-2",
              installationId: harness.scenario.installationB,
            })
          ),
          "version_conflict"
        );

        const after = expectOk(await buyer.getMarketplaceOfferV2(offer.id));
        expect(after.quantityAvailable).toBe(0);
        expect(
          expectOk(
            await buyer.getBuyerReservationsV2(harness.scenario.installationA)
          ).map((reservation) => reservation.id)
        ).toEqual([winner.reservation.id]);
        expect(
          expectOk(
            await buyer.getBuyerReservationsV2(harness.scenario.installationB)
          )
        ).toEqual([]);
      });

      it("appends an audit entry and a reservation_held outbox event", async () => {
        const offer = await publishOffer(harness);
        const auditBefore = harness.listAuditEntries().length;
        const outboxBefore = harness.listOutboxEvents().length;

        expectOk(await buyer.reserveOfferV2(buildReserveInput(harness, offer)));

        const audit = harness.listAuditEntries();
        const outbox = harness.listOutboxEvents();
        expect(audit.length).toBe(auditBefore + 1);
        expect(outbox.length).toBe(outboxBefore + 1);
        expect(audit[audit.length - 1]).toMatchObject({
          command: "reserveOfferV2",
          storeId: harness.scenario.storeId,
          installationId: harness.scenario.installationA,
          at: harness.scenario.now,
        });
        expect(outbox[outbox.length - 1].name).toBe("reservation_held");
      });
    });

    describe("cancelReservationV2", () => {
      it("releases the unit and flips a sold_out offer back to live", async () => {
        const offer = await publishOffer(harness, {
          allocation: {
            storeProductId: harness.scenario.highConfidenceProductId,
            quantity: 1,
            physicallySetAside: false,
          },
        });
        const held = expectOk(
          await buyer.reserveOfferV2(buildReserveInput(harness, offer))
        );
        const soldOut = expectOk(await buyer.getMarketplaceOfferV2(offer.id));

        const cancelled = expectOk(
          await buyer.cancelReservationV2({
            reservationId: held.reservation.id,
            installationId: harness.scenario.installationA,
            idempotencyKey: "cancel-key-1",
          })
        );

        expect(cancelled.status).toBe("cancelled_by_buyer");
        const after = expectOk(await buyer.getMarketplaceOfferV2(offer.id));
        expect(after.status).toBe("live");
        expect(after.quantityAvailable).toBe(1);
        expect(after.version).toBe(soldOut.version + 1);
      });

      it("refuses cancellation from another installation with forbidden", async () => {
        const offer = await publishOffer(harness);
        const held = expectOk(
          await buyer.reserveOfferV2(buildReserveInput(harness, offer))
        );

        expectErrorCode(
          await buyer.cancelReservationV2({
            reservationId: held.reservation.id,
            installationId: harness.scenario.installationB,
            idempotencyKey: "cancel-key-1",
          }),
          "forbidden"
        );
        const reservations = expectOk(
          await buyer.getBuyerReservationsV2(harness.scenario.installationA)
        );
        expect(reservations[0].status).toBe("held");
      });

      it("replays the same cancellation result for a repeated idempotencyKey", async () => {
        const offer = await publishOffer(harness);
        const held = expectOk(
          await buyer.reserveOfferV2(buildReserveInput(harness, offer))
        );
        const input = {
          reservationId: held.reservation.id,
          installationId: harness.scenario.installationA,
          idempotencyKey: "cancel-key-1",
        };
        const first = expectOk(await buyer.cancelReservationV2(input));
        const afterFirst = expectOk(await buyer.getMarketplaceOfferV2(offer.id));

        const replay = expectOk(await buyer.cancelReservationV2(input));

        expect(replay).toEqual(first);
        const afterReplay = expectOk(await buyer.getMarketplaceOfferV2(offer.id));
        expect(afterReplay.quantityAvailable).toBe(afterFirst.quantityAvailable);
        expect(afterReplay.version).toBe(afterFirst.version);
      });

      it("rejects cancelling a terminal reservation with invalid_state", async () => {
        const offer = await publishOffer(harness);
        const held = expectOk(
          await buyer.reserveOfferV2(buildReserveInput(harness, offer))
        );
        expectOk(
          await buyer.cancelReservationV2({
            reservationId: held.reservation.id,
            installationId: harness.scenario.installationA,
            idempotencyKey: "cancel-key-1",
          })
        );

        expectErrorCode(
          await buyer.cancelReservationV2({
            reservationId: held.reservation.id,
            installationId: harness.scenario.installationA,
            idempotencyKey: "cancel-key-2",
          }),
          "invalid_state"
        );
      });

      it("appends an audit entry and a reservation_cancelled outbox event", async () => {
        const offer = await publishOffer(harness);
        const held = expectOk(
          await buyer.reserveOfferV2(buildReserveInput(harness, offer))
        );
        const auditBefore = harness.listAuditEntries().length;
        const outboxBefore = harness.listOutboxEvents().length;

        expectOk(
          await buyer.cancelReservationV2({
            reservationId: held.reservation.id,
            installationId: harness.scenario.installationA,
            idempotencyKey: "cancel-key-1",
          })
        );

        const audit = harness.listAuditEntries();
        const outbox = harness.listOutboxEvents();
        expect(audit.length).toBe(auditBefore + 1);
        expect(outbox.length).toBe(outboxBefore + 1);
        expect(audit[audit.length - 1].command).toBe("cancelReservationV2");
        expect(outbox[outbox.length - 1].name).toBe("reservation_cancelled");
      });
    });

    describe("getBuyerReservationsV2", () => {
      it("returns only the installation reservations and never the raw pickup code", async () => {
        const offer = await publishOffer(harness);
        const mine = expectOk(
          await buyer.reserveOfferV2(buildReserveInput(harness, offer))
        );
        const theirs = expectOk(
          await buyer.reserveOfferV2(
            buildReserveInput(harness, offer, {
              clientReservationId: "client-reservation-2",
              installationId: harness.scenario.installationB,
              expectedOfferVersion: offer.version + 1,
            })
          )
        );

        const reservations = expectOk(
          await buyer.getBuyerReservationsV2(harness.scenario.installationA)
        );

        expect(reservations.map((reservation) => reservation.id)).toEqual([
          mine.reservation.id,
        ]);
        expect(reservations[0].pickupCodeHint).toBe(mine.pickupCode.slice(-2));
        const serialized = JSON.stringify(reservations);
        expect(serialized).not.toContain(mine.pickupCode);
        expect(serialized).not.toContain(theirs.pickupCode);
      });
    });
  });
}

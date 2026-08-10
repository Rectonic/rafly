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
  InventorySummaryV2,
  MarketplaceOfferV2,
  PublishOfferV2Input,
  ReserveOfferV2Input,
  ReserveOfferV2Result,
  Result,
} from "@/lib/contracts";

type ReserveResult = Result<ReserveOfferV2Result>;

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

/**
 * The plaintext pickup code from a reserve that actually created a
 * reservation. A replay carries null instead of re-issuing the code, so any
 * assertion that needs the plaintext has to state that it is working with a
 * freshly issued hold rather than quietly accepting a null.
 */
export function requirePickupCode(result: ReserveOfferV2Result): string {
  if (result.pickupCode === null) {
    throw new Error(
      "expected a freshly issued pickup code, received a replay carrying null"
    );
  }
  return result.pickupCode;
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

/** The one inventory summary a block is asserting about, or a loud failure. */
export function findInventory(
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

      it("keeps a sold out offer in the marketplace list", async () => {
        const offer = await publishOffer(harness, {
          allocation: {
            storeProductId: harness.scenario.highConfidenceProductId,
            quantity: 1,
            physicallySetAside: false,
          },
        });
        expectOk(await buyer.reserveOfferV2(buildReserveInput(harness, offer)));

        // A buyer who already saw this card is owed a sold out card, not an
        // offer that vanishes out from under them with no explanation. The
        // buyer surfaces render the status as a disabled card.
        const offers = expectOk(await buyer.listMarketplaceOffersV2());

        expect(offers.map((entry) => entry.id)).toEqual([offer.id]);
        expect(offers[0].status).toBe("sold_out");
        expect(offers[0].quantityAvailable).toBe(0);
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

        const code = requirePickupCode(result);
        expect(code).toMatch(/^[A-Z0-9]{6}$/);
        expect(result.reservation.pickupCodeHint).toHaveLength(2);
        expect(result.reservation.pickupCodeHint).toBe(code.slice(-2));
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

      it("replays the same reservation with a null pickup code for a repeated clientReservationId", async () => {
        const offer = await publishOffer(harness);
        const first = expectOk(
          await buyer.reserveOfferV2(buildReserveInput(harness, offer))
        );

        const replay = expectOk(
          await buyer.reserveOfferV2(buildReserveInput(harness, offer))
        );

        // The raw code is issued exactly once. A replay proves which
        // reservation the id belongs to and what state it is in now, it never
        // hands the plaintext code out a second time.
        expect(replay.reservation.id).toBe(first.reservation.id);
        expect(replay.pickupCode).toBeNull();
        expect(replay.reservation.status).toBe("held");
        expect(replay.reservation.pickupCodeHint).toBe(
          first.reservation.pickupCodeHint
        );
        const after = expectOk(await buyer.getMarketplaceOfferV2(offer.id));
        expect(after.quantityAvailable).toBe(1);
        const reservations = expectOk(
          await buyer.getBuyerReservationsV2(harness.scenario.installationA)
        );
        expect(reservations).toHaveLength(1);
      });

      it("replays a cancelled reservation as cancelled with a null pickup code", async () => {
        const offer = await publishOffer(harness);
        const first = expectOk(
          await buyer.reserveOfferV2(buildReserveInput(harness, offer))
        );
        expectOk(
          await buyer.cancelReservationV2({
            reservationId: first.reservation.id,
            installationId: harness.scenario.installationA,
            idempotencyKey: "cancel-key-1",
          })
        );

        const replay = expectOk(
          await buyer.reserveOfferV2(buildReserveInput(harness, offer))
        );

        // A replay reports the row as it stands now, not a frozen snapshot of
        // how it looked when it was created. Returning the stale held view
        // here would let a client that never cleaned up its pending id show a
        // cancelled reservation as an active hold.
        expect(replay.reservation.id).toBe(first.reservation.id);
        expect(replay.reservation.status).toBe("cancelled_by_buyer");
        expect(replay.pickupCode).toBeNull();
        // Replaying is a read, it must not take a second unit.
        const after = expectOk(await buyer.getMarketplaceOfferV2(offer.id));
        expect(after.quantityAvailable).toBe(offer.quantityAvailable);
        const reservations = expectOk(
          await buyer.getBuyerReservationsV2(harness.scenario.installationA)
        );
        expect(reservations).toHaveLength(1);
        expect(reservations[0].status).toBe("cancelled_by_buyer");
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

      it("lets exactly one of two clients racing for the last unit win it", async () => {
        const offer = await publishOffer(harness, {
          allocation: {
            storeProductId: harness.scenario.highConfidenceProductId,
            quantity: 1,
            physicallySetAside: false,
          },
        });

        // Both calls go out before either has answered, and both carry the
        // same offer version, which is what two buyers tapping reserve on
        // the same screen actually looks like. The fake settles them in call
        // order, a real backend settles them for real, and both have to end
        // in the same place: one winner, one honest sold_out, one held unit.
        const settled = await Promise.allSettled([
          buyer.reserveOfferV2(buildReserveInput(harness, offer)),
          buyer.reserveOfferV2(
            buildReserveInput(harness, offer, {
              clientReservationId: "client-reservation-2",
              installationId: harness.scenario.installationB,
            })
          ),
        ]);
        const results = settled.map((outcome) => {
          if (outcome.status !== "fulfilled") {
            throw new Error(
              "reserveOfferV2 must resolve a Result rather than reject"
            );
          }
          return outcome.value;
        });

        const winners = results.filter(
          (result): result is Extract<ReserveResult, { ok: true }> => result.ok
        );
        const losers = results.filter(
          (result): result is Extract<ReserveResult, { ok: false }> => !result.ok
        );
        expect(winners).toHaveLength(1);
        expect(losers).toHaveLength(1);
        expect(losers[0].error.code).toBe("sold_out");

        const after = expectOk(await buyer.getMarketplaceOfferV2(offer.id));
        expect(after.quantityAvailable).toBe(0);
        expect(after.status).toBe("sold_out");

        const acrossBothInstallations = [
          ...expectOk(
            await buyer.getBuyerReservationsV2(harness.scenario.installationA)
          ),
          ...expectOk(
            await buyer.getBuyerReservationsV2(harness.scenario.installationB)
          ),
        ];
        expect(acrossBothInstallations).toHaveLength(1);
        expect(acrossBothInstallations[0].status).toBe("held");
        expect(acrossBothInstallations[0].id).toBe(
          winners[0].value.reservation.id
        );
      });

      it("keeps one clientReservationId independent across two installations", async () => {
        const offer = await publishOffer(harness);
        const shared = "client-reservation-shared";

        const first = expectOk(
          await buyer.reserveOfferV2(
            buildReserveInput(harness, offer, { clientReservationId: shared })
          )
        );
        const second = expectOk(
          await buyer.reserveOfferV2(
            buildReserveInput(harness, offer, {
              clientReservationId: shared,
              installationId: harness.scenario.installationB,
              expectedOfferVersion: offer.version + 1,
            })
          )
        );

        // Idempotency is scoped per installation, so the second installation
        // gets its own reservation rather than a replay of a stranger's. Two
        // devices that happen to mint the same client id are two buyers.
        expect(second.reservation.id).not.toBe(first.reservation.id);
        expect(second.pickupCode).not.toBe(first.pickupCode);
        expect(
          expectOk(
            await buyer.getBuyerReservationsV2(harness.scenario.installationA)
          ).map((reservation) => reservation.id)
        ).toEqual([first.reservation.id]);
        expect(
          expectOk(
            await buyer.getBuyerReservationsV2(harness.scenario.installationB)
          ).map((reservation) => reservation.id)
        ).toEqual([second.reservation.id]);
        const after = expectOk(await buyer.getMarketplaceOfferV2(offer.id));
        expect(after.quantityAvailable).toBe(offer.quantityAvailable - 2);
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

    describe("hold expiry", () => {
      it("flips a held reservation to expired_no_show for both the buyer and the seller", async () => {
        const offer = await publishOffer(harness);
        const held = expectOk(
          await buyer.reserveOfferV2(buildReserveInput(harness, offer))
        );
        const seller = harness.sellerApi({
          userId: harness.scenario.managerUserId,
        });

        harness.setNow(isoPlusMinutes(harness.scenario.pickupEnd, 60));

        const mine = expectOk(
          await buyer.getBuyerReservationsV2(harness.scenario.installationA)
        );
        expect(mine.map((reservation) => reservation.id)).toEqual([
          held.reservation.id,
        ]);
        expect(mine[0].status).toBe("expired_no_show");

        const pickups = expectOk(
          await seller.listSellerPickupsV2(harness.scenario.storeId)
        );
        const pickup = pickups.find(
          (candidate) => candidate.reservationId === held.reservation.id
        );
        expect(pickup?.status).toBe("expired_no_show");
      });

      it("refuses to fulfil a reservation past its hold expiry and consumes no unit", async () => {
        const offer = await publishOffer(harness);
        const held = expectOk(
          await buyer.reserveOfferV2(buildReserveInput(harness, offer))
        );
        const seller = harness.sellerApi({
          userId: harness.scenario.managerUserId,
        });
        const before = findInventory(
          expectOk(await seller.listStoreInventoryV2(harness.scenario.storeId)),
          harness.scenario.highConfidenceProductId
        );

        harness.setNow(isoPlusMinutes(harness.scenario.pickupEnd, 60));

        const failure = expectErrorCode(
          await seller.fulfillReservationV2({
            storeId: harness.scenario.storeId,
            pickupCode: requirePickupCode(held),
            idempotencyKey: "fulfill-after-expiry",
          }),
          "invalid_state"
        );
        expect(failure.message).toMatch(/expir/i);

        const after = findInventory(
          expectOk(await seller.listStoreInventoryV2(harness.scenario.storeId)),
          harness.scenario.highConfidenceProductId
        );
        expect(after.onHandQuantity).toBe(before.onHandQuantity);
      });

      it("returns the expired allocation to the product exactly once", async () => {
        const offer = await publishOffer(harness);
        expectOk(await buyer.reserveOfferV2(buildReserveInput(harness, offer)));
        const seller = harness.sellerApi({
          userId: harness.scenario.managerUserId,
        });
        const before = findInventory(
          expectOk(await seller.listStoreInventoryV2(harness.scenario.storeId)),
          harness.scenario.highConfidenceProductId
        );
        // One unit is still on the shelf for the offer and one is held by
        // the reservation, so the whole allocation is still encumbered.
        expect(before.allocatedQuantity).toBe(offer.quantityAvailable);

        harness.setNow(isoPlusMinutes(harness.scenario.pickupEnd, 60));

        const freed = findInventory(
          expectOk(await seller.listStoreInventoryV2(harness.scenario.storeId)),
          harness.scenario.highConfidenceProductId
        );
        expect(freed.onHandQuantity).toBe(before.onHandQuantity);
        expect(freed.allocatedQuantity).toBe(0);
        expect(freed.maxOfferableQuantity).toBe(freed.onHandQuantity);

        // The whole shelf is offerable again, and only once. A double
        // release would let the next offer claim more units than the store
        // physically holds.
        const republished = await publishOffer(harness, {
          idempotencyKey: "publish-after-expiry",
          allocation: {
            storeProductId: harness.scenario.highConfidenceProductId,
            quantity: freed.onHandQuantity,
            physicallySetAside: false,
          },
          pickupStart: isoPlusMinutes(harness.scenario.pickupEnd, 120),
          pickupEnd: isoPlusMinutes(harness.scenario.pickupEnd, 240),
        });
        expect(republished.quantityAvailable).toBe(freed.onHandQuantity);

        const afterRepublish = findInventory(
          expectOk(await seller.listStoreInventoryV2(harness.scenario.storeId)),
          harness.scenario.highConfidenceProductId
        );
        expect(afterRepublish.allocatedQuantity).toBe(freed.onHandQuantity);
        expect(afterRepublish.maxOfferableQuantity).toBe(0);
      });

      // The two blocks below deliberately make the assertion under test the
      // FIRST call after the clock moves. Every other expiry assertion in
      // this file happens to read something else first, so an implementation
      // that only applies expiry from one entry point would still pass them.
      // These two remove that cover: whichever call the caller happens to
      // make first has to see an already expired world.
      it("reports expiry on a seller pickup list read taken before any other call", async () => {
        const offer = await publishOffer(harness);
        const held = expectOk(
          await buyer.reserveOfferV2(buildReserveInput(harness, offer))
        );
        const seller = harness.sellerApi({
          userId: harness.scenario.managerUserId,
        });

        harness.setNow(isoPlusMinutes(harness.scenario.pickupEnd, 60));

        const pickups = expectOk(
          await seller.listSellerPickupsV2(harness.scenario.storeId)
        );

        const pickup = pickups.find(
          (candidate) => candidate.reservationId === held.reservation.id
        );
        expect(pickup?.status).toBe("expired_no_show");
      });

      it("frees the expired allocation for a republish taken before any other call", async () => {
        const seller = harness.sellerApi({
          userId: harness.scenario.managerUserId,
        });
        const inventory = findInventory(
          expectOk(await seller.listStoreInventoryV2(harness.scenario.storeId)),
          harness.scenario.highConfidenceProductId
        );
        const wholeShelf = inventory.maxOfferableQuantity;
        expect(wholeShelf).toBeGreaterThan(0);
        await publishOffer(harness, {
          allocation: {
            storeProductId: harness.scenario.highConfidenceProductId,
            quantity: wholeShelf,
            physicallySetAside: false,
          },
        });

        harness.setNow(isoPlusMinutes(harness.scenario.pickupEnd, 60));

        // Nothing is read between the clock move and this publish. The whole
        // shelf is only offerable again if the expiry the clock caused is
        // applied by the publish path itself.
        const republished = await publishOffer(harness, {
          idempotencyKey: "publish-after-expiry",
          allocation: {
            storeProductId: harness.scenario.highConfidenceProductId,
            quantity: wholeShelf,
            physicallySetAside: false,
          },
          pickupStart: isoPlusMinutes(harness.scenario.pickupEnd, 120),
          pickupEnd: isoPlusMinutes(harness.scenario.pickupEnd, 240),
        });

        expect(republished.status).toBe("live");
        expect(republished.quantityAvailable).toBe(wholeShelf);
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

        const mineCode = requirePickupCode(mine);
        const theirsCode = requirePickupCode(theirs);
        expect(reservations.map((reservation) => reservation.id)).toEqual([
          mine.reservation.id,
        ]);
        expect(reservations[0].pickupCodeHint).toBe(mineCode.slice(-2));
        const serialized = JSON.stringify(reservations);
        expect(serialized).not.toContain(mineCode);
        expect(serialized).not.toContain(theirsCode);
      });
    });
  });
}

/**
 * Runs both facade conformance suites against the in memory Store Core fake.
 *
 * This is the only file in this folder that imports a concrete implementation.
 * Task 7 wires the same two conformance modules to the Supabase backed facades
 * through its own harness.
 */

import { InMemoryStoreCore, makeDefaultScenario } from "@/lib/test-kit";

import {
  buildPublishInput,
  buildReserveInput,
  expectOk,
  runBuyerApiConformance,
  type ConformanceHarness,
} from "@/lib/test-kit/conformance/buyer-api-conformance";
import { runSellerApiConformance } from "@/lib/test-kit/conformance/seller-api-conformance";

function makeHarness(): ConformanceHarness {
  const core = new InMemoryStoreCore();
  const scenario = makeDefaultScenario(core);

  return {
    scenario,
    buyerApi: () => core.buyerApi(),
    sellerApi: (actor) => core.sellerApi(actor),
    setNow: (iso) => core.setNow(iso),
    listAuditEntries: () => core.listAuditEntries(),
    listOutboxEvents: () => core.listOutboxEvents(),
  };
}

describe("InMemoryStoreCore", () => {
  runBuyerApiConformance(makeHarness);
  runSellerApiConformance(makeHarness);

  describe("determinism", () => {
    it("issues pickup codes from a seeded counter", async () => {
      const harness = makeHarness();
      const seller = harness.sellerApi({ userId: harness.scenario.managerUserId });
      const offer = expectOk(
        await seller.approveAndPublishOfferV2(buildPublishInput(harness))
      );
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

      expect(first.pickupCode).toBe("LB0001");
      expect(second.pickupCode).toBe("LB0002");
    });

    it("starts every harness from the same fixed clock and empty ledgers", () => {
      const harness = makeHarness();

      expect(harness.scenario.now).toBe("2026-08-10T09:00:00.000Z");
      expect(harness.listAuditEntries()).toEqual([]);
      expect(harness.listOutboxEvents()).toEqual([]);
    });
  });
});

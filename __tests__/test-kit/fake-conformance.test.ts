/**
 * Runs both facade conformance suites against the in memory Store Core fake.
 *
 * This is the only file in this folder that imports a concrete implementation.
 * Task 7 wires the same two conformance modules to the Supabase backed facades
 * through its own harness.
 */

import { InMemoryStoreCore, makeDefaultScenario } from "@/lib/test-kit";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  buildPublishInput,
  buildReserveInput,
  expectOk,
  runBuyerApiConformance,
  type ConformanceHarness,
} from "@/lib/test-kit/conformance/buyer-api-conformance";
import { runSellerApiConformance } from "@/lib/test-kit/conformance/seller-api-conformance";
import { parseSellerCsv } from "@/lib/seller/csv-parse";

function makeHarness(): ConformanceHarness {
  const core = new InMemoryStoreCore();
  const baseScenario = makeDefaultScenario(core);
  core.addProduct({
    storeId: baseScenario.storeId,
    productName: "Duplicate barcode one",
    barcode: "CSV-DUPLICATE-BARCODE",
    onHandQuantity: 1,
    confidence: "low",
  });
  core.addProduct({
    storeId: baseScenario.storeId,
    productName: "Duplicate barcode two",
    barcode: "CSV-DUPLICATE-BARCODE",
    onHandQuantity: 1,
    confidence: "low",
  });
  const otherStoreProductId = core.addProduct({
    storeId: baseScenario.otherStoreId,
    productName: "Other store product",
    barcode: "CSV-OTHER-STORE-BARCODE",
    onHandQuantity: 2,
    confidence: "high",
  });
  const scenario = { ...baseScenario, otherStoreProductId };

  return {
    scenario,
    buyerApi: () => core.buyerApi(),
    sellerApi: (actor) => {
      const api = core.sellerApi(actor);
      return {
        ...api,
        listStagedRecordsV2: async (storeId, batchId) => {
          const result = await api.listStagedRecordsV2(storeId, batchId);
          return result.ok
            ? { ...result, value: [...result.value].reverse() }
            : result;
        },
      };
    },
    setNow: (iso) => core.setNow(iso),
    listAuditEntries: () => core.listAuditEntries(),
    listOutboxEvents: () => core.listOutboxEvents(),
    listImportEffects: () => core.listImportEffects(),
  };
}

describe("InMemoryStoreCore", () => {
  runBuyerApiConformance(makeHarness);
  runSellerApiConformance(makeHarness);

  describe("determinism", () => {
    it("uploads the clean CSV fixture into deterministic staged records", async () => {
      const harness = makeHarness();
      const parsed = parseSellerCsv(
        readFileSync(
          join(process.cwd(), "__tests__/fixtures/csv/clean.csv"),
          "utf8"
        )
      );
      if (!parsed.ok) {
        throw new Error(`fixture did not parse: ${parsed.error.message}`);
      }

      const batch = expectOk(
        await harness
          .sellerApi({ userId: harness.scenario.staffUserId })
          .uploadImportBatchV2({
            storeId: harness.scenario.storeId,
            filename: "clean.csv",
            records: parsed.records,
            idempotencyKey: "fixture-upload",
          })
      );
      const records = expectOk(
        await harness
          .sellerApi({ userId: harness.scenario.staffUserId })
          .listStagedRecordsV2(harness.scenario.storeId, batch.id)
      );

      expect(batch).toMatchObject({
        id: "import-batch-1",
        totalRecords: 2,
        pendingRecords: 2,
        createdAt: "2026-08-10T09:00:00.000Z",
      });
      expect(
        records.find((record) => record.rawName === "Sourdough loaf")
      ).toMatchObject({ id: "staged-record-1" });
      expect(
        records.find((record) => record.rawName === "Croissant")
      ).toMatchObject({ id: "staged-record-2" });
    });

    it("keeps every duplicate fixture row as its own staged review record", async () => {
      const harness = makeHarness();
      const parsed = parseSellerCsv(
        readFileSync(
          join(process.cwd(), "__tests__/fixtures/csv/dupes.csv"),
          "utf8"
        )
      );
      if (!parsed.ok) {
        throw new Error(`fixture did not parse: ${parsed.error.message}`);
      }

      const seller = harness.sellerApi({
        userId: harness.scenario.staffUserId,
      });
      const batch = expectOk(
        await seller.uploadImportBatchV2({
          storeId: harness.scenario.storeId,
          filename: "dupes.csv",
          records: parsed.records,
          idempotencyKey: "duplicate-fixture-upload",
        })
      );
      const staged = expectOk(
        await seller.listStagedRecordsV2(harness.scenario.storeId, batch.id)
      );

      expect(batch).toMatchObject({ totalRecords: 3, pendingRecords: 3 });
      expect(staged).toHaveLength(3);
      expect(staged.map((record) => record.id).sort()).toEqual([
        "staged-record-1",
        "staged-record-2",
        "staged-record-3",
      ]);
      expect(staged.every((record) => record.rawName === "Cheese bun")).toBe(
        true
      );
    });

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

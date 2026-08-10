/**
 * Integration coverage for canonical CSV import.
 *
 * The suite calls the real RPCs and uses service reads only for private
 * ledger assertions that no client facade exposes yet.
 */

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  backendEnvPresent,
  backendSkipReason,
  getAnonClient,
  getServiceClient,
  signInTestUser,
} from "../../scripts/backend-test-helpers";

if (!backendEnvPresent()) {
  console.log(`csv-import.integration.test.ts: ${backendSkipReason()}`);
}

const d = backendEnvPresent() ? describe : describe.skip;

function requireRow<T>(
  result: { data: T | null; error: { message: string } | null },
  context: string
): T {
  if (result.error || !result.data) {
    throw new Error(`${context}: ${result.error?.message ?? "no row returned"}`);
  }
  return result.data;
}

interface ImportBatchRow {
  id: string;
  store_id: string;
  status: string;
  total_records: number;
  pending_records: number;
}

interface StagedRow {
  id: string;
  raw_name: string;
  match_status: string;
  matched_store_product_id: string | null;
  candidates: { storeProductId: string; productName: string; reason: string }[];
}

d("canonical CSV import", () => {
  const runId = randomUUID();
  const ownerEmail = "backend-test-owner@lastbite.test";
  const managerEmail = "backend-test-manager@lastbite.test";
  const staffEmail = "backend-test-staff@lastbite.test";
  const otherMemberEmail = "backend-test-nonmember@lastbite.test";

  let service: SupabaseClient;
  let anon: SupabaseClient;
  let manager: SupabaseClient;
  let staff: SupabaseClient;
  let otherMember: SupabaseClient;
  let storeId: string;
  let otherStoreId: string;
  let staffUserId: string;
  let barcodeWinnerId: string;
  let aliasWinnerId: string;
  let exactNameProductId: string;
  let existingProductId: string;
  let batch: ImportBatchRow;
  let staged: StagedRow[];

  beforeAll(async () => {
    service = getServiceClient();
    anon = getAnonClient();
    const owner = await signInTestUser(ownerEmail);
    [manager, staff, otherMember] = await Promise.all([
      signInTestUser(managerEmail),
      signInTestUser(staffEmail),
      signInTestUser(otherMemberEmail),
    ]);

    const [ownerAuth, managerAuth, staffAuth, otherMemberAuth] = await Promise.all([
      owner.auth.getUser(),
      manager.auth.getUser(),
      staff.auth.getUser(),
      otherMember.auth.getUser(),
    ]);
    if (
      !ownerAuth.data.user ||
      !managerAuth.data.user ||
      !staffAuth.data.user ||
      !otherMemberAuth.data.user
    ) {
      throw new Error("could not resolve CSV import test users");
    }

    const store = requireRow<{ id: string }>(
      await service
        .from("stores")
        .insert({ name: `CSV Import ${runId}` })
        .select("id")
        .single(),
      "create CSV import store"
    );
    const otherStore = requireRow<{ id: string }>(
      await service
        .from("stores")
        .insert({ name: `CSV Import Other ${runId}` })
        .select("id")
        .single(),
      "create other CSV import store"
    );
    storeId = store.id;
    otherStoreId = otherStore.id;
    staffUserId = staffAuth.data.user.id;

    const { error: membershipError } = await service
      .from("store_memberships")
      .insert([
        { store_id: storeId, user_id: ownerAuth.data.user.id, role: "owner" },
        { store_id: storeId, user_id: managerAuth.data.user.id, role: "manager" },
        { store_id: storeId, user_id: staffAuth.data.user.id, role: "staff" },
        { store_id: otherStoreId, user_id: managerAuth.data.user.id, role: "owner" },
        {
          store_id: otherStoreId,
          user_id: otherMemberAuth.data.user.id,
          role: "owner",
        },
      ]);
    if (membershipError) {
      throw new Error(`create CSV import memberships: ${membershipError.message}`);
    }

    const { data: products, error: productError } = await service
      .from("store_products")
      .insert([
        {
          store_id: storeId,
          product_name: "Barcode winner",
          barcode: "PRIMARY-BARCODE",
          on_hand_quantity: 4,
        },
        {
          store_id: storeId,
          product_name: "Alias winner",
          barcode: null,
          on_hand_quantity: 3,
        },
        {
          store_id: storeId,
          product_name: "Tiered source name",
          barcode: null,
          on_hand_quantity: 2,
        },
        {
          store_id: storeId,
          product_name: "Alias precedence name",
          barcode: null,
          on_hand_quantity: 2,
        },
        {
          store_id: storeId,
          product_name: "Exact name only",
          barcode: null,
          on_hand_quantity: 2,
        },
        {
          store_id: storeId,
          product_name: "Ambiguous one",
          barcode: "DUPLICATE-BARCODE",
          on_hand_quantity: 1,
        },
        {
          store_id: storeId,
          product_name: "Ambiguous two",
          barcode: "DUPLICATE-BARCODE",
          on_hand_quantity: 1,
        },
        {
          store_id: storeId,
          product_name: "Existing observation target",
          barcode: null,
          on_hand_quantity: 5,
        },
      ])
      .select("id, product_name");
    if (productError || !products) {
      throw new Error(`create CSV import products: ${productError?.message}`);
    }

    const byName = new Map(
      (products as { id: string; product_name: string }[]).map((row) => [
        row.product_name,
        row.id,
      ])
    );
    barcodeWinnerId = byName.get("Barcode winner") as string;
    aliasWinnerId = byName.get("Alias winner") as string;
    exactNameProductId = byName.get("Exact name only") as string;
    existingProductId = byName.get("Existing observation target") as string;

    const { error: aliasError } = await service.from("product_aliases").insert([
      {
        store_id: storeId,
        store_product_id: aliasWinnerId,
        alias: "Tiered source name",
        approved: true,
      },
      {
        store_id: storeId,
        store_product_id: aliasWinnerId,
        alias: "Alias precedence name",
        approved: true,
      },
    ]);
    if (aliasError) {
      throw new Error(`create CSV import alias: ${aliasError.message}`);
    }
  });

  it("denies anonymous upload", async () => {
    const { error } = await anon.rpc("upload_import_batch_v2", {
      p_store_id: storeId,
      p_filename: "anonymous.csv",
      p_records: [],
      p_idempotency_key: randomUUID(),
    });

    expect(error).not.toBeNull();
  });

  it("denies anonymous import reads", async () => {
    const batchRead = await anon.rpc("list_import_batches_v2", {
      p_store_id: storeId,
    });
    const recordRead = await anon.rpc("list_staged_records_v2", {
      p_store_id: storeId,
      p_batch_id: randomUUID(),
    });

    expect(batchRead.error).not.toBeNull();
    expect(recordRead.error).not.toBeNull();
  });

  it("rejects upload values that cannot be stored while keeping fractional prices", async () => {
    const invalidRecords = [
      { rawName: "   " },
      { rawName: "Negative quantity", rawQuantity: -1 },
      { rawName: "Fractional quantity", rawQuantity: 1.25 },
      { rawName: "Negative price", rawPrice: -0.5 },
    ];

    for (const record of invalidRecords) {
      const rejected = await staff.rpc("upload_import_batch_v2", {
        p_store_id: storeId,
        p_filename: "invalid.csv",
        p_records: [record],
        p_idempotency_key: randomUUID(),
      });
      expect(rejected.error?.message).toContain("validation_failed:");
    }

    const fractionalPrice = requireRow<ImportBatchRow>(
      await staff.rpc("upload_import_batch_v2", {
        p_store_id: storeId,
        p_filename: "fractional-price.csv",
        p_records: [{ rawName: "Fractional price", rawPrice: 0.125 }],
        p_idempotency_key: randomUUID(),
      }),
      "upload fractional price"
    );
    const rows = requireRow<StagedRow[]>(
      await staff.rpc("list_staged_records_v2", {
        p_store_id: storeId,
        p_batch_id: fractionalPrice.id,
      }),
      "read fractional price staged row"
    );
    expect(rows[0]).toMatchObject({ raw_name: "Fractional price" });
  });

  it("lets staff upload and unions conflicting match tiers without auto approving ambiguity", async () => {
    const records = [
      {
        rawName: "Tiered source name",
        rawBarcode: "PRIMARY-BARCODE",
        rawQuantity: 4,
      },
      { rawName: "Alias precedence name" },
      { rawName: "exact NAME only" },
      {
        rawName: "Duplicate barcode row",
        rawBarcode: "DUPLICATE-BARCODE",
      },
      { rawName: "Existing quantity evidence", rawQuantity: 8 },
      { rawName: "Brand new imported product", rawBarcode: "NEW-BARCODE", rawQuantity: 2 },
      { rawName: "Rejected source row" },
    ];
    const key = randomUUID();
    batch = requireRow<ImportBatchRow>(
      await staff.rpc("upload_import_batch_v2", {
        p_store_id: storeId,
        p_filename: "canonical.csv",
        p_records: records,
        p_idempotency_key: key,
      }),
      "staff upload CSV batch"
    );

    const replay = requireRow<ImportBatchRow>(
      await staff.rpc("upload_import_batch_v2", {
        p_store_id: storeId,
        p_filename: "canonical.csv",
        p_records: records,
        p_idempotency_key: key,
      }),
      "replay CSV upload"
    );
    expect(replay.id).toBe(batch.id);
    const reusedKey = await staff.rpc("upload_import_batch_v2", {
      p_store_id: storeId,
      p_filename: "changed.csv",
      p_records: records,
      p_idempotency_key: key,
    });
    expect(reusedKey.error?.message).toContain("idempotency_conflict:");
    expect(batch).toMatchObject({
      store_id: storeId,
      status: "needs_review",
      total_records: 7,
      pending_records: 7,
    });

    const stagedResult = await staff.rpc("list_staged_records_v2", {
      p_store_id: storeId,
      p_batch_id: batch.id,
    });
    if (stagedResult.error || !stagedResult.data) {
      throw new Error(`read staged CSV rows: ${stagedResult.error?.message}`);
    }
    staged = stagedResult.data as StagedRow[];
    expect(staged).toHaveLength(7);

    const precedence = staged.find((row) => row.raw_name === "Tiered source name");
    expect(precedence).toMatchObject({
      match_status: "ambiguous",
      matched_store_product_id: null,
    });
    expect(precedence?.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ storeProductId: barcodeWinnerId, reason: "barcode" }),
        expect.objectContaining({ storeProductId: aliasWinnerId, reason: "alias" }),
      ])
    );

    const aliasPrecedence = staged.find(
      (row) => row.raw_name === "Alias precedence name"
    );
    expect(aliasPrecedence).toMatchObject({
      match_status: "ambiguous",
      matched_store_product_id: null,
    });
    expect(aliasPrecedence?.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ storeProductId: aliasWinnerId, reason: "alias" }),
        expect.objectContaining({ reason: "product_name" }),
      ])
    );

    const exactName = staged.find((row) => row.raw_name === "exact NAME only");
    expect(exactName).toMatchObject({
      match_status: "auto_matched",
      matched_store_product_id: exactNameProductId,
    });
    expect(exactName?.candidates[0].reason).toBe("product_name");

    const ambiguous = staged.find((row) => row.raw_name === "Duplicate barcode row");
    expect(ambiguous?.match_status).toBe("ambiguous");
    expect(ambiguous?.matched_store_product_id).toBeNull();
    expect(ambiguous?.candidates).toHaveLength(2);
  });

  it("claims a concurrent duplicate upload once", async () => {
    const key = randomUUID();
    const args = {
      p_store_id: storeId,
      p_filename: "concurrent.csv",
      p_records: [{ rawName: "Concurrent upload row" }],
      p_idempotency_key: key,
    };

    const [firstResult, secondResult] = await Promise.all([
      staff.rpc("upload_import_batch_v2", args),
      staff.rpc("upload_import_batch_v2", args),
    ]);
    const first = requireRow<ImportBatchRow>(firstResult, "first concurrent upload");
    const second = requireRow<ImportBatchRow>(secondResult, "second concurrent upload");
    expect(second.id).toBe(first.id);

    const { count } = await service
      .from("staged_source_records")
      .select("id", { count: "exact", head: true })
      .eq("batch_id", first.id);
    expect(count).toBe(1);
  });

  it("denies staff decisions and cross store access", async () => {
    const recordId = staged[0].id;
    const staffDecision = await staff.rpc("decide_staged_record_v2", {
      p_store_id: storeId,
      p_record_id: recordId,
      p_decision: "reject",
      p_target_store_product_id: null,
      p_idempotency_key: randomUUID(),
    });
    expect(staffDecision.error?.message).toContain("forbidden:");

    const crossStore = await otherMember.rpc("decide_staged_record_v2", {
      p_store_id: storeId,
      p_record_id: recordId,
      p_decision: "reject",
      p_target_store_product_id: null,
      p_idempotency_key: randomUUID(),
    });
    expect(crossStore.error?.message).toContain("forbidden:");

    const wrongStoreRecord = await manager.rpc("decide_staged_record_v2", {
      p_store_id: otherStoreId,
      p_record_id: recordId,
      p_decision: "reject",
      p_target_store_product_id: null,
      p_idempotency_key: randomUUID(),
    });
    expect(wrongStoreRecord.error?.message).toContain("not_found:");

    const nullDecision = await manager.rpc("decide_staged_record_v2", {
      p_store_id: storeId,
      p_record_id: recordId,
      p_decision: null,
      p_target_store_product_id: null,
      p_idempotency_key: randomUUID(),
    });
    expect(nullDecision.error?.message).toContain("validation_failed:");

    const hiddenBatchList = await otherMember.rpc("list_import_batches_v2", {
      p_store_id: storeId,
    });
    const hiddenRecordList = await otherMember.rpc("list_staged_records_v2", {
      p_store_id: storeId,
      p_batch_id: batch.id,
    });
    expect(hiddenBatchList.error?.message).toContain("forbidden:");
    expect(hiddenRecordList.error?.message).toContain("forbidden:");

    const wrongStoreBatch = await manager.rpc("list_staged_records_v2", {
      p_store_id: otherStoreId,
      p_batch_id: batch.id,
    });
    expect(wrongStoreBatch.error?.message).toContain("not_found:");

    const { data: hiddenRows, error: hiddenError } = await otherMember
      .from("staged_source_records")
      .select("id")
      .eq("store_id", storeId);
    expect(hiddenError).toBeNull();
    expect(hiddenRows).toEqual([]);
  });

  it("allows member reads while RLS hides other stores and denies client writes", async () => {
    const memberBatches = requireRow<ImportBatchRow[]>(
      await staff.rpc("list_import_batches_v2", { p_store_id: storeId }),
      "list member import batches"
    );
    const memberRecords = requireRow<StagedRow[]>(
      await staff.rpc("list_staged_records_v2", {
        p_store_id: storeId,
        p_batch_id: batch.id,
      }),
      "list member staged records"
    );
    const directMemberBatches = await staff
      .from("import_batches")
      .select("id")
      .eq("store_id", storeId);
    const hiddenBatches = await otherMember
      .from("import_batches")
      .select("id")
      .eq("store_id", storeId);
    const hiddenAliases = await otherMember
      .from("product_aliases")
      .select("id")
      .eq("store_id", storeId);
    expect(memberBatches).toContainEqual(expect.objectContaining({ id: batch.id }));
    expect(memberRecords).toHaveLength(7);
    expect(directMemberBatches.data).toContainEqual({ id: batch.id });
    expect(hiddenBatches.data).toEqual([]);
    expect(hiddenAliases.data).toEqual([]);

    const batchWrite = await staff.from("import_batches").insert({
      store_id: storeId,
      filename: "blocked.csv",
      total_records: 1,
      pending_records: 1,
      created_by: staffUserId,
      import_fingerprint: "blocked",
    });
    const aliasWrite = await staff.from("product_aliases").insert({
      store_id: storeId,
      store_product_id: barcodeWinnerId,
      alias: `blocked-${runId}`,
    });
    expect(batchWrite.error).not.toBeNull();
    expect(aliasWrite.error).not.toBeNull();
  });

  it("claims a concurrent duplicate rejection and decrements pending once", async () => {
    const record = staged.find((row) => row.raw_name === "Rejected source row") as StagedRow;
    const key = randomUUID();
    const args = {
      p_store_id: storeId,
      p_record_id: record.id,
      p_decision: "reject",
      p_target_store_product_id: null,
      p_idempotency_key: key,
    };

    const [firstResult, secondResult] = await Promise.all([
      manager.rpc("decide_staged_record_v2", args),
      manager.rpc("decide_staged_record_v2", args),
    ]);
    const first = requireRow<StagedRow>(firstResult, "first concurrent rejection");
    const second = requireRow<StagedRow>(secondResult, "second concurrent rejection");
    expect(first.match_status).toBe("rejected");
    expect(second.id).toBe(first.id);

    const currentBatch = requireRow<{ pending_records: number }>(
      await service
        .from("import_batches")
        .select("pending_records")
        .eq("id", batch.id)
        .single(),
      "read batch after concurrent rejection"
    );
    expect(currentBatch.pending_records).toBe(6);
  });

  it("approves an existing product with an alias and observation but no stock proposal or verification", async () => {
    const record = staged.find((row) => row.raw_name === "Existing quantity evidence") as StagedRow;
    const key = randomUUID();
    const decided = requireRow<StagedRow>(
      await manager.rpc("decide_staged_record_v2", {
        p_store_id: storeId,
        p_record_id: record.id,
        p_decision: "approve",
        p_target_store_product_id: existingProductId,
        p_idempotency_key: key,
      }),
      "approve existing staged record"
    );
    const replay = requireRow<StagedRow>(
      await manager.rpc("decide_staged_record_v2", {
        p_store_id: storeId,
        p_record_id: record.id,
        p_decision: "approve",
        p_target_store_product_id: existingProductId,
        p_idempotency_key: key,
      }),
      "replay existing staged record decision"
    );
    expect(replay.id).toBe(decided.id);
    const reusedKey = await manager.rpc("decide_staged_record_v2", {
      p_store_id: storeId,
      p_record_id: record.id,
      p_decision: "approve",
      p_target_store_product_id: null,
      p_idempotency_key: key,
    });
    expect(reusedKey.error?.message).toContain("idempotency_conflict:");

    const product = requireRow<{
      on_hand_quantity: number;
      confidence: string;
      last_verified_at: string | null;
    }>(
      await service
        .from("store_products")
        .select("on_hand_quantity, confidence, last_verified_at")
        .eq("id", existingProductId)
        .single(),
      "read observed product"
    );
    expect(product).toEqual({
      on_hand_quantity: 5,
      confidence: "low",
      last_verified_at: null,
    });

    const { count: observationCount } = await service
      .from("inventory_observations")
      .select("id", { count: "exact", head: true })
      .eq("staged_source_record_id", record.id);
    const { count: proposalCount } = await service
      .from("stock_adjustment_proposals")
      .select("id", { count: "exact", head: true })
      .eq("store_product_id", existingProductId)
      .eq("status", "pending");
    const { data: aliases } = await service
      .from("product_aliases")
      .select("store_product_id, approved")
      .eq("store_id", storeId)
      .ilike("alias", "Existing quantity evidence");
    expect(observationCount).toBe(1);
    expect(proposalCount).toBe(0);
    expect(aliases).toEqual([{ store_product_id: existingProductId, approved: true }]);

    const digest = requireRow<{
      staleVerification: { productName: string }[];
    }>(
      await manager.rpc("compose_owner_digest_v2", { p_store_id: storeId }),
      "compose digest after CSV observation"
    );
    expect(digest.staleVerification.map((item) => item.productName)).toContain(
      "Existing observation target"
    );

    const repeatedBatch = requireRow<ImportBatchRow>(
      await manager.rpc("upload_import_batch_v2", {
        p_store_id: storeId,
        p_filename: "existing-alias-repeat.csv",
        p_records: [{ rawName: "Existing quantity evidence", rawQuantity: 8 }],
        p_idempotency_key: randomUUID(),
      }),
      "upload repeated existing alias"
    );
    const repeatedRows = requireRow<StagedRow[]>(
      await manager.rpc("list_staged_records_v2", {
        p_store_id: storeId,
        p_batch_id: repeatedBatch.id,
      }),
      "read repeated existing alias"
    );
    expect(repeatedRows[0]).toMatchObject({
      match_status: "auto_matched",
      matched_store_product_id: existingProductId,
    });
  });

  it("approves a new product once, creates its alias, and records quantity evidence", async () => {
    const record = staged.find((row) => row.raw_name === "Brand new imported product") as StagedRow;
    const key = randomUUID();
    const first = requireRow<StagedRow>(
      await manager.rpc("decide_staged_record_v2", {
        p_store_id: storeId,
        p_record_id: record.id,
        p_decision: "approve",
        p_target_store_product_id: null,
        p_idempotency_key: key,
      }),
      "approve new staged product"
    );
    const replay = requireRow<StagedRow>(
      await manager.rpc("decide_staged_record_v2", {
        p_store_id: storeId,
        p_record_id: record.id,
        p_decision: "approve",
        p_target_store_product_id: null,
        p_idempotency_key: key,
      }),
      "replay new staged product approval"
    );
    expect(replay.matched_store_product_id).toBe(first.matched_store_product_id);

    const { data: products } = await service
      .from("store_products")
      .select("id, on_hand_quantity")
      .eq("store_id", storeId)
      .eq("product_name", "Brand new imported product");
    const { data: aliases } = await service
      .from("product_aliases")
      .select("store_product_id, approved")
      .eq("store_id", storeId)
      .ilike("alias", "Brand new imported product");
    const { count: observations } = await service
      .from("inventory_observations")
      .select("id", { count: "exact", head: true })
      .eq("staged_source_record_id", record.id);
    const { count: proposals } = await service
      .from("stock_adjustment_proposals")
      .select("id", { count: "exact", head: true })
      .eq("store_product_id", first.matched_store_product_id as string);
    expect(products).toHaveLength(1);
    expect(products?.[0].on_hand_quantity).toBe(0);
    expect(aliases).toEqual([
      { store_product_id: first.matched_store_product_id, approved: true },
    ]);
    expect(observations).toBe(1);
    expect(proposals).toBe(0);
  });

  it("completes the batch after every decision and emits once per decision", async () => {
    const alreadyDecided = new Set([
      "Existing quantity evidence",
      "Brand new imported product",
      "Rejected source row",
    ]);
    for (const record of staged) {
      if (alreadyDecided.has(record.raw_name)) {
        continue;
      }
      const decision = record.raw_name === "Rejected source row" ? "reject" : "approve";
      const target = decision === "approve"
        ? record.matched_store_product_id ?? record.candidates[0]?.storeProductId ?? barcodeWinnerId
        : null;
      requireRow<StagedRow>(
        await manager.rpc("decide_staged_record_v2", {
          p_store_id: storeId,
          p_record_id: record.id,
          p_decision: decision,
          p_target_store_product_id: target,
          p_idempotency_key: randomUUID(),
        }),
        `decide staged row ${record.raw_name}`
      );
    }

    const completed = requireRow<ImportBatchRow>(
      await service
        .from("import_batches")
        .select("id, store_id, status, total_records, pending_records")
        .eq("id", batch.id)
        .single(),
      "read completed import batch"
    );
    expect(completed).toMatchObject({ status: "completed", pending_records: 0 });

    const rejected = requireRow<{ match_status: string }>(
      await service
        .from("staged_source_records")
        .select("match_status")
        .eq("batch_id", batch.id)
        .eq("raw_name", "Rejected source row")
        .single(),
      "read rejected staged record"
    );
    expect(rejected.match_status).toBe("rejected");

    const { count: auditCount } = await service
      .from("audit_entries")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId)
      .eq("command", "decide_staged_record_v2");
    const { count: eventCount } = await service
      .from("outbox_events")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "staged_record_decided")
      .contains("payload", { storeId, batchId: batch.id });
    expect(auditCount).toBe(7);
    expect(eventCount).toBe(7);
  });
});

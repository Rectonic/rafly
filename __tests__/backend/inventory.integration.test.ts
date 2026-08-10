/**
 * Integration coverage for the v2 inventory ledger: products, count
 * sessions, adjustment proposals, movements, and the confidence function.
 *
 * Talks to a real local Supabase stack through scripts/backend-test-helpers.
 * Every it block exercises Postgres RPCs and RLS directly, not application
 * code, so a passing suite here is proof that
 * supabase/migrations/20260810110000_v2_inventory.sql behaves as documented
 * in the migration B content spec.
 *
 * Isolation: every run creates a fresh store named with a uuid suffix and
 * leaves it in place, shared tables are never truncated. Test user emails
 * stay fixed across runs and across suites on purpose, so signInTestUser
 * reuses the same four (now five, see the operator user added in Fix
 * round 1) auth.users rows instead of growing that table.
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
  console.log(`inventory.integration.test.ts: ${backendSkipReason()}`);
}

const d = backendEnvPresent() ? describe : describe.skip;

interface StoreProductRow {
  id: string;
  store_id: string;
  product_name: string;
  on_hand_quantity: number;
  confidence: string;
  version: number;
  last_verified_at: string | null;
}

interface ProposalRow {
  id: string;
  store_id: string;
  store_product_id: string;
  current_quantity: number;
  proposed_quantity: number;
  delta: number;
  reason: string;
  status: string;
  created_by: string;
  created_by_role: string;
  count_session_id: string | null;
  version: number;
  created_at: string;
}

interface IdRow {
  id: string;
}

interface VersionRow {
  version: number;
}

interface OnHandQuantityRow {
  on_hand_quantity: number;
}

interface OnHandAndVersionRow {
  on_hand_quantity: number;
  version: number;
}

interface DeltaRow {
  delta: number;
}

interface StatusRow {
  status: string;
}

// The untyped Supabase client (no generated Database schema) types every
// .single() response as a union of a success and a failure shape, so a bare
// call site with nothing to flow a contextual type backward infers T
// unreliably. Callers with no surrounding context (not immediately returned
// from a function with an explicit return type) must pass T explicitly, see
// the row interfaces above.
function requireRow<T>(
  result: { data: T | null; error: { message: string } | null },
  context: string
): T {
  if (result.error || !result.data) {
    throw new Error(`${context}: ${result.error?.message ?? "no row returned"}`);
  }
  return result.data;
}

const RAW_DUPLICATE_KEY_PATTERN = /duplicate key value violates unique constraint/i;

d("inventory ledger, counts, adjustments, movements, allocations", () => {
  const runId = randomUUID();

  // Fixed across runs and shared with stores-roles.integration.test.ts on
  // purpose, so signInTestUser reuses the same users instead of creating
  // new ones on every run. operatorEmail added in Fix round 1 to cover the
  // wrong role, not just no role, forbidden path.
  const ownerEmail = "backend-test-owner@lastbite.test";
  const managerEmail = "backend-test-manager@lastbite.test";
  const staffEmail = "backend-test-staff@lastbite.test";
  const nonMemberEmail = "backend-test-nonmember@lastbite.test";
  const operatorEmail = "backend-test-operator@lastbite.test";

  let storeId: string;
  let ownerUserId: string;
  let managerUserId: string;
  let staffUserId: string;
  let operatorUserId: string;

  let ownerClient: SupabaseClient;
  let managerClient: SupabaseClient;
  let staffClient: SupabaseClient;
  let nonMemberClient: SupabaseClient;
  let operatorClient: SupabaseClient;
  let serviceClient: SupabaseClient;

  beforeAll(async () => {
    serviceClient = getServiceClient();

    [ownerClient, managerClient, staffClient, nonMemberClient, operatorClient] =
      await Promise.all([
        signInTestUser(ownerEmail),
        signInTestUser(managerEmail),
        signInTestUser(staffEmail),
        signInTestUser(nonMemberEmail),
        signInTestUser(operatorEmail),
      ]);

    const [{ data: ownerUser }, { data: managerUser }, { data: staffUser }, { data: operatorUser }] =
      await Promise.all([
        ownerClient.auth.getUser(),
        managerClient.auth.getUser(),
        staffClient.auth.getUser(),
        operatorClient.auth.getUser(),
      ]);

    if (!ownerUser.user || !managerUser.user || !staffUser.user || !operatorUser.user) {
      throw new Error("could not resolve auth.getUser() for one of the seeded test users");
    }

    ownerUserId = ownerUser.user.id;
    managerUserId = managerUser.user.id;
    staffUserId = staffUser.user.id;
    operatorUserId = operatorUser.user.id;

    const store = requireRow<IdRow>(
      await serviceClient
        .from("stores")
        .insert({
          name: `Backend Inventory Test Store ${runId}`,
          address: "1 Inventory Way",
          latitude: 41.3,
          longitude: 69.2,
        })
        .select()
        .single(),
      "failed to create the test store"
    );
    storeId = store.id as string;

    const { error: membershipError } = await serviceClient.from("store_memberships").insert([
      { store_id: storeId, user_id: ownerUserId, role: "owner" },
      { store_id: storeId, user_id: managerUserId, role: "manager" },
      { store_id: storeId, user_id: staffUserId, role: "staff" },
      { store_id: storeId, user_id: operatorUserId, role: "operator" },
    ]);

    if (membershipError) {
      throw new Error(`failed to create the test memberships: ${membershipError.message}`);
    }
  });

  async function createProduct(
    overrides: Partial<{
      productName: string;
      onHandQuantity: number;
      confidence: string;
    }> = {}
  ): Promise<StoreProductRow> {
    return requireRow(
      await serviceClient
        .from("store_products")
        .insert({
          store_id: storeId,
          product_name: overrides.productName ?? `Test Product ${randomUUID()}`,
          on_hand_quantity: overrides.onHandQuantity ?? 10,
          confidence: overrides.confidence ?? "low",
        })
        .select()
        .single(),
      "failed to create a test product"
    );
  }

  async function createPendingProposal(overrides: {
    storeProductId: string;
    currentQuantity: number;
    proposedQuantity: number;
  }): Promise<ProposalRow> {
    return requireRow(
      await serviceClient
        .from("stock_adjustment_proposals")
        .insert({
          store_id: storeId,
          store_product_id: overrides.storeProductId,
          current_quantity: overrides.currentQuantity,
          proposed_quantity: overrides.proposedQuantity,
          delta: overrides.proposedQuantity - overrides.currentQuantity,
          status: "pending",
          created_by: staffUserId,
          created_by_role: "staff",
        })
        .select()
        .single(),
      "failed to create a test proposal"
    );
  }

  // Fix round 1 addition, backs the audit_entries coverage gap findings for
  // both RPCs.
  async function countAuditEntriesForStore(): Promise<number> {
    const { count, error } = await serviceClient
      .from("audit_entries")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId);
    if (error) {
      throw new Error(`failed to count audit entries: ${error.message}`);
    }
    return count ?? 0;
  }

  it("lets staff record a count, creating proposals only where observed differs, and bumps counted products", async () => {
    const matching = await createProduct({ onHandQuantity: 5 });
    const differing = await createProduct({ onHandQuantity: 8 });

    const auditBefore = await countAuditEntriesForStore();

    const countSessionId = randomUUID();
    const { data, error } = await staffClient.rpc("record_inventory_count_v2", {
      p_store_id: storeId,
      p_count_session_id: countSessionId,
      p_lines: [
        { storeProductId: matching.id, observedQuantity: 5 },
        { storeProductId: differing.id, observedQuantity: 3 },
      ],
    });

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({
      store_id: storeId,
      store_product_id: differing.id,
      current_quantity: 8,
      proposed_quantity: 3,
      delta: -5,
      reason: "count",
      status: "pending",
      created_by_role: "staff",
      count_session_id: countSessionId,
      version: 1,
    });

    const { data: products, error: productsError } = await serviceClient
      .from("store_products")
      .select("id, confidence, version, last_verified_at")
      .in("id", [matching.id, differing.id]);

    expect(productsError).toBeNull();
    for (const product of products ?? []) {
      // Both counted lines get a fresh last_verified_at and a version bump,
      // somebody really did walk the shelf for each of them. Confidence is
      // where they part ways. The matching line confirmed the ledger, the
      // discrepant one disproved it and stays low until the proposal above is
      // approved, so nothing downstream treats its stale quantity as verified.
      expect(product.confidence).toBe(product.id === matching.id ? "high" : "low");
      expect(product.version).toBe(2);
      expect(product.last_verified_at).not.toBeNull();
    }

    const auditAfter = await countAuditEntriesForStore();
    expect(auditAfter).toBe(auditBefore + 1);
  });

  it("replays the same proposals on a second call with the same count session id, even from a different member", async () => {
    const product = await createProduct({ onHandQuantity: 10 });
    const countSessionId = randomUUID();

    const first = await staffClient.rpc("record_inventory_count_v2", {
      p_store_id: storeId,
      p_count_session_id: countSessionId,
      p_lines: [{ storeProductId: product.id, observedQuantity: 4 }],
    });
    expect(first.error).toBeNull();
    expect(first.data).toHaveLength(1);

    const afterFirst = requireRow<VersionRow>(
      await serviceClient.from("store_products").select("version").eq("id", product.id).single(),
      "failed to reload the product after the first count"
    );

    const second = await managerClient.rpc("record_inventory_count_v2", {
      p_store_id: storeId,
      p_count_session_id: countSessionId,
      p_lines: [{ storeProductId: product.id, observedQuantity: 4 }],
    });
    expect(second.error).toBeNull();
    expect(second.data).toEqual(first.data);

    const afterSecond = requireRow<VersionRow>(
      await serviceClient.from("store_products").select("version").eq("id", product.id).single(),
      "failed to reload the product after the replayed count"
    );
    expect(afterSecond.version).toBe(afterFirst.version);

    const { data: allProposals, error: proposalsError } = await serviceClient
      .from("stock_adjustment_proposals")
      .select("id")
      .eq("count_session_id", countSessionId);
    expect(proposalsError).toBeNull();
    expect(allProposals).toHaveLength(1);

    const { data: sessions, error: sessionsError } = await serviceClient
      .from("count_sessions")
      .select("id, store_id")
      .eq("id", countSessionId);
    expect(sessionsError).toBeNull();
    expect(sessions).toHaveLength(1);
  });

  it("raises idempotency_conflict when a count session id comes back with different lines", async () => {
    const product = await createProduct({ onHandQuantity: 10 });
    const countSessionId = randomUUID();

    const first = await staffClient.rpc("record_inventory_count_v2", {
      p_store_id: storeId,
      p_count_session_id: countSessionId,
      p_lines: [{ storeProductId: product.id, observedQuantity: 4 }],
    });
    expect(first.error).toBeNull();

    // Same id, a different observation. Replaying the first count's proposals
    // here would answer a question the caller did not ask, and would hide the
    // fact that the second count was never recorded at all.
    const changed = await staffClient.rpc("record_inventory_count_v2", {
      p_store_id: storeId,
      p_count_session_id: countSessionId,
      p_lines: [{ storeProductId: product.id, observedQuantity: 3 }],
    });
    expect(changed.data).toBeNull();
    expect(changed.error?.message).toMatch(/^idempotency_conflict:/);

    const { data: proposals } = await serviceClient
      .from("stock_adjustment_proposals")
      .select("id")
      .eq("count_session_id", countSessionId);
    expect(proposals).toHaveLength(1);
  });

  it("raises idempotency_conflict when another store reuses a claimed count session id", async () => {
    const product = await createProduct({ onHandQuantity: 10 });
    const countSessionId = randomUUID();

    const first = await staffClient.rpc("record_inventory_count_v2", {
      p_store_id: storeId,
      p_count_session_id: countSessionId,
      p_lines: [{ storeProductId: product.id, observedQuantity: 4 }],
    });
    expect(first.error).toBeNull();

    const otherStore = requireRow<IdRow>(
      await serviceClient
        .from("stores")
        .insert({ name: `Session Scope Store ${randomUUID()}`, address: "elsewhere" })
        .select()
        .single(),
      "failed to create the second store"
    );
    const membership = await serviceClient
      .from("store_memberships")
      .insert({ store_id: otherStore.id, user_id: ownerUserId, role: "owner" });
    expect(membership.error).toBeNull();
    const otherProduct = requireRow<IdRow>(
      await serviceClient
        .from("store_products")
        .insert({
          store_id: otherStore.id,
          product_name: `Session Scope Product ${randomUUID()}`,
          on_hand_quantity: 5,
        })
        .select()
        .single(),
      "failed to create the second store's product"
    );

    // The id belongs to the first store. This used to fall into the replay
    // branch and hand back an empty proposal list, which reads as "your count
    // matched everywhere" and is a lie about a count that never ran.
    const reused = await ownerClient.rpc("record_inventory_count_v2", {
      p_store_id: otherStore.id,
      p_count_session_id: countSessionId,
      p_lines: [{ storeProductId: otherProduct.id, observedQuantity: 1 }],
    });
    expect(reused.data).toBeNull();
    expect(reused.error?.message).toMatch(/^idempotency_conflict:/);
  });

  it("forbids a non member from recording a count", async () => {
    const product = await createProduct();
    const { data, error } = await nonMemberClient.rpc("record_inventory_count_v2", {
      p_store_id: storeId,
      p_count_session_id: randomUUID(),
      p_lines: [{ storeProductId: product.id, observedQuantity: 1 }],
    });

    expect(data).toBeNull();
    expect(error?.message).toMatch(/^forbidden:/);
  });

  it("forbids an operator member from recording a count, a wrong role rather than no role", async () => {
    const product = await createProduct({ onHandQuantity: 3 });

    const { data, error } = await operatorClient.rpc("record_inventory_count_v2", {
      p_store_id: storeId,
      p_count_session_id: randomUUID(),
      p_lines: [{ storeProductId: product.id, observedQuantity: 1 }],
    });

    expect(data).toBeNull();
    expect(error?.message).toMatch(/^forbidden:/);

    const unchangedProduct = requireRow<OnHandQuantityRow>(
      await serviceClient
        .from("store_products")
        .select("on_hand_quantity")
        .eq("id", product.id)
        .single(),
      "failed to reload the product after the operator's forbidden count attempt"
    );
    expect(unchangedProduct.on_hand_quantity).toBe(3);
  });

  it("lets an owner record a count", async () => {
    const product = await createProduct({ onHandQuantity: 7 });
    const countSessionId = randomUUID();

    const { data, error } = await ownerClient.rpc("record_inventory_count_v2", {
      p_store_id: storeId,
      p_count_session_id: countSessionId,
      p_lines: [{ storeProductId: product.id, observedQuantity: 2 }],
    });

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({
      store_product_id: product.id,
      status: "pending",
      created_by_role: "owner",
    });
  });

  it("raises not_found when a line's product does not belong to the store", async () => {
    const otherStore = requireRow<IdRow>(
      await serviceClient
        .from("stores")
        .insert({ name: `Other Store ${randomUUID()}`, address: "elsewhere" })
        .select()
        .single(),
      "failed to create the other store"
    );

    const foreignProduct = requireRow<IdRow>(
      await serviceClient
        .from("store_products")
        .insert({
          store_id: otherStore.id,
          product_name: "foreign product",
          on_hand_quantity: 1,
        })
        .select()
        .single(),
      "failed to create the foreign product"
    );

    const { data, error } = await staffClient.rpc("record_inventory_count_v2", {
      p_store_id: storeId,
      p_count_session_id: randomUUID(),
      p_lines: [{ storeProductId: foreignProduct.id, observedQuantity: 1 }],
    });

    expect(data).toBeNull();
    // Fix round 1, oracle parity ruling: this used to be validation_failed,
    // the fake raises not_found for this exact case, changed to match.
    expect(error?.message).toMatch(/^not_found:/);
  });

  it("forbids staff from approving a stock adjustment", async () => {
    const product = await createProduct({ onHandQuantity: 6 });
    const proposal = await createPendingProposal({
      storeProductId: product.id,
      currentQuantity: 6,
      proposedQuantity: 9,
    });

    const { data, error } = await staffClient.rpc("approve_stock_adjustment_v2", {
      p_store_id: storeId,
      p_proposal_id: proposal.id,
      p_decision: "approve",
      p_idempotency_key: randomUUID(),
      p_expected_version: proposal.version,
    });

    expect(data).toBeNull();
    expect(error?.message).toMatch(/^forbidden:/);

    const unchangedProduct = requireRow<OnHandQuantityRow>(
      await serviceClient
        .from("store_products")
        .select("on_hand_quantity")
        .eq("id", product.id)
        .single(),
      "failed to reload the product after the forbidden approval attempt"
    );
    expect(unchangedProduct.on_hand_quantity).toBe(6);
  });

  it("lets a manager approve a proposal, applying the delta with a movement row and version bumps", async () => {
    const product = await createProduct({ onHandQuantity: 6 });
    const proposal = await createPendingProposal({
      storeProductId: product.id,
      currentQuantity: 6,
      proposedQuantity: 9,
    });

    const auditBefore = await countAuditEntriesForStore();

    const { data, error } = await managerClient.rpc("approve_stock_adjustment_v2", {
      p_store_id: storeId,
      p_proposal_id: proposal.id,
      p_decision: "approve",
      p_idempotency_key: randomUUID(),
      p_expected_version: proposal.version,
    });

    expect(error).toBeNull();
    expect(data.status).toBe("applied");
    expect(data.version).toBe(proposal.version + 1);

    const updatedProduct = requireRow<OnHandAndVersionRow>(
      await serviceClient
        .from("store_products")
        .select("on_hand_quantity, version")
        .eq("id", product.id)
        .single(),
      "failed to reload the product after approval"
    );
    expect(updatedProduct.on_hand_quantity).toBe(9);
    expect(updatedProduct.version).toBe(2);

    const { data: movements, error: movementsError } = await serviceClient
      .from("stock_movements")
      .select("delta, kind, ref_id, store_product_id, store_id")
      .eq("store_product_id", product.id);

    expect(movementsError).toBeNull();
    expect(movements).toHaveLength(1);
    expect(movements?.[0]).toMatchObject({
      delta: 3,
      kind: "adjustment",
      ref_id: proposal.id,
      store_id: storeId,
    });

    const auditAfter = await countAuditEntriesForStore();
    expect(auditAfter).toBe(auditBefore + 1);
  });

  it("lets an owner approve a stock adjustment", async () => {
    const product = await createProduct({ onHandQuantity: 7 });
    const proposal = await createPendingProposal({
      storeProductId: product.id,
      currentQuantity: 7,
      proposedQuantity: 5,
    });

    const { data, error } = await ownerClient.rpc("approve_stock_adjustment_v2", {
      p_store_id: storeId,
      p_proposal_id: proposal.id,
      p_decision: "approve",
      p_idempotency_key: randomUUID(),
      p_expected_version: proposal.version,
    });

    expect(error).toBeNull();
    expect(data.status).toBe("applied");

    const updatedProduct = requireRow<OnHandQuantityRow>(
      await serviceClient
        .from("store_products")
        .select("on_hand_quantity")
        .eq("id", product.id)
        .single(),
      "failed to reload the product after the owner's approval"
    );
    expect(updatedProduct.on_hand_quantity).toBe(5);
  });

  it("lets a manager reject a proposal without touching stock or creating a movement", async () => {
    const product = await createProduct({ onHandQuantity: 6 });
    const proposal = await createPendingProposal({
      storeProductId: product.id,
      currentQuantity: 6,
      proposedQuantity: 2,
    });

    const { data, error } = await managerClient.rpc("approve_stock_adjustment_v2", {
      p_store_id: storeId,
      p_proposal_id: proposal.id,
      p_decision: "reject",
      p_idempotency_key: randomUUID(),
      p_expected_version: proposal.version,
    });

    expect(error).toBeNull();
    expect(data.status).toBe("rejected");
    expect(data.version).toBe(proposal.version + 1);

    const unchangedProduct = requireRow<OnHandQuantityRow>(
      await serviceClient
        .from("store_products")
        .select("on_hand_quantity")
        .eq("id", product.id)
        .single(),
      "failed to reload the product after rejection"
    );
    expect(unchangedProduct.on_hand_quantity).toBe(6);

    const { data: movements, error: movementsError } = await serviceClient
      .from("stock_movements")
      .select("id")
      .eq("store_product_id", product.id);
    expect(movementsError).toBeNull();
    expect(movements).toHaveLength(0);
  });

  it("raises version_conflict when the expected version is stale", async () => {
    const product = await createProduct({ onHandQuantity: 6 });
    const proposal = await createPendingProposal({
      storeProductId: product.id,
      currentQuantity: 6,
      proposedQuantity: 4,
    });

    const { data, error } = await managerClient.rpc("approve_stock_adjustment_v2", {
      p_store_id: storeId,
      p_proposal_id: proposal.id,
      p_decision: "approve",
      p_idempotency_key: randomUUID(),
      p_expected_version: proposal.version + 1,
    });

    expect(data).toBeNull();
    expect(error?.message).toMatch(/^version_conflict:/);

    const unchangedProduct = requireRow<OnHandQuantityRow>(
      await serviceClient
        .from("store_products")
        .select("on_hand_quantity")
        .eq("id", product.id)
        .single(),
      "failed to reload the product after the stale version attempt"
    );
    expect(unchangedProduct.on_hand_quantity).toBe(6);
  });

  it("raises not_found for a proposal that does not exist", async () => {
    const { data, error } = await managerClient.rpc("approve_stock_adjustment_v2", {
      p_store_id: storeId,
      p_proposal_id: randomUUID(),
      p_decision: "approve",
      p_idempotency_key: randomUUID(),
      p_expected_version: 1,
    });

    expect(data).toBeNull();
    expect(error?.message).toMatch(/^not_found:/);
  });

  it("replays the stored outcome for the same idempotency key and raises invalid_state for a different key once the proposal is terminal", async () => {
    const product = await createProduct({ onHandQuantity: 6 });
    const proposal = await createPendingProposal({
      storeProductId: product.id,
      currentQuantity: 6,
      proposedQuantity: 1,
    });
    const idempotencyKey = randomUUID();

    const first = await managerClient.rpc("approve_stock_adjustment_v2", {
      p_store_id: storeId,
      p_proposal_id: proposal.id,
      p_decision: "approve",
      p_idempotency_key: idempotencyKey,
      p_expected_version: proposal.version,
    });
    expect(first.error).toBeNull();
    expect(first.data.status).toBe("applied");

    const replay = await managerClient.rpc("approve_stock_adjustment_v2", {
      p_store_id: storeId,
      p_proposal_id: proposal.id,
      p_decision: "approve",
      p_idempotency_key: idempotencyKey,
      p_expected_version: proposal.version,
    });
    expect(replay.error).toBeNull();
    expect(replay.data).toEqual(first.data);

    const { data: movementsAfterReplay, error: movementsError } = await serviceClient
      .from("stock_movements")
      .select("id")
      .eq("store_product_id", product.id);
    expect(movementsError).toBeNull();
    expect(movementsAfterReplay).toHaveLength(1);

    const differentKey = await managerClient.rpc("approve_stock_adjustment_v2", {
      p_store_id: storeId,
      p_proposal_id: proposal.id,
      p_decision: "approve",
      p_idempotency_key: randomUUID(),
      p_expected_version: proposal.version + 1,
    });
    expect(differentKey.data).toBeNull();
    expect(differentKey.error?.message).toMatch(/^invalid_state:/);
  });

  it("raises version_conflict, not invalid_state, when a stale pre decision expected version is used against an already terminal proposal", async () => {
    const product = await createProduct({ onHandQuantity: 6 });
    const proposal = await createPendingProposal({
      storeProductId: product.id,
      currentQuantity: 6,
      proposedQuantity: 3,
    });

    const first = await managerClient.rpc("approve_stock_adjustment_v2", {
      p_store_id: storeId,
      p_proposal_id: proposal.id,
      p_decision: "approve",
      p_idempotency_key: randomUUID(),
      p_expected_version: proposal.version,
    });
    expect(first.error).toBeNull();
    expect(first.data.status).toBe("applied");

    // proposal.version here is the original, pre decision version, now
    // stale since the approval above bumped it. A fresh key means this is
    // not a replay, so the version check must be reached, and it must run
    // before the status check, or this would incorrectly report
    // invalid_state instead of the caller's real problem.
    const staleVersionAttempt = await managerClient.rpc("approve_stock_adjustment_v2", {
      p_store_id: storeId,
      p_proposal_id: proposal.id,
      p_decision: "approve",
      p_idempotency_key: randomUUID(),
      p_expected_version: proposal.version,
    });

    expect(staleVersionAttempt.data).toBeNull();
    expect(staleVersionAttempt.error?.message).toMatch(/^version_conflict:/);
  });

  it("raises idempotency_conflict when the same key is reused with a different decision", async () => {
    const product = await createProduct({ onHandQuantity: 6 });
    const proposal = await createPendingProposal({
      storeProductId: product.id,
      currentQuantity: 6,
      proposedQuantity: 4,
    });
    const sharedKey = randomUUID();

    const first = await managerClient.rpc("approve_stock_adjustment_v2", {
      p_store_id: storeId,
      p_proposal_id: proposal.id,
      p_decision: "approve",
      p_idempotency_key: sharedKey,
      p_expected_version: proposal.version,
    });
    expect(first.error).toBeNull();
    expect(first.data.status).toBe("applied");

    const reusedWithDifferentDecision = await managerClient.rpc("approve_stock_adjustment_v2", {
      p_store_id: storeId,
      p_proposal_id: proposal.id,
      p_decision: "reject",
      p_idempotency_key: sharedKey,
      p_expected_version: first.data.version,
    });

    expect(reusedWithDifferentDecision.data).toBeNull();
    expect(reusedWithDifferentDecision.error?.message).toMatch(/^idempotency_conflict:/);

    const proposalRow = requireRow<StatusRow>(
      await serviceClient
        .from("stock_adjustment_proposals")
        .select("status")
        .eq("id", proposal.id)
        .single(),
      "failed to reload the proposal after the reused key attempt"
    );
    expect(proposalRow.status).toBe("applied");
  });

  it("raises validation_failed instead of a raw constraint error when two prior proposals would together push stock negative", async () => {
    const product = await createProduct({ onHandQuantity: 5 });

    const firstProposal = await createPendingProposal({
      storeProductId: product.id,
      currentQuantity: 5,
      proposedQuantity: 1,
    });
    const secondProposal = await createPendingProposal({
      storeProductId: product.id,
      currentQuantity: 5,
      proposedQuantity: 2,
    });

    const first = await managerClient.rpc("approve_stock_adjustment_v2", {
      p_store_id: storeId,
      p_proposal_id: firstProposal.id,
      p_decision: "approve",
      p_idempotency_key: randomUUID(),
      p_expected_version: firstProposal.version,
    });
    expect(first.error).toBeNull();
    expect(first.data.status).toBe("applied");

    const afterFirst = requireRow<OnHandQuantityRow>(
      await serviceClient
        .from("store_products")
        .select("on_hand_quantity")
        .eq("id", product.id)
        .single(),
      "failed to reload the product after the first approval"
    );
    expect(afterFirst.on_hand_quantity).toBe(1);

    const second = await managerClient.rpc("approve_stock_adjustment_v2", {
      p_store_id: storeId,
      p_proposal_id: secondProposal.id,
      p_decision: "approve",
      p_idempotency_key: randomUUID(),
      p_expected_version: secondProposal.version,
    });

    expect(second.data).toBeNull();
    expect(second.error?.message).toMatch(/^validation_failed:/);
    expect(second.error?.message ?? "").not.toMatch(RAW_DUPLICATE_KEY_PATTERN);
    expect(second.error?.message ?? "").not.toMatch(/on_hand_quantity|constraint|violates/i);

    const afterSecond = requireRow<OnHandQuantityRow>(
      await serviceClient
        .from("store_products")
        .select("on_hand_quantity")
        .eq("id", product.id)
        .single(),
      "failed to reload the product after the rejected second approval"
    );
    expect(afterSecond.on_hand_quantity).toBe(1);

    const secondProposalRow = requireRow<StatusRow>(
      await serviceClient
        .from("stock_adjustment_proposals")
        .select("status")
        .eq("id", secondProposal.id)
        .single(),
      "failed to reload the second proposal"
    );
    expect(secondProposalRow.status).toBe("pending");
  });

  it("never leaks a raw duplicate key error when the same idempotency key is used concurrently", async () => {
    const product = await createProduct({ onHandQuantity: 6 });
    const proposal = await createPendingProposal({
      storeProductId: product.id,
      currentQuantity: 6,
      proposedQuantity: 9,
    });
    const sharedKey = randomUUID();

    const callApprove = () =>
      managerClient.rpc("approve_stock_adjustment_v2", {
        p_store_id: storeId,
        p_proposal_id: proposal.id,
        p_decision: "approve",
        p_idempotency_key: sharedKey,
        p_expected_version: proposal.version,
      });

    // Four concurrent callers, not two, gives the race a real chance to
    // land. A fast local connection can serialize two callers enough that
    // the second one's plain select already sees the first one's insert,
    // which would hide the bug this test exists to catch. More callers
    // firing on the same tick raises the odds that at least two land
    // inside each other's window.
    const settled = await Promise.allSettled([
      callApprove(),
      callApprove(),
      callApprove(),
      callApprove(),
    ]);

    const successes: unknown[] = [];
    for (const outcome of settled) {
      expect(outcome.status).toBe("fulfilled");
      if (outcome.status !== "fulfilled") continue;

      const { data, error } = outcome.value;
      expect(error?.message ?? "").not.toMatch(RAW_DUPLICATE_KEY_PATTERN);

      if (data) {
        successes.push(data);
      } else {
        expect(error?.message).toMatch(/^idempotency_conflict:/);
      }
    }

    expect(successes.length).toBeGreaterThanOrEqual(1);
    for (const success of successes) {
      expect(success).toEqual(successes[0]);
    }

    const { data: movements, error: movementsError } = await serviceClient
      .from("stock_movements")
      .select("id")
      .eq("store_product_id", product.id);
    expect(movementsError).toBeNull();
    expect(movements).toHaveLength(1);
  });

  it("does not double apply a proposal when two different idempotency keys race to approve the same proposal", async () => {
    const product = await createProduct({ onHandQuantity: 10 });
    const proposal = await createPendingProposal({
      storeProductId: product.id,
      currentQuantity: 10,
      proposedQuantity: 7,
    });

    const settled = await Promise.allSettled([
      managerClient.rpc("approve_stock_adjustment_v2", {
        p_store_id: storeId,
        p_proposal_id: proposal.id,
        p_decision: "approve",
        p_idempotency_key: randomUUID(),
        p_expected_version: proposal.version,
      }),
      managerClient.rpc("approve_stock_adjustment_v2", {
        p_store_id: storeId,
        p_proposal_id: proposal.id,
        p_decision: "approve",
        p_idempotency_key: randomUUID(),
        p_expected_version: proposal.version,
      }),
    ]);

    let successCount = 0;
    for (const outcome of settled) {
      expect(outcome.status).toBe("fulfilled");
      if (outcome.status !== "fulfilled") continue;
      const { data, error } = outcome.value;
      expect(error?.message ?? "").not.toMatch(RAW_DUPLICATE_KEY_PATTERN);
      if (data) {
        successCount += 1;
      } else {
        expect(error?.message).toMatch(/^version_conflict:|^invalid_state:/);
      }
    }
    expect(successCount).toBe(1);

    const updatedProduct = requireRow<OnHandQuantityRow>(
      await serviceClient
        .from("store_products")
        .select("on_hand_quantity")
        .eq("id", product.id)
        .single(),
      "failed to reload the product after the racing approvals"
    );
    expect(updatedProduct.on_hand_quantity).toBe(7);

    const { data: movements, error: movementsError } = await serviceClient
      .from("stock_movements")
      .select("id")
      .eq("store_product_id", product.id);
    expect(movementsError).toBeNull();
    expect(movements).toHaveLength(1);
  });

  it("stays deadlock free when approvals race a cascading delete of the product they touch", async () => {
    // approve_stock_adjustment_v2 locks two rows, the product and the
    // proposal. Deleting a store_product locks the same pair in the order
    // parent then child, because stock_adjustment_proposals cascades from
    // it. While approve took those two the other way round, the two paths
    // could each end up holding what the other was waiting for, and Postgres
    // resolves that by killing one of them with a raw deadlock error no
    // caller has a contract for. Both paths now take the product first, so
    // the cycle cannot form at all.
    const contractedPrefix =
      /^(validation_failed|forbidden|not_found|version_conflict|invalid_state|idempotency_conflict|sold_out|offer_not_live|allocation_exceeded):/;
    const messages: string[] = [];

    // Several rounds, because whether two callers actually interleave on a
    // fast local socket is a matter of timing. One round proves little, a
    // handful gives the old ordering real chances to be caught.
    for (let round = 0; round < 4; round += 1) {
      const product = await createProduct({ onHandQuantity: 10 });
      const proposals = await Promise.all([
        createPendingProposal({
          storeProductId: product.id,
          currentQuantity: 10,
          proposedQuantity: 11,
        }),
        createPendingProposal({
          storeProductId: product.id,
          currentQuantity: 10,
          proposedQuantity: 12,
        }),
        createPendingProposal({
          storeProductId: product.id,
          currentQuantity: 10,
          proposedQuantity: 13,
        }),
      ]);

      const settled = await Promise.allSettled([
        ...proposals.map((proposal) =>
          managerClient.rpc("approve_stock_adjustment_v2", {
            p_store_id: storeId,
            p_proposal_id: proposal.id,
            p_decision: "approve",
            p_idempotency_key: randomUUID(),
            p_expected_version: proposal.version,
          })
        ),
        serviceClient.from("store_products").delete().eq("id", product.id),
      ]);

      for (const outcome of settled) {
        // Nothing may reject outright either, every caller has to come back
        // with a Result shaped answer.
        expect(outcome.status).toBe("fulfilled");
        if (outcome.status !== "fulfilled") continue;
        const message = outcome.value.error?.message ?? "";
        if (message.length > 0) {
          messages.push(message);
        }
      }
    }

    for (const message of messages) {
      expect(message).not.toMatch(/deadlock/i);
      expect(message).not.toMatch(RAW_DUPLICATE_KEY_PATTERN);
      // Losing a race here is normal, the proposal or the product may really
      // be gone by the time a caller gets its locks. What is not normal is
      // hearing about it in raw Postgres terms.
      expect(message).toMatch(contractedPrefix);
    }
  });

  it("rejects any attempt to update or delete a stock movement row, even from the service role", async () => {
    const product = await createProduct({ onHandQuantity: 6 });
    const proposal = await createPendingProposal({
      storeProductId: product.id,
      currentQuantity: 6,
      proposedQuantity: 8,
    });

    const approved = await managerClient.rpc("approve_stock_adjustment_v2", {
      p_store_id: storeId,
      p_proposal_id: proposal.id,
      p_decision: "approve",
      p_idempotency_key: randomUUID(),
      p_expected_version: proposal.version,
    });
    expect(approved.error).toBeNull();

    const movement = requireRow<IdRow>(
      await serviceClient
        .from("stock_movements")
        .select("id")
        .eq("store_product_id", product.id)
        .single(),
      "failed to load the movement created by approval"
    );

    const { error: updateError } = await serviceClient
      .from("stock_movements")
      .update({ delta: 999 })
      .eq("id", movement.id);
    expect(updateError).not.toBeNull();
    expect(updateError?.message).toMatch(/^invalid_state:/);

    const { error: deleteError } = await serviceClient
      .from("stock_movements")
      .delete()
      .eq("id", movement.id);
    expect(deleteError).not.toBeNull();
    expect(deleteError?.message).toMatch(/^invalid_state:/);

    const stillThere = requireRow<DeltaRow>(
      await serviceClient
        .from("stock_movements")
        .select("delta")
        .eq("id", movement.id)
        .single(),
      "the movement row disappeared or was mutated despite the append only trigger"
    );
    expect(stillThere.delta).toBe(2);
  });

  it("does not let an authenticated member insert directly into store_products", async () => {
    const { data, error } = await managerClient
      .from("store_products")
      .insert({ store_id: storeId, product_name: "direct insert attempt", on_hand_quantity: 1 })
      .select();

    expect(error).not.toBeNull();
    expect(data == null || data.length === 0).toBe(true);
  });

  it("hides store_products from a non member and lets a member select it", async () => {
    const product = await createProduct({ onHandQuantity: 3 });

    const memberRead = await staffClient
      .from("store_products")
      .select("id")
      .eq("id", product.id)
      .maybeSingle();
    expect(memberRead.error).toBeNull();
    expect(memberRead.data?.id).toBe(product.id);

    const nonMemberRead = await nonMemberClient
      .from("store_products")
      .select("id")
      .eq("id", product.id)
      .maybeSingle();
    expect(nonMemberRead.error).toBeNull();
    expect(nonMemberRead.data).toBeNull();

    const anonRead = await getAnonClient()
      .from("store_products")
      .select("id")
      .eq("id", product.id);
    expect(anonRead.error).toBeNull();
    expect(anonRead.data).toEqual([]);
  });

  it("computes stock confidence boundaries at 72 hours and 7 days", async () => {
    const hoursAgo = (hours: number) =>
      new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const cases: { label: string; lastVerifiedAt: string | null; expected: string }[] = [
      { label: "just now", lastVerifiedAt: hoursAgo(0), expected: "high" },
      { label: "71 hours ago", lastVerifiedAt: hoursAgo(71), expected: "high" },
      { label: "73 hours ago", lastVerifiedAt: hoursAgo(73), expected: "medium" },
      { label: "6 days ago", lastVerifiedAt: hoursAgo(6 * 24), expected: "medium" },
      { label: "8 days ago", lastVerifiedAt: hoursAgo(8 * 24), expected: "low" },
      { label: "never verified", lastVerifiedAt: null, expected: "low" },
    ];

    for (const testCase of cases) {
      const { data, error } = await serviceClient.rpc("fn_stock_confidence", {
        last_verified_at: testCase.lastVerifiedAt,
      });
      expect(error).toBeNull();
      expect(data).toBe(testCase.expected);
    }
  });
});

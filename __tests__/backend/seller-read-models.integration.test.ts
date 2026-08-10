/**
 * Integration coverage for the three v2 seller read models:
 * list_store_offers_v2, list_store_inventory_v2, and list_store_exceptions_v2.
 *
 * Talks to a real local Supabase stack through scripts/backend-test-helpers.
 * These three RPCs, added in
 * supabase/migrations/20260810130000_v2_seller_read_models.sql, had no SQL
 * level coverage before this suite, only the facade level conformance run in
 * facade-conformance.integration.test.ts. Every block here calls the RPC
 * directly, not through lib/api/supabase-seller-api.ts.
 *
 * Isolation: every run creates a fresh store named with a uuid suffix and
 * leaves it in place, shared tables are never truncated. Test user emails
 * stay fixed across runs and across suites on purpose, reusing the same
 * owner, manager, and non member accounts stores-roles.integration.test.ts
 * and inventory.integration.test.ts already sign in, so signInTestUser
 * reuses those auth.users rows instead of growing that table.
 */

import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  backendEnvPresent,
  backendSkipReason,
  getAnonClient,
  getServiceClient,
  signInTestUser,
} from "../../scripts/backend-test-helpers";

if (!backendEnvPresent()) {
  console.log(`seller-read-models.integration.test.ts: ${backendSkipReason()}`);
}

const d = backendEnvPresent() ? describe : describe.skip;

const READ_MODEL_RPCS = [
  "list_store_offers_v2",
  "list_store_inventory_v2",
  "list_store_exceptions_v2",
];

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function requireRow<T>(
  result: { data: T | null; error: { message: string } | null },
  context: string
): T {
  if (result.error || !result.data) {
    throw new Error(`${context}: ${result.error?.message ?? "no row returned"}`);
  }
  return result.data;
}

interface InventoryRow {
  store_product_id: string;
  on_hand_quantity: number;
  allocated_quantity: number;
  max_offerable_quantity: number;
  confidence: string;
}

d("seller read models: offers, inventory, and exceptions RPCs", () => {
  const runId = randomUUID();

  // Fixed across runs and shared with stores-roles.integration.test.ts and
  // inventory.integration.test.ts on purpose, so signInTestUser reuses the
  // same auth.users rows instead of creating new ones on every run.
  const ownerEmail = "backend-test-owner@lastbite.test";
  const managerEmail = "backend-test-manager@lastbite.test";
  const nonMemberEmail = "backend-test-nonmember@lastbite.test";

  let service: SupabaseClient;
  let anon: SupabaseClient;
  let owner: SupabaseClient;
  let manager: SupabaseClient;
  let nonMember: SupabaseClient;
  let storeId: string;

  beforeAll(async () => {
    service = getServiceClient();
    anon = getAnonClient();

    [owner, manager, nonMember] = await Promise.all([
      signInTestUser(ownerEmail),
      signInTestUser(managerEmail),
      signInTestUser(nonMemberEmail),
    ]);

    const [{ data: ownerUser }, { data: managerUser }] = await Promise.all([
      owner.auth.getUser(),
      manager.auth.getUser(),
    ]);
    if (!ownerUser.user || !managerUser.user) {
      throw new Error("could not resolve auth.getUser() for one of the seeded test users");
    }

    const store = requireRow<{ id: string }>(
      await service
        .from("stores")
        .insert({
          name: `Seller Read Models Test ${runId}`,
          address: "9 Read Model Road",
          latitude: 41.3,
          longitude: 69.2,
        })
        .select("id")
        .single(),
      "create the test store"
    );
    storeId = store.id;

    const { error: membershipError } = await service.from("store_memberships").insert([
      { store_id: storeId, user_id: ownerUser.user.id, role: "owner" },
      { store_id: storeId, user_id: managerUser.user.id, role: "manager" },
    ]);
    if (membershipError) {
      throw new Error(`create the test memberships: ${membershipError.message}`);
    }
    // nonMember deliberately gets no membership row on this store.
  });

  it.each(READ_MODEL_RPCS)(
    "denies anon on %s, an error and no data, refused at the grant before any body runs",
    async (rpcName) => {
      const { data, error } = await anon.rpc(rpcName, { p_store_id: storeId });
      expect(error).not.toBeNull();
      expect(data).toBeNull();
    }
  );

  it.each(READ_MODEL_RPCS)(
    "reports forbidden to a signed in non member on %s",
    async (rpcName) => {
      const { data, error } = await nonMember.rpc(rpcName, { p_store_id: storeId });
      expect(data).toBeNull();
      expect(error?.message).toMatch(/^forbidden:/);
    }
  );

  it("pins list_store_inventory_v2's ceiling to the one publish_offer_v2 enforces, the two hand maintained copies of the same expression", async () => {
    const product = requireRow<{ id: string }>(
      await service
        .from("store_products")
        .insert({
          store_id: storeId,
          product_name: `Ceiling Parity Product ${randomUUID()}`,
          on_hand_quantity: 10,
          confidence: "high",
          last_verified_at: new Date().toISOString(),
        })
        .select("id")
        .single(),
      "create the ceiling parity product"
    );

    const pickupStart = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const pickupEnd = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
    const offerInput = (quantity: number) => ({
      allocation: {
        storeProductId: product.id,
        quantity,
        physicallySetAside: false,
      },
      title: "Ceiling parity offer",
      category: "bakery",
      imageUrl: null,
      contents: ["bread"],
      offerPriceUzs: 10000,
      referencePriceUzs: 20000,
      pickupStart,
      pickupEnd,
      allergens: [],
      dietaryBadges: [],
      pickupInstructions: null,
      cancellationPolicy: null,
    });

    // Offer A takes 3 of the 10 on hand units.
    const offerA = requireRow<{ id: string; version: number; status: string }>(
      await owner.rpc("publish_offer_v2", {
        p_store_id: storeId,
        p_input: offerInput(3),
        p_idempotency_key: randomUUID(),
      }),
      "publish offer A"
    );
    expect(offerA.status).toBe("live");

    // Reserving one unit of A moves it from quantity_available to a held
    // reservation. The ceiling sums both, so the product's encumbrance from
    // A does not change, only its composition does.
    const pickupCode = `LB-${randomUUID().slice(0, 8)}`;
    const reserved = requireRow<{ reservation: { id: string } }>(
      await anon.rpc("reserve_offer_v2", {
        p_offer_id: offerA.id,
        p_client_reservation_id: randomUUID(),
        p_installation_id: `installation-${randomUUID()}`,
        p_expected_offer_version: offerA.version,
        p_pickup_code: pickupCode,
        p_pickup_code_hash: sha256(pickupCode),
        p_pickup_code_hint: pickupCode.slice(-2),
      }),
      "reserve one unit of offer A"
    );
    expect(reserved.reservation.id).toBeTruthy();

    // Offer B, the second offer of the same product, takes 2 more.
    const offerB = requireRow<{ id: string; version: number; status: string }>(
      await owner.rpc("publish_offer_v2", {
        p_store_id: storeId,
        p_input: offerInput(2),
        p_idempotency_key: randomUUID(),
      }),
      "publish offer B, the second offer of the same product"
    );
    expect(offerB.status).toBe("live");

    // Reporting a mismatch pauses B. Paused sits in the same bucket as live
    // and sold_out in the ceiling expression, so this must not change the
    // total even though B has left the live pool.
    const mismatch = await manager.rpc("report_stock_mismatch_v2", {
      p_store_id: storeId,
      p_offer_id: offerB.id,
      p_observed_quantity: 0,
      p_reason: "shelf came up empty for the ceiling parity pin",
      p_idempotency_key: randomUUID(),
    });
    expect(mismatch.error).toBeNull();
    expect(mismatch.data.offer.status).toBe("paused");

    const inventory = await owner.rpc("list_store_inventory_v2", { p_store_id: storeId });
    expect(inventory.error).toBeNull();
    const row = ((inventory.data ?? []) as InventoryRow[]).find(
      (candidate) => candidate.store_product_id === product.id
    );
    if (!row) {
      throw new Error("the ceiling parity product did not appear in list_store_inventory_v2");
    }

    // A contributes quantity_available(2) + held(1) = 3. B, paused, still
    // contributes its quantity_available(2) in full. 3 + 2 = 5 allocated,
    // leaving 10 - 5 = 5 offerable.
    expect(row.on_hand_quantity).toBe(10);
    expect(row.allocated_quantity).toBe(5);
    expect(row.max_offerable_quantity).toBe(5);

    // The read model's ceiling has to be exactly what publish_offer_v2 itself
    // accepts, not an approximation of it. One unit over is refused, the
    // exact figure is not, pinning the two copies of the expression together.
    const overCeiling = await owner.rpc("publish_offer_v2", {
      p_store_id: storeId,
      p_input: offerInput(row.max_offerable_quantity + 1),
      p_idempotency_key: randomUUID(),
    });
    expect(overCeiling.data).toBeNull();
    expect(overCeiling.error?.message).toMatch(/^allocation_exceeded:/);

    const atCeiling = await owner.rpc("publish_offer_v2", {
      p_store_id: storeId,
      p_input: offerInput(row.max_offerable_quantity),
      p_idempotency_key: randomUUID(),
    });
    expect(atCeiling.error).toBeNull();
    expect(atCeiling.data.status).toBe("live");
    expect(atCeiling.data.quantity_available).toBe(row.max_offerable_quantity);
  });
});

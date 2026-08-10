/**
 * Integration coverage for resolve_store_exception_v2.
 *
 * Talks to a real local Supabase stack through scripts/backend-test-helpers.
 * Every test creates isolated rows under a run-specific store and calls the
 * RPC directly so grants, role checks, idempotency, audit, outbox, and the
 * inventory ceiling all run through Postgres.
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
  console.log(`exception-resolve.integration.test.ts: ${backendSkipReason()}`);
}

const d = backendEnvPresent() ? describe : describe.skip;

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

interface OpenMismatch {
  exceptionId: string;
  offerId: string;
  productId: string;
}

interface InventoryRow {
  store_product_id: string;
  allocated_quantity: number;
  max_offerable_quantity: number;
  has_open_exceptions: boolean;
}

d("resolve_store_exception_v2", () => {
  const runId = randomUUID();
  const ownerEmail = "backend-test-owner@lastbite.test";
  const managerEmail = "backend-test-manager@lastbite.test";
  const staffEmail = "backend-test-staff@lastbite.test";
  const nonMemberEmail = "backend-test-nonmember@lastbite.test";

  let service: SupabaseClient;
  let anon: SupabaseClient;
  let owner: SupabaseClient;
  let manager: SupabaseClient;
  let staff: SupabaseClient;
  let nonMember: SupabaseClient;
  let storeId: string;
  let otherStoreId: string;

  beforeAll(async () => {
    service = getServiceClient();
    anon = getAnonClient();
    [owner, manager, staff, nonMember] = await Promise.all([
      signInTestUser(ownerEmail),
      signInTestUser(managerEmail),
      signInTestUser(staffEmail),
      signInTestUser(nonMemberEmail),
    ]);

    const [ownerAuth, managerAuth, staffAuth] = await Promise.all([
      owner.auth.getUser(),
      manager.auth.getUser(),
      staff.auth.getUser(),
    ]);
    if (!ownerAuth.data.user || !managerAuth.data.user || !staffAuth.data.user) {
      throw new Error("could not resolve one of the exception resolve test users");
    }

    const store = requireRow<{ id: string }>(
      await service
        .from("stores")
        .insert({
          name: `Exception Resolve Test ${runId}`,
          address: "11 Resolution Road",
          latitude: 41.3,
          longitude: 69.2,
        })
        .select("id")
        .single(),
      "create the exception resolve store"
    );
    storeId = store.id;

    const otherStore = requireRow<{ id: string }>(
      await service
        .from("stores")
        .insert({
          name: `Exception Resolve Other Store ${runId}`,
          address: "12 Resolution Road",
          latitude: 41.3,
          longitude: 69.2,
        })
        .select("id")
        .single(),
      "create the other exception resolve store"
    );
    otherStoreId = otherStore.id;

    const { error: membershipError } = await service
      .from("store_memberships")
      .insert([
        {
          store_id: storeId,
          user_id: ownerAuth.data.user.id,
          role: "owner",
        },
        {
          store_id: storeId,
          user_id: managerAuth.data.user.id,
          role: "manager",
        },
        {
          store_id: storeId,
          user_id: staffAuth.data.user.id,
          role: "staff",
        },
        {
          store_id: otherStoreId,
          user_id: managerAuth.data.user.id,
          role: "owner",
        },
      ]);
    if (membershipError) {
      throw new Error(`create exception resolve memberships: ${membershipError.message}`);
    }
  });

  function offerInput(productId: string, quantity: number) {
    return {
      allocation: {
        storeProductId: productId,
        quantity,
        physicallySetAside: false,
      },
      title: "Exception resolution offer",
      category: "bakery",
      imageUrl: null,
      contents: ["bread"],
      offerPriceUzs: 10000,
      referencePriceUzs: 20000,
      pickupStart: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      pickupEnd: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      allergens: [],
      dietaryBadges: [],
      pickupInstructions: null,
      cancellationPolicy: null,
    };
  }

  async function openMismatch(quantity = 3, reservations = 2): Promise<OpenMismatch> {
    const product = requireRow<{ id: string }>(
      await service
        .from("store_products")
        .insert({
          store_id: storeId,
          product_name: `Exception Resolve Product ${randomUUID()}`,
          on_hand_quantity: 10,
          confidence: "high",
          last_verified_at: new Date().toISOString(),
        })
        .select("id")
        .single(),
      "create the exception resolve product"
    );
    const offer = requireRow<{ id: string; version: number }>(
      await owner.rpc("publish_offer_v2", {
        p_store_id: storeId,
        p_input: offerInput(product.id, quantity),
        p_idempotency_key: randomUUID(),
      }),
      "publish the exception resolve offer"
    );

    for (let index = 0; index < reservations; index += 1) {
      const pickupCode = `LB-${randomUUID().slice(0, 8)}`;
      requireRow<{ reservation: { id: string } }>(
        await anon.rpc("reserve_offer_v2", {
          p_offer_id: offer.id,
          p_client_reservation_id: randomUUID(),
          p_installation_id: `exception-resolution-${randomUUID()}`,
          p_expected_offer_version: offer.version + index,
          p_pickup_code: pickupCode,
          p_pickup_code_hash: sha256(pickupCode),
          p_pickup_code_hint: pickupCode.slice(-2),
        }),
        `reserve exception resolve unit ${index + 1}`
      );
    }

    const mismatch = requireRow<{
      exception: { id: string };
      offer: { id: string };
    }>(
      await manager.rpc("report_stock_mismatch_v2", {
        p_store_id: storeId,
        p_offer_id: offer.id,
        p_observed_quantity: 0,
        p_reason: "reserved stock could not be found",
        p_idempotency_key: randomUUID(),
      }),
      "open the stock mismatch exception"
    );
    return {
      exceptionId: mismatch.exception.id,
      offerId: mismatch.offer.id,
      productId: product.id,
    };
  }

  async function inventoryRow(productId: string): Promise<InventoryRow> {
    const inventory = await manager.rpc("list_store_inventory_v2", {
      p_store_id: storeId,
    });
    if (inventory.error) {
      throw new Error(`list exception resolve inventory: ${inventory.error.message}`);
    }
    const row = ((inventory.data ?? []) as InventoryRow[]).find(
      (candidate) => candidate.store_product_id === productId
    );
    if (!row) {
      throw new Error("exception resolve product was missing from inventory");
    }
    return row;
  }

  it("denies anon callers at the function grant", async () => {
    const { data, error } = await anon.rpc("resolve_store_exception_v2", {
      p_store_id: storeId,
      p_exception_id: randomUUID(),
      p_resolution_note: "anon should never reach the function body",
      p_idempotency_key: randomUUID(),
    });

    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });

  it("denies staff and signed in non members with forbidden", async () => {
    const opened = await openMismatch();
    for (const caller of [staff, nonMember]) {
      const { data, error } = await caller.rpc("resolve_store_exception_v2", {
        p_store_id: storeId,
        p_exception_id: opened.exceptionId,
        p_resolution_note: "unauthorized resolution attempt",
        p_idempotency_key: randomUUID(),
      });
      expect(data).toBeNull();
      expect(error?.message).toMatch(/^forbidden:/);
    }
  });

  it("validates the note and returns not_found when the exception is outside the store", async () => {
    const opened = await openMismatch();
    const emptyNote = await manager.rpc("resolve_store_exception_v2", {
      p_store_id: storeId,
      p_exception_id: opened.exceptionId,
      p_resolution_note: "   ",
      p_idempotency_key: randomUUID(),
    });
    expect(emptyNote.data).toBeNull();
    expect(emptyNote.error?.message).toMatch(/^validation_failed:/);

    const wrongStore = await manager.rpc("resolve_store_exception_v2", {
      p_store_id: otherStoreId,
      p_exception_id: opened.exceptionId,
      p_resolution_note: "valid note but wrong store",
      p_idempotency_key: randomUUID(),
    });
    expect(wrongStore.data).toBeNull();
    expect(wrongStore.error?.message).toMatch(/^not_found:/);
  });

  it("resolves the exception, releases mismatch capacity, audits, emits, and publishes at the recovered ceiling", async () => {
    const opened = await openMismatch();
    const before = await inventoryRow(opened.productId);
    expect(before.allocated_quantity).toBe(3);
    expect(before.max_offerable_quantity).toBe(7);
    expect(before.has_open_exceptions).toBe(true);
    const linkedFailures = await service
      .from("reservations_v2")
      .select("failed_exception_id")
      .eq("offer_id", opened.offerId)
      .eq("status", "failed_stock_mismatch");
    expect(linkedFailures.error).toBeNull();
    expect(linkedFailures.data).toHaveLength(2);
    expect(
      linkedFailures.data?.every(
        (reservation) => reservation.failed_exception_id === opened.exceptionId
      )
    ).toBe(true);

    const note = "Manager recounted the shelf and found the two reserved units";
    const resolved = requireRow<{
      id: string;
      status: string;
      resolution_note: string | null;
      resolved_at: string | null;
    }>(
      await manager.rpc("resolve_store_exception_v2", {
        p_store_id: storeId,
        p_exception_id: opened.exceptionId,
        p_resolution_note: note,
        p_idempotency_key: randomUUID(),
      }),
      "resolve the stock mismatch exception"
    );
    expect(resolved).toMatchObject({
      id: opened.exceptionId,
      status: "resolved",
      resolution_note: note,
    });
    expect(resolved.resolved_at).not.toBeNull();

    const after = await inventoryRow(opened.productId);
    expect(after.allocated_quantity).toBe(1);
    expect(after.max_offerable_quantity).toBe(9);
    expect(after.has_open_exceptions).toBe(false);

    const recoveredPublish = await owner.rpc("publish_offer_v2", {
      p_store_id: storeId,
      p_input: offerInput(opened.productId, after.max_offerable_quantity),
      p_idempotency_key: randomUUID(),
    });
    expect(recoveredPublish.error).toBeNull();
    expect(recoveredPublish.data.quantity_available).toBe(9);

    const audit = await service
      .from("audit_entries")
      .select("command, detail")
      .eq("store_id", storeId)
      .eq("command", "resolve_store_exception_v2")
      .eq("detail->>exceptionId", opened.exceptionId);
    expect(audit.error).toBeNull();
    expect(audit.data).toHaveLength(1);

    const outbox = await service
      .from("outbox_events")
      .select("event_type, payload")
      .eq("event_type", "exception_resolved")
      .eq("payload->>exceptionId", opened.exceptionId);
    expect(outbox.error).toBeNull();
    expect(outbox.data).toHaveLength(1);
  });

  it("replays the same key, rejects a fresh key after resolution, and detects a fingerprint conflict", async () => {
    const first = await openMismatch();
    const second = await openMismatch(1, 0);
    const key = randomUUID();
    const input = {
      p_store_id: storeId,
      p_exception_id: first.exceptionId,
      p_resolution_note: "Resolution outcome stored for replay",
      p_idempotency_key: key,
    };

    const resolved = await owner.rpc("resolve_store_exception_v2", input);
    expect(resolved.error).toBeNull();
    const replay = await owner.rpc("resolve_store_exception_v2", input);
    expect(replay.error).toBeNull();
    expect(replay.data).toEqual(resolved.data);

    const freshKey = await owner.rpc("resolve_store_exception_v2", {
      ...input,
      p_idempotency_key: randomUUID(),
    });
    expect(freshKey.data).toBeNull();
    expect(freshKey.error?.message).toMatch(/^invalid_state:/);

    const conflict = await owner.rpc("resolve_store_exception_v2", {
      ...input,
      p_exception_id: second.exceptionId,
    });
    expect(conflict.data).toBeNull();
    expect(conflict.error?.message).toMatch(/^idempotency_conflict:/);

    const changedNote = await owner.rpc("resolve_store_exception_v2", {
      ...input,
      p_resolution_note: "A different resolution note under the same key",
    });
    expect(changedNote.data).toBeNull();
    expect(changedNote.error?.message).toMatch(/^idempotency_conflict:/);
  });

  it("does not re-encumber resolved failures when the same paused offer gets a new mismatch", async () => {
    const opened = await openMismatch();
    const resolved = await manager.rpc("resolve_store_exception_v2", {
      p_store_id: storeId,
      p_exception_id: opened.exceptionId,
      p_resolution_note: "Historical failed reservations reconciled",
      p_idempotency_key: randomUUID(),
    });
    expect(resolved.error).toBeNull();
    const afterResolve = await inventoryRow(opened.productId);

    const laterMismatch = await manager.rpc("report_stock_mismatch_v2", {
      p_store_id: storeId,
      p_offer_id: opened.offerId,
      p_observed_quantity: 0,
      p_reason: "later mismatch on the same paused offer",
      p_idempotency_key: randomUUID(),
    });
    expect(laterMismatch.error).toBeNull();
    const afterLaterMismatch = await inventoryRow(opened.productId);

    expect(afterLaterMismatch.allocated_quantity).toBe(afterResolve.allocated_quantity);
    expect(afterLaterMismatch.max_offerable_quantity).toBe(afterResolve.max_offerable_quantity);
  });
});

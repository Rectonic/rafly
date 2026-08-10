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
  console.log(`owner-digest.integration.test.ts: ${backendSkipReason()}`);
}

const d = backendEnvPresent() ? describe : describe.skip;

function requireRows<T>(
  result: { data: T | null; error: { message: string } | null },
  context: string
): T {
  if (result.error || !result.data) {
    throw new Error(`${context}: ${result.error?.message ?? "no data returned"}`);
  }
  return result.data;
}

function utcDate(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

interface DigestRow {
  storeName: string;
  generatedAt: string;
  staleVerification: unknown[];
  expiryRisk: unknown[];
  openExceptions: unknown[];
  pausedOffers: unknown[];
  countActivity7d: { daysWithCountSession: number; days: number };
  offers7d: {
    published: number;
    fulfilled: number;
    cancelledBySeller: number;
    expiredNoShow: number;
    failedStockMismatch: number;
  };
}

d("compose_owner_digest_v2", () => {
  const runId = randomUUID();
  let service: SupabaseClient;
  let anon: SupabaseClient;
  let owner: SupabaseClient;
  let manager: SupabaseClient;
  let staff: SupabaseClient;
  let nonMember: SupabaseClient;
  let storeId: string;
  let emptyStoreId: string;

  beforeAll(async () => {
    service = getServiceClient();
    anon = getAnonClient();
    [owner, manager, staff, nonMember] = await Promise.all([
      signInTestUser("owner-digest-owner@lastbite.test"),
      signInTestUser("owner-digest-manager@lastbite.test"),
      signInTestUser("owner-digest-staff@lastbite.test"),
      signInTestUser("owner-digest-nonmember@lastbite.test"),
    ]);

    const [ownerAuth, managerAuth, staffAuth] = await Promise.all([
      owner.auth.getUser(),
      manager.auth.getUser(),
      staff.auth.getUser(),
    ]);
    const ownerId = ownerAuth.data.user?.id;
    const managerId = managerAuth.data.user?.id;
    const staffId = staffAuth.data.user?.id;
    if (!ownerId || !managerId || !staffId) {
      throw new Error("could not resolve owner digest test users");
    }

    const stores = requireRows<{ id: string; name: string }[]>(
      await service
        .from("stores")
        .insert([
          {
            name: `Owner Digest Test ${runId}`,
            address: "13 Digest Road",
            latitude: 41.3,
            longitude: 69.2,
          },
          {
            name: `Empty Owner Digest Test ${runId}`,
            address: "14 Digest Road",
            latitude: 41.3,
            longitude: 69.2,
          },
        ])
        .select("id, name"),
      "create owner digest stores"
    );
    storeId = stores[0].id;
    emptyStoreId = stores[1].id;

    const membershipResult = await service.from("store_memberships").insert([
      { store_id: storeId, user_id: ownerId, role: "owner" },
      { store_id: storeId, user_id: managerId, role: "manager" },
      { store_id: storeId, user_id: staffId, role: "staff" },
      { store_id: emptyStoreId, user_id: ownerId, role: "owner" },
    ]);
    if (membershipResult.error) {
      throw new Error(`create owner digest memberships: ${membershipResult.error.message}`);
    }

    const productRows = Array.from({ length: 12 }, (_, index) => ({
      store_id: storeId,
      product_name: `Digest Risk ${String(index).padStart(2, "0")}`,
      on_hand_quantity: index + 1,
      confidence: "low",
      last_verified_at: null,
      expiry_date: utcDate(index % 4),
    }));
    const products = requireRows<{ id: string }[]>(
      await service.from("store_products").insert(productRows).select("id"),
      "create owner digest risk products"
    );

    const offers = requireRows<{ id: string }[]>(
      await service
        .from("offers_v2")
        .insert(
          Array.from({ length: 12 }, (_, index) => ({
            store_id: storeId,
            store_product_id: products[0].id,
            title: `Digest paused offer ${String(index).padStart(2, "0")}`,
            category: "test",
            image_url: null,
            contents: [],
            offer_price_uzs: 10000,
            reference_price_uzs: null,
            quantity_total: 1,
            quantity_available: 1,
            pickup_start: new Date(Date.now() + 3_600_000).toISOString(),
            pickup_end: new Date(Date.now() + 7_200_000).toISOString(),
            allergens: [],
            dietary_badges: [],
            status: "paused",
            physically_set_aside: true,
            publish_idempotency_key: `digest-${runId}-${index}`,
            approved_by: ownerId,
          }))
        )
        .select("id"),
      "create owner digest paused offers"
    );

    const exceptionResult = await service.from("store_exceptions").insert(
      Array.from({ length: 12 }, (_, index) => ({
        store_id: storeId,
        kind: "expiry_risk",
        message: `Digest exception ${String(index).padStart(2, "0")}`,
        status: "open",
        related_store_product_id: products[index].id,
      }))
    );
    if (exceptionResult.error) {
      throw new Error(`create owner digest exceptions: ${exceptionResult.error.message}`);
    }

    const countResult = await service.from("count_sessions").insert(
      [0, 0, -2, -8].map((offsetDays) => ({
        id: randomUUID(),
        store_id: storeId,
        created_by: staffId,
        line_fingerprint: "[]",
        created_at: new Date(Date.now() + offsetDays * 86_400_000).toISOString(),
      }))
    );
    if (countResult.error) {
      throw new Error(`create owner digest count sessions: ${countResult.error.message}`);
    }

    const recentStatuses = [
      "fulfilled",
      "fulfilled",
      "cancelled_by_seller",
      "expired_no_show",
      "expired_no_show",
      "failed_stock_mismatch",
      "failed_stock_mismatch",
      "failed_stock_mismatch",
    ];
    const reservationResult = await service.from("reservations_v2").insert([
      ...recentStatuses.map((status, index) => ({
        offer_id: offers[0].id,
        installation_id: `digest-installation-${runId}-${index}`,
        client_reservation_id: `digest-reservation-${runId}-${index}`,
        status,
        pickup_code_hash: `digest-hash-${runId}-${index}`,
        pickup_code_hint: String(index).padStart(2, "0"),
        hold_expires_at: new Date(Date.now() + 7_200_000).toISOString(),
        offer_snapshot: {},
        created_at: new Date().toISOString(),
      })),
      {
        offer_id: offers[0].id,
        installation_id: `digest-old-installation-${runId}`,
        client_reservation_id: `digest-old-reservation-${runId}`,
        status: "fulfilled",
        pickup_code_hash: `digest-old-hash-${runId}`,
        pickup_code_hint: "99",
        hold_expires_at: new Date(Date.now() - 8 * 86_400_000).toISOString(),
        offer_snapshot: {},
        created_at: new Date(Date.now() - 8 * 86_400_000).toISOString(),
      },
    ]);
    if (reservationResult.error) {
      throw new Error(`create owner digest reservations: ${reservationResult.error.message}`);
    }
  }, 120000);

  it("denies anon, staff, and non-members while allowing manager and owner", async () => {
    for (const deniedClient of [anon, staff, nonMember]) {
      const result = await deniedClient.rpc("compose_owner_digest_v2", {
        p_store_id: storeId,
      });
      expect(result.data).toBeNull();
      expect(result.error).not.toBeNull();
    }

    const [managerResult, ownerResult] = await Promise.all([
      manager.rpc("compose_owner_digest_v2", { p_store_id: storeId }),
      owner.rpc("compose_owner_digest_v2", { p_store_id: storeId }),
    ]);
    expect(managerResult.error).toBeNull();
    expect(ownerResult.error).toBeNull();
  });

  it("caps action lists and reports raw seven-day counts", async () => {
    const result = await owner.rpc("compose_owner_digest_v2", {
      p_store_id: storeId,
    });
    expect(result.error).toBeNull();
    const digest = result.data as DigestRow;

    expect(digest.staleVerification).toHaveLength(10);
    expect(digest.expiryRisk).toHaveLength(10);
    expect(digest.openExceptions).toHaveLength(10);
    expect(digest.pausedOffers).toHaveLength(10);
    expect(digest.countActivity7d).toEqual({
      daysWithCountSession: 2,
      days: 7,
    });
    expect(digest.offers7d).toEqual({
      published: 12,
      fulfilled: 2,
      cancelledBySeller: 1,
      expiredNoShow: 2,
      failedStockMismatch: 3,
    });
    expect(digest).not.toHaveProperty("mismatchRate");
    expect(digest).not.toHaveProperty("deadStock");
  });

  it("returns honest empty arrays and zeros for an empty store", async () => {
    const result = await owner.rpc("compose_owner_digest_v2", {
      p_store_id: emptyStoreId,
    });
    expect(result.error).toBeNull();
    expect(result.data).toMatchObject({
      staleVerification: [],
      expiryRisk: [],
      openExceptions: [],
      pausedOffers: [],
      countActivity7d: { daysWithCountSession: 0, days: 7 },
      offers7d: {
        published: 0,
        fulfilled: 0,
        cancelledBySeller: 0,
        expiredNoShow: 0,
        failedStockMismatch: 0,
      },
    });
  });
});

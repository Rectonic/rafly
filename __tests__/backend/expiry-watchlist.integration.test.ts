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
  console.log(`expiry-watchlist.integration.test.ts: ${backendSkipReason()}`);
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

function utcDateAt(offsetDays: number): string {
  const now = new Date();
  const utcMidnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + offsetDays
  );
  return new Date(utcMidnight).toISOString().slice(0, 10);
}

interface ExpiryWatchRow {
  store_product_id: string;
  product_name: string;
  expiry_date: string;
  days_to_expiry: number;
  on_hand_quantity: number;
  confidence: string;
  has_open_exceptions: boolean;
  active_offer_id: string | null;
}

d("list_expiry_watchlist_v2", () => {
  const runId = randomUUID();
  let service: SupabaseClient;
  let anon: SupabaseClient;
  let owner: SupabaseClient;
  let nonMember: SupabaseClient;
  let storeId: string;
  let boundaryProductId: string;
  let activeOfferId: string;

  beforeAll(async () => {
    service = getServiceClient();
    anon = getAnonClient();
    [owner, nonMember] = await Promise.all([
      signInTestUser("expiry-watch-owner@lastbite.test"),
      signInTestUser("expiry-watch-nonmember@lastbite.test"),
    ]);

    const { data: ownerUser } = await owner.auth.getUser();
    if (!ownerUser.user) {
      throw new Error("could not resolve the expiry watch owner");
    }

    const store = requireRow<{ id: string }>(
      await service
        .from("stores")
        .insert({
          name: `Expiry Watch Test ${runId}`,
          address: "14 Boundary Road",
          latitude: 41.3,
          longitude: 69.2,
        })
        .select("id")
        .single(),
      "create expiry watch store"
    );
    storeId = store.id;

    const { error: membershipError } = await service
      .from("store_memberships")
      .insert({ store_id: storeId, user_id: ownerUser.user.id, role: "owner" });
    if (membershipError) {
      throw new Error(`create expiry watch membership: ${membershipError.message}`);
    }

    const products = requireRow<{ id: string; product_name: string }[]>(
      await service
        .from("store_products")
        .insert([
          {
            store_id: storeId,
            product_name: `Expired ${runId}`,
            on_hand_quantity: 2,
            confidence: "high",
            expiry_date: utcDateAt(-1),
          },
          {
            store_id: storeId,
            product_name: `Today ${runId}`,
            on_hand_quantity: 3,
            confidence: "low",
            expiry_date: utcDateAt(0),
          },
          {
            store_id: storeId,
            product_name: `Boundary ${runId}`,
            on_hand_quantity: 8,
            confidence: "high",
            last_verified_at: new Date().toISOString(),
            expiry_date: utcDateAt(14),
          },
          {
            store_id: storeId,
            product_name: `Outside ${runId}`,
            on_hand_quantity: 4,
            confidence: "high",
            expiry_date: utcDateAt(15),
          },
          {
            store_id: storeId,
            product_name: `No date ${runId}`,
            on_hand_quantity: 5,
            confidence: "high",
            expiry_date: null,
          },
        ])
        .select("id, product_name"),
      "create expiry watch products"
    );
    boundaryProductId = products.find((row) => row.product_name.startsWith("Boundary"))?.id ?? "";
    if (!boundaryProductId) {
      throw new Error("boundary product was not returned");
    }

    const pickupStart = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const pickupEnd = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
    const offer = requireRow<{ id: string }>(
      await owner.rpc("publish_offer_v2", {
        p_store_id: storeId,
        p_idempotency_key: randomUUID(),
        p_input: {
          allocation: {
            storeProductId: boundaryProductId,
            quantity: 2,
            physicallySetAside: false,
          },
          title: "Boundary rescue offer",
          category: "test",
          imageUrl: null,
          contents: [],
          offerPriceUzs: 10000,
          referencePriceUzs: null,
          pickupStart,
          pickupEnd,
          allergens: [],
          dietaryBadges: [],
          pickupInstructions: null,
          cancellationPolicy: null,
        },
      }),
      "publish boundary offer"
    );
    activeOfferId = offer.id;
  });

  it("includes past dates through the 14-day boundary in urgency order", async () => {
    const { data, error } = await owner.rpc("list_expiry_watchlist_v2", {
      p_store_id: storeId,
    });

    expect(error).toBeNull();
    const rows = (data ?? []) as ExpiryWatchRow[];
    expect(rows.map((row) => row.days_to_expiry)).toEqual([-1, 0, 14]);
    expect(rows.map((row) => row.product_name)).toEqual([
      `Expired ${runId}`,
      `Today ${runId}`,
      `Boundary ${runId}`,
    ]);
    expect(rows[2]).toMatchObject({
      store_product_id: boundaryProductId,
      active_offer_id: activeOfferId,
    });
  });

  it("does not mutate an offer whose pickup window has already closed", async () => {
    const pickupStart = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const pickupEnd = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const offer = requireRow<{ id: string; status: string }>(
      await owner.rpc("publish_offer_v2", {
        p_store_id: storeId,
        p_idempotency_key: randomUUID(),
        p_input: {
          allocation: {
            storeProductId: boundaryProductId,
            quantity: 1,
            physicallySetAside: false,
          },
          title: "Read-only proof offer",
          category: "test",
          imageUrl: null,
          contents: [],
          offerPriceUzs: 10000,
          referencePriceUzs: null,
          pickupStart,
          pickupEnd,
          allergens: [],
          dietaryBadges: [],
          pickupInstructions: null,
          cancellationPolicy: null,
        },
      }),
      "publish read-only proof offer"
    );
    const pastStart = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const pastEnd = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { error: ageError } = await service
      .from("offers_v2")
      .update({ pickup_start: pastStart, pickup_end: pastEnd })
      .eq("id", offer.id);
    if (ageError) {
      throw new Error(`age read-only proof offer: ${ageError.message}`);
    }

    const { error } = await owner.rpc("list_expiry_watchlist_v2", {
      p_store_id: storeId,
    });
    expect(error).toBeNull();

    const after = requireRow<{ status: string }>(
      await service.from("offers_v2").select("status").eq("id", offer.id).single(),
      "read offer after expiry watchlist"
    );
    expect(after.status).toBe("live");
  });

  it("denies anon before the function body runs", async () => {
    const { data, error } = await anon.rpc("list_expiry_watchlist_v2", {
      p_store_id: storeId,
    });

    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  it("returns forbidden for an authenticated non-member", async () => {
    const { data, error } = await nonMember.rpc("list_expiry_watchlist_v2", {
      p_store_id: storeId,
    });

    expect(data).toBeNull();
    expect(error?.message).toMatch(/^forbidden:/);
  });
});

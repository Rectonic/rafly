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
  console.log(`reservation-concurrency.integration.test.ts: ${backendSkipReason()}`);
}

const d = backendEnvPresent() ? describe : describe.skip;
const RAW_DATABASE_ERROR = /duplicate key|violates|SQLSTATE|check constraint/i;

function hash(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

d("reservation concurrency", () => {
  const runId = randomUUID();
  let service: SupabaseClient;
  let anon: SupabaseClient;
  let owner: SupabaseClient;
  let storeId: string;

  beforeAll(async () => {
    service = getServiceClient();
    anon = getAnonClient();
    owner = await signInTestUser("backend-concurrency-owner@lastbite.test");
    const { data: userData } = await owner.auth.getUser();
    if (!userData.user) throw new Error("could not resolve concurrency owner");
    const store = await service
      .from("stores")
      .insert({ name: `Concurrency Store ${runId}`, address: "25 Race Lane" })
      .select("id")
      .single();
    if (store.error || !store.data) throw new Error(`create store: ${store.error?.message}`);
    storeId = store.data.id;
    const membership = await service.from("store_memberships").insert({
      store_id: storeId,
      user_id: userData.user.id,
      role: "owner",
    });
    if (membership.error) throw new Error(`create membership: ${membership.error.message}`);
  });

  async function publish(quantity: number, onHand = quantity): Promise<any> {
    const product = await service
      .from("store_products")
      .insert({
        store_id: storeId,
        product_name: `Concurrency Product ${randomUUID()}`,
        on_hand_quantity: onHand,
        confidence: "high",
        last_verified_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (product.error || !product.data) throw new Error(`create product: ${product.error?.message}`);
    const result = await owner.rpc("publish_offer_v2", {
      p_store_id: storeId,
      p_input: {
        allocation: {
          storeProductId: product.data.id,
          quantity,
          physicallySetAside: false,
        },
        title: "Race bag",
        category: "mixed",
        imageUrl: null,
        contents: ["surplus food"],
        offerPriceUzs: 10000,
        referencePriceUzs: 20000,
        pickupStart: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        pickupEnd: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
        allergens: [],
        dietaryBadges: [],
        pickupInstructions: null,
        cancellationPolicy: null,
      },
      p_idempotency_key: randomUUID(),
    });
    if (result.error || !result.data) throw new Error(`publish: ${result.error?.message}`);
    return { offer: result.data, productId: product.data.id };
  }

  function reserveCall(offerId: string, expectedVersion: number, clientId: string, installation: string) {
    const code = `LB-${clientId.slice(0, 8)}`;
    return anon.rpc("reserve_offer_v2", {
      p_offer_id: offerId,
      p_client_reservation_id: clientId,
      p_installation_id: installation,
      p_expected_offer_version: expectedVersion,
      p_pickup_code: code,
      p_pickup_code_hash: hash(code),
      p_pickup_code_hint: code.slice(-2),
    });
  }

  it("allows exactly three of 25 buyers to take three units and gives race losers sold_out", async () => {
    const { offer, productId } = await publish(3);
    const settled = await Promise.allSettled(
      Array.from({ length: 25 }, (_, index) =>
        reserveCall(offer.id, offer.version, `client-${index}-${randomUUID()}`, `install-${index}`)
      )
    );
    expect(settled.every((item) => item.status === "fulfilled")).toBe(true);
    const responses = settled.map((item) =>
      item.status === "fulfilled" ? item.value : { data: null, error: { message: String(item.reason) } }
    );
    expect(responses.filter((response) => response.error === null)).toHaveLength(3);
    const errors = responses.flatMap((response) => (response.error ? [response.error.message] : []));
    expect(errors).toHaveLength(22);
    expect(errors.every((message) => /^sold_out:/.test(message))).toBe(true);
    expect(errors.every((message) => !RAW_DATABASE_ERROR.test(message))).toBe(true);

    const offerRow = await service
      .from("offers_v2")
      .select("quantity_available, status")
      .eq("id", offer.id)
      .single();
    expect(offerRow.error).toBeNull();
    expect(offerRow.data).toEqual({ quantity_available: 0, status: "sold_out" });
    const reservations = await service
      .from("reservations_v2")
      .select("id")
      .eq("offer_id", offer.id)
      .eq("status", "held");
    expect(reservations.data).toHaveLength(3);
    const movements = await service
      .from("stock_movements")
      .select("id")
      .eq("store_product_id", productId)
      .eq("kind", "reservation_hold");
    expect(movements.data).toHaveLength(3);
  });

  it("serializes ten identical reserve requests into one reservation and clean replays", async () => {
    const { offer } = await publish(2);
    const clientId = `same-client-${randomUUID()}`;
    const installation = `same-install-${randomUUID()}`;
    const responses = await Promise.all(
      Array.from({ length: 10 }, () => reserveCall(offer.id, offer.version, clientId, installation))
    );
    expect(responses.every((response) => response.error === null)).toBe(true);
    expect(new Set(responses.map((response) => response.data.reservation.id)).size).toBe(1);
    expect(responses.filter((response) => response.data.replayed === false)).toHaveLength(1);
    expect(responses.filter((response) => response.data.replayed === true)).toHaveLength(9);
    expect(
      responses.every((response) => !response.error || !RAW_DATABASE_ERROR.test(response.error.message))
    ).toBe(true);
    const rows = await service
      .from("reservations_v2")
      .select("id")
      .eq("installation_id", installation)
      .eq("client_reservation_id", clientId);
    expect(rows.data).toHaveLength(1);
  });

  it("serializes duplicate fulfills into one stock movement without raw errors", async () => {
    const { offer, productId } = await publish(1);
    const clientId = randomUUID();
    const code = `LB-${clientId.slice(0, 8)}`;
    const reservation = await anon.rpc("reserve_offer_v2", {
      p_offer_id: offer.id,
      p_client_reservation_id: clientId,
      p_installation_id: randomUUID(),
      p_expected_offer_version: offer.version,
      p_pickup_code: code,
      p_pickup_code_hash: hash(code),
      p_pickup_code_hint: code.slice(-2),
    });
    expect(reservation.error).toBeNull();

    const key = randomUUID();
    const responses = await Promise.all([
      owner.rpc("fulfill_reservation_v2", {
        p_store_id: storeId,
        p_pickup_code: code,
        p_idempotency_key: key,
      }),
      owner.rpc("fulfill_reservation_v2", {
        p_store_id: storeId,
        p_pickup_code: code,
        p_idempotency_key: key,
      }),
    ]);
    expect(
      responses.every(
        (response) =>
          response.error === null || /^idempotency_conflict:/.test(response.error.message)
      )
    ).toBe(true);
    expect(responses.every((response) => !response.error || !RAW_DATABASE_ERROR.test(response.error.message))).toBe(true);
    const movements = await service
      .from("stock_movements")
      .select("id")
      .eq("store_product_id", productId)
      .eq("kind", "fulfillment");
    expect(movements.data).toHaveLength(1);
  });
});

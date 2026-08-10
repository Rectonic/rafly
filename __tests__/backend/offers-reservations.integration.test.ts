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
  console.log(`offers-reservations.integration.test.ts: ${backendSkipReason()}`);
}

const d = backendEnvPresent() ? describe : describe.skip;

const suiteBaseMs = Date.now();

const PUBLIC_COLUMNS = [
  "address",
  "allergens",
  "cancellation_policy",
  "category",
  "contents",
  "dietary_badges",
  "discount_percent",
  "id",
  "image_url",
  "last_verified_at",
  "latitude",
  "longitude",
  "offer_price_uzs",
  "pickup_end",
  "pickup_instructions",
  "pickup_start",
  "quantity_available",
  "reference_price_uzs",
  "status",
  "store_id",
  "store_name",
  "title",
  "version",
].sort();

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

// A calendar day in UTC, offset from now. store_products.expiry_date is a
// bare date, and the database compares it in UTC, so the test has to build
// its dates the same way rather than in the runner's local zone.
function utcDay(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString().slice(0, 10);
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

d("v2 offers, reservations, projection, and lifecycle RPCs", () => {
  const runId = randomUUID();
  const ownerEmail = "backend-offers-owner@lastbite.test";
  const managerEmail = "backend-offers-manager@lastbite.test";
  const staffEmail = "backend-offers-staff@lastbite.test";
  const otherOwnerEmail = "backend-offers-other-owner@lastbite.test";

  let service: SupabaseClient;
  let anon: SupabaseClient;
  let owner: SupabaseClient;
  let manager: SupabaseClient;
  let staff: SupabaseClient;
  let otherOwner: SupabaseClient;
  let storeId: string;
  let otherStoreId: string;

  beforeAll(async () => {
    service = getServiceClient();
    anon = getAnonClient();
    [owner, manager, staff, otherOwner] = await Promise.all([
      signInTestUser(ownerEmail),
      signInTestUser(managerEmail),
      signInTestUser(staffEmail),
      signInTestUser(otherOwnerEmail),
    ]);

    const users = await Promise.all([
      owner.auth.getUser(),
      manager.auth.getUser(),
      staff.auth.getUser(),
      otherOwner.auth.getUser(),
    ]);
    const userIds = users.map(({ data }) => data.user?.id);
    if (userIds.some((id) => !id)) throw new Error("failed to resolve test users");

    const first = requireRow<{ id: string }>(
      await service
        .from("stores")
        .insert({
          name: `Offers Test ${runId}`,
          address: "6 Market Street",
          latitude: 41.311,
          longitude: 69.279,
        })
        .select("id")
        .single(),
      "create primary store"
    );
    const second = requireRow<{ id: string }>(
      await service
        .from("stores")
        .insert({ name: `Other Offers Test ${runId}`, address: "Other street" })
        .select("id")
        .single(),
      "create secondary store"
    );
    storeId = first.id;
    otherStoreId = second.id;

    const { error } = await service.from("store_memberships").insert([
      { store_id: storeId, user_id: userIds[0], role: "owner" },
      { store_id: storeId, user_id: userIds[1], role: "manager" },
      { store_id: storeId, user_id: userIds[2], role: "staff" },
      { store_id: otherStoreId, user_id: userIds[3], role: "owner" },
    ]);
    if (error) throw new Error(`create memberships: ${error.message}`);
  });

  async function createProduct(
    overrides: Partial<{
      quantity: number;
      confidence: string;
      expiryDate: string | null;
    }> = {}
  ): Promise<{ id: string; on_hand_quantity: number }> {
    return requireRow(
      await service
        .from("store_products")
        .insert({
          store_id: storeId,
          product_name: `Offer Product ${randomUUID()}`,
          on_hand_quantity: overrides.quantity ?? 10,
          confidence: overrides.confidence ?? "high",
          last_verified_at: new Date().toISOString(),
          expiry_date: overrides.expiryDate === undefined ? null : overrides.expiryDate,
        })
        .select("id, on_hand_quantity")
        .single(),
      "create product"
    );
  }

  function offerInput(
    productId: string,
    overrides: Record<string, unknown> = {}
  ): Record<string, unknown> {
    const start = new Date(suiteBaseMs + 60 * 60 * 1000);
    const end = new Date(suiteBaseMs + 3 * 60 * 60 * 1000);
    return {
      allocation: {
        storeProductId: productId,
        quantity: 3,
        physicallySetAside: false,
      },
      title: "Evening rescue bag",
      category: "bakery",
      imageUrl: "https://example.test/bag.jpg",
      contents: ["bread", "pastry"],
      offerPriceUzs: 20000,
      referencePriceUzs: 40000,
      pickupStart: start.toISOString(),
      pickupEnd: end.toISOString(),
      allergens: ["gluten"],
      dietaryBadges: ["vegetarian"],
      pickupInstructions: "Ask at the counter",
      cancellationPolicy: "Cancel before pickup",
      ...overrides,
    };
  }

  async function publish(
    client: SupabaseClient,
    productId: string,
    overrides: Record<string, unknown> = {},
    key = randomUUID()
  ): Promise<any> {
    const result = await client.rpc("publish_offer_v2", {
      p_store_id: storeId,
      p_input: offerInput(productId, overrides),
      p_idempotency_key: key,
    });
    return requireRow(result, "publish offer");
  }

  async function reserve(
    offerId: string,
    version: number,
    installationId: string = `installation-${randomUUID()}`,
    clientReservationId: string = randomUUID(),
    pickupCode: string = `LB-${randomUUID().slice(0, 8)}`
  ): Promise<any> {
    const result = await anon.rpc("reserve_offer_v2", {
      p_offer_id: offerId,
      p_client_reservation_id: clientReservationId,
      p_installation_id: installationId,
      p_expected_offer_version: version,
      p_pickup_code: pickupCode,
      p_pickup_code_hash: sha256(pickupCode),
      p_pickup_code_hint: pickupCode.slice(-2),
    });
    return requireRow(result, "reserve offer");
  }

  it("publishes within allocation rules, replays safely, and rejects invalid publication", async () => {
    const product = await createProduct({ quantity: 4 });
    const key = randomUUID();
    const first = await publish(owner, product.id, {}, key);
    const replay = await publish(owner, product.id, {}, key);
    expect(replay.id).toBe(first.id);

    const conflict = await owner.rpc("publish_offer_v2", {
      p_store_id: storeId,
      p_input: offerInput(product.id, { title: "Changed material input" }),
      p_idempotency_key: key,
    });
    expect(conflict.error?.message).toMatch(/^idempotency_conflict:/);

    const staffAttempt = await staff.rpc("publish_offer_v2", {
      p_store_id: storeId,
      p_input: offerInput(product.id, {
        allocation: { storeProductId: product.id, quantity: 1, physicallySetAside: false },
      }),
      p_idempotency_key: randomUUID(),
    });
    expect(staffAttempt.error?.message).toMatch(/^forbidden:/);

    const overAllocated = await owner.rpc("publish_offer_v2", {
      p_store_id: storeId,
      p_input: offerInput(product.id, {
        allocation: { storeProductId: product.id, quantity: 2, physicallySetAside: false },
      }),
      p_idempotency_key: randomUUID(),
    });
    expect(overAllocated.error?.message).toMatch(/^allocation_exceeded:/);

    const low = await createProduct({ quantity: 10, confidence: "low" });
    const notSetAside = await owner.rpc("publish_offer_v2", {
      p_store_id: storeId,
      p_input: offerInput(low.id, {
        allocation: { storeProductId: low.id, quantity: 1, physicallySetAside: false },
      }),
      p_idempotency_key: randomUUID(),
    });
    expect(notSetAside.error?.message).toMatch(/^allocation_exceeded:/);
    await publish(owner, low.id, {
      allocation: { storeProductId: low.id, quantity: 2, physicallySetAside: true },
    });

    const badReference = await owner.rpc("publish_offer_v2", {
      p_store_id: storeId,
      p_input: offerInput(low.id, {
        allocation: { storeProductId: low.id, quantity: 1, physicallySetAside: true },
        offerPriceUzs: 30000,
        referencePriceUzs: 20000,
      }),
      p_idempotency_key: randomUUID(),
    });
    expect(badReference.error?.message).toMatch(/^validation_failed:/);

    const yesterday = utcDay(-24 * 60 * 60 * 1000);
    const expired = await createProduct({ expiryDate: yesterday });
    const expiredAttempt = await owner.rpc("publish_offer_v2", {
      p_store_id: storeId,
      p_input: offerInput(expired.id, {
        allocation: { storeProductId: expired.id, quantity: 1, physicallySetAside: false },
      }),
      p_idempotency_key: randomUUID(),
    });
    expect(expiredAttempt.error?.message).toMatch(/^validation_failed:/);
  });

  it("refuses a product that expires before the pickup window ends", async () => {
    // Food safety. The expiry test is against the end of the pickup window,
    // not against today, so a product that goes off while buyers can still
    // collect it never reaches the feed. This product is fine right now and
    // still gets rejected, because the window runs past its expiry date.
    const tomorrowStart = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const tomorrowEnd = new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString();
    const expiringToday = await createProduct({ expiryDate: utcDay(0) });
    const expiresMidWindow = await owner.rpc("publish_offer_v2", {
      p_store_id: storeId,
      p_input: offerInput(expiringToday.id, {
        allocation: {
          storeProductId: expiringToday.id,
          quantity: 1,
          physicallySetAside: false,
        },
        pickupStart: tomorrowStart,
        pickupEnd: tomorrowEnd,
      }),
      p_idempotency_key: randomUUID(),
    });
    expect(expiresMidWindow.error?.message).toMatch(/^validation_failed:/);

    const expiringLater = await createProduct({
      expiryDate: utcDay(5 * 24 * 60 * 60 * 1000),
    });
    const outlastsWindow = await publish(owner, expiringLater.id, {
      allocation: { storeProductId: expiringLater.id, quantity: 1, physicallySetAside: false },
      pickupStart: tomorrowStart,
      pickupEnd: tomorrowEnd,
    });
    expect(outlastsWindow.status).toBe("live");
  });

  it("exposes the exact redacted public projection while base tables remain private", async () => {
    const product = await createProduct();
    const offer = await publish(owner, product.id);
    const publicResult = await anon
      .from("marketplace_offers_v2_public")
      .select("*")
      .eq("id", offer.id)
      .single();
    const row = requireRow<Record<string, unknown>>(publicResult, "read public offer");
    expect(Object.keys(row).sort()).toEqual(PUBLIC_COLUMNS);
    expect(row).toMatchObject({
      store_id: storeId,
      store_name: `Offers Test ${runId}`,
      address: "6 Market Street",
      discount_percent: 50,
    });

    expect((await anon.from("offers_v2").select("*")).error).not.toBeNull();
    expect((await anon.from("reservations_v2").select("*")).error).not.toBeNull();

    const memberRows = await staff.from("offers_v2").select("id").eq("id", offer.id);
    expect(memberRows.error).toBeNull();
    expect(memberRows.data).toHaveLength(1);
    const otherRows = await otherOwner.from("offers_v2").select("id").eq("id", offer.id);
    expect(otherRows.error).toBeNull();
    expect(otherRows.data).toHaveLength(0);

    const pastStart = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const pastEnd = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    await service
      .from("offers_v2")
      .update({ pickup_start: pastStart, pickup_end: pastEnd })
      .eq("id", offer.id);
    const hidden = await anon.from("marketplace_offers_v2_public").select("id").eq("id", offer.id);
    expect(hidden.error).toBeNull();
    expect(hidden.data).toHaveLength(0);
  });

  it("reserves atomically, validates hashes, diagnoses failures, and scopes replay by installation", async () => {
    const missingCode = "LB-missing-00";
    const missing = await anon.rpc("reserve_offer_v2", {
      p_offer_id: randomUUID(),
      p_client_reservation_id: randomUUID(),
      p_installation_id: `installation-${randomUUID()}`,
      p_expected_offer_version: 1,
      p_pickup_code: missingCode,
      p_pickup_code_hash: sha256(missingCode),
      p_pickup_code_hint: "00",
    });
    expect(missing.error?.message).toMatch(/^not_found:/);

    const pausedProduct = await createProduct();
    const pausedOffer = await publish(owner, pausedProduct.id, {
      allocation: { storeProductId: pausedProduct.id, quantity: 1, physicallySetAside: false },
    });
    await service.from("offers_v2").update({ status: "paused" }).eq("id", pausedOffer.id);
    const pausedCode = "LB-paused-11";
    const notLive = await anon.rpc("reserve_offer_v2", {
      p_offer_id: pausedOffer.id,
      p_client_reservation_id: randomUUID(),
      p_installation_id: `installation-${randomUUID()}`,
      p_expected_offer_version: pausedOffer.version,
      p_pickup_code: pausedCode,
      p_pickup_code_hash: sha256(pausedCode),
      p_pickup_code_hint: "11",
    });
    expect(notLive.error?.message).toMatch(/^offer_not_live:/);

    const staleProduct = await createProduct();
    const staleOffer = await publish(owner, staleProduct.id, {
      allocation: { storeProductId: staleProduct.id, quantity: 1, physicallySetAside: false },
    });
    await service.from("offers_v2").update({ version: 9 }).eq("id", staleOffer.id);
    const staleCode = "LB-stale-22";
    const stale = await anon.rpc("reserve_offer_v2", {
      p_offer_id: staleOffer.id,
      p_client_reservation_id: randomUUID(),
      p_installation_id: `installation-${randomUUID()}`,
      p_expected_offer_version: staleOffer.version,
      p_pickup_code: staleCode,
      p_pickup_code_hash: sha256(staleCode),
      p_pickup_code_hint: "22",
    });
    expect(stale.error?.message).toMatch(/^version_conflict:/);

    const product = await createProduct();
    const offer = await publish(owner, product.id, {
      allocation: { storeProductId: product.id, quantity: 2, physicallySetAside: false },
    });
    const installation = `installation-${randomUUID()}`;
    const clientId = "shared-client-id";
    const code = "LB-1299";
    const first = await reserve(offer.id, offer.version, installation, clientId, code);
    expect(first).toMatchObject({ replayed: false, pickup_code: code });
    expect(first.reservation).toMatchObject({ status: "held", pickup_code_hint: "99" });

    const replay = await reserve(offer.id, offer.version, installation, clientId, code);
    expect(replay.replayed).toBe(true);
    expect(replay.pickup_code).toBeNull();
    expect(replay.reservation.id).toBe(first.reservation.id);

    const otherInstallation = await reserve(
      offer.id,
      offer.version + 1,
      `installation-${randomUUID()}`,
      clientId,
      "LB-5511"
    );
    expect(otherInstallation.reservation.id).not.toBe(first.reservation.id);

    const stored = requireRow<{ pickup_code_hash: string; pickup_code_hint: string }>(
      await service
        .from("reservations_v2")
        .select("pickup_code_hash, pickup_code_hint")
        .eq("id", first.reservation.id)
        .single(),
      "read stored code"
    );
    expect(stored).toEqual({ pickup_code_hash: sha256(code), pickup_code_hint: "99" });
    expect(JSON.stringify(stored)).not.toContain(code);

    const badHash = await anon.rpc("reserve_offer_v2", {
      p_offer_id: offer.id,
      p_client_reservation_id: randomUUID(),
      p_installation_id: `installation-${randomUUID()}`,
      p_expected_offer_version: offer.version + 2,
      p_pickup_code: "LB-bad",
      p_pickup_code_hash: "not-the-hash",
      p_pickup_code_hint: "ad",
    });
    expect(badHash.error?.message).toMatch(/^validation_failed:/);

    const soldOut = await anon.rpc("reserve_offer_v2", {
      p_offer_id: offer.id,
      p_client_reservation_id: randomUUID(),
      p_installation_id: `installation-${randomUUID()}`,
      p_expected_offer_version: offer.version,
      p_pickup_code: "LB-out",
      p_pickup_code_hash: sha256("LB-out"),
      p_pickup_code_hint: "ut",
    });
    expect(soldOut.error?.message).toMatch(/^sold_out:/);

    const movements = await service
      .from("stock_movements")
      .select("id")
      .eq("store_product_id", product.id)
      .eq("kind", "reservation_hold");
    expect(movements.error).toBeNull();
    expect(movements.data).toHaveLength(2);
  });

  it("cancels only for the owning installation, releases one unit, and replays idempotently", async () => {
    const product = await createProduct();
    const offer = await publish(owner, product.id, {
      allocation: { storeProductId: product.id, quantity: 1, physicallySetAside: false },
    });
    const installation = `installation-${randomUUID()}`;
    const held = await reserve(offer.id, offer.version, installation);

    const forbidden = await anon.rpc("cancel_reservation_v2", {
      p_reservation_id: held.reservation.id,
      p_installation_id: "another-installation",
      p_idempotency_key: randomUUID(),
    });
    expect(forbidden.error?.message).toMatch(/^forbidden:/);

    const key = randomUUID();
    const first = await anon.rpc("cancel_reservation_v2", {
      p_reservation_id: held.reservation.id,
      p_installation_id: installation,
      p_idempotency_key: key,
    });
    expect(first.error).toBeNull();
    expect(first.data.status).toBe("cancelled_by_buyer");
    const replay = await anon.rpc("cancel_reservation_v2", {
      p_reservation_id: held.reservation.id,
      p_installation_id: installation,
      p_idempotency_key: key,
    });
    expect(replay.error).toBeNull();
    expect(replay.data).toEqual(first.data);

    const keyConflict = await anon.rpc("cancel_reservation_v2", {
      p_reservation_id: randomUUID(),
      p_installation_id: installation,
      p_idempotency_key: key,
    });
    expect(keyConflict.error?.message).toMatch(/^idempotency_conflict:/);

    const terminal = await anon.rpc("cancel_reservation_v2", {
      p_reservation_id: held.reservation.id,
      p_installation_id: installation,
      p_idempotency_key: randomUUID(),
    });
    expect(terminal.error?.message).toMatch(/^invalid_state:/);

    const reloaded = requireRow<{ quantity_available: number; status: string }>(
      await service
        .from("offers_v2")
        .select("quantity_available, status")
        .eq("id", offer.id)
        .single(),
      "reload released offer"
    );
    expect(reloaded).toEqual({ quantity_available: 1, status: "live" });
  });

  it("replays a reserve as the current reservation row, so a cancelled hold replays cancelled", async () => {
    const product = await createProduct();
    const offer = await publish(owner, product.id, {
      allocation: { storeProductId: product.id, quantity: 2, physicallySetAside: false },
    });
    const installation = `installation-${randomUUID()}`;
    const clientReservationId = randomUUID();
    const code = `LB-${randomUUID().slice(0, 8)}`;
    const held = await reserve(
      offer.id,
      offer.version,
      installation,
      clientReservationId,
      code
    );
    expect(held.reservation.status).toBe("held");

    await anon.rpc("cancel_reservation_v2", {
      p_reservation_id: held.reservation.id,
      p_installation_id: installation,
      p_idempotency_key: randomUUID(),
    });

    const replay = await reserve(
      offer.id,
      offer.version,
      installation,
      clientReservationId,
      code
    );

    // A replay reports the row as it stands now, not the snapshot taken when
    // the reservation was created. A client that never cleaned up its pending
    // clientReservationId has to be able to see that the attempt behind it is
    // finished, otherwise it shows a cancelled reservation as a live hold.
    expect(replay.replayed).toBe(true);
    expect(replay.reservation.id).toBe(held.reservation.id);
    expect(replay.reservation.status).toBe("cancelled_by_buyer");
    expect(replay.reservation.version).toBeGreaterThan(held.reservation.version);
    // The raw code is issued exactly once, and never again.
    expect(replay.pickup_code).toBeNull();
    expect(JSON.stringify(replay)).not.toContain(code);

    // Replaying is a read. It must not take a second unit off the offer.
    const reloaded = requireRow<{ quantity_available: number }>(
      await service
        .from("offers_v2")
        .select("quantity_available")
        .eq("id", offer.id)
        .single(),
      "reload offer after replay"
    );
    expect(reloaded.quantity_available).toBe(2);
  });

  it("replays a lapsed hold as expired_no_show and caps the unit it releases", async () => {
    // A hold that lapsed while the client was away replays as
    // expired_no_show, never as a stale held. That only holds if the expiry
    // sweep runs before the replay lookup rather than after it.
    const lapsedProduct = await createProduct();
    const lapsedOffer = await publish(owner, lapsedProduct.id, {
      allocation: { storeProductId: lapsedProduct.id, quantity: 1, physicallySetAside: false },
    });
    const lapsedInstallation = `installation-${randomUUID()}`;
    const lapsedClientId = randomUUID();
    const lapsedCode = `LB-${randomUUID().slice(0, 8)}`;
    const lapsed = await reserve(
      lapsedOffer.id,
      lapsedOffer.version,
      lapsedInstallation,
      lapsedClientId,
      lapsedCode
    );
    expect(lapsed.reservation.status).toBe("held");
    await service
      .from("reservations_v2")
      .update({ hold_expires_at: new Date(Date.now() - 60 * 1000).toISOString() })
      .eq("id", lapsed.reservation.id);
    // Drift the count back up to the total first. The sweep releases the
    // lapsed unit on top of that, and the release is capped so the offer
    // can never advertise more units than it was published with.
    await service
      .from("offers_v2")
      .update({ quantity_available: 1 })
      .eq("id", lapsedOffer.id);

    const lapsedReplay = await reserve(
      lapsedOffer.id,
      lapsedOffer.version,
      lapsedInstallation,
      lapsedClientId,
      lapsedCode
    );
    expect(lapsedReplay.replayed).toBe(true);
    expect(lapsedReplay.reservation.id).toBe(lapsed.reservation.id);
    expect(lapsedReplay.reservation.status).toBe("expired_no_show");
    expect(lapsedReplay.pickup_code).toBeNull();

    const capped = requireRow<{ quantity_available: number; quantity_total: number }>(
      await service
        .from("offers_v2")
        .select("quantity_available, quantity_total")
        .eq("id", lapsedOffer.id)
        .single(),
      "reload offer after lapsed replay"
    );
    expect(capped).toEqual({ quantity_available: 1, quantity_total: 1 });
  });

  it("accepts every offer version reservation traffic explains and rejects the rest", async () => {
    const product = await createProduct({ quantity: 6 });
    const offer = await publish(owner, product.id, {
      allocation: { storeProductId: product.id, quantity: 3, physicallySetAside: false },
    });
    expect(offer.version).toBe(1);

    const installation = `monotonic-${randomUUID()}`;
    const held = await reserve(offer.id, offer.version, installation);
    const cancelled = await anon.rpc("cancel_reservation_v2", {
      p_reservation_id: held.reservation.id,
      p_installation_id: installation,
      p_idempotency_key: randomUUID(),
    });
    expect(cancelled.error).toBeNull();

    const afterCancel = requireRow<{ version: number }>(
      await service.from("offers_v2").select("version").eq("id", offer.id).single(),
      "reload offer after cancel"
    );
    expect(afterCancel.version).toBe(3);

    // Version 2 sits between the published version and the current one. The
    // old rule accepted only those two exact numbers and rejected everything
    // in between, which meant a fresher client could be turned away while a
    // staler one was let through. Both bumps here came from a hold and its
    // release, neither of which changes the terms the buyer agreed to, so
    // the caller is stale in a way that does not matter.
    const intermediate = await reserve(offer.id, 2, `monotonic-mid-${randomUUID()}`);
    expect(intermediate.replayed).toBe(false);
    expect(intermediate.reservation.status).toBe("held");

    // A version the offer has never carried is not a stale read, it is a
    // client reporting something that never happened.
    const aheadCode = "LB-ahead-77";
    const ahead = await anon.rpc("reserve_offer_v2", {
      p_offer_id: offer.id,
      p_client_reservation_id: randomUUID(),
      p_installation_id: `monotonic-ahead-${randomUUID()}`,
      p_expected_offer_version: 9,
      p_pickup_code: aheadCode,
      p_pickup_code_hash: sha256(aheadCode),
      p_pickup_code_hint: "77",
    });
    expect(ahead.error?.message).toMatch(/^version_conflict:/);

    // A seller side bump leaves no reservation movement behind, so it can
    // never be explained away and a caller from before it is rejected.
    const pausedProduct = await createProduct({ quantity: 2 });
    const pausedOffer = await publish(owner, pausedProduct.id, {
      allocation: { storeProductId: pausedProduct.id, quantity: 2, physicallySetAside: false },
    });
    const pause = await owner.rpc("pause_offer_v2", {
      p_store_id: storeId,
      p_offer_id: pausedOffer.id,
      p_idempotency_key: randomUUID(),
      p_expected_version: pausedOffer.version,
    });
    expect(pause.error).toBeNull();
    // Put it back on sale without touching the version, the way a resume
    // would, so the reserve below is judged on the version rule and not on
    // the paused status.
    await service.from("offers_v2").update({ status: "live" }).eq("id", pausedOffer.id);

    const prePauseCode = "LB-prepause-88";
    const prePause = await anon.rpc("reserve_offer_v2", {
      p_offer_id: pausedOffer.id,
      p_client_reservation_id: randomUUID(),
      p_installation_id: `monotonic-prepause-${randomUUID()}`,
      p_expected_offer_version: pausedOffer.version,
      p_pickup_code: prePauseCode,
      p_pickup_code_hash: sha256(prePauseCode),
      p_pickup_code_hint: "88",
    });
    expect(prePause.error?.message).toMatch(/^version_conflict:/);

    // Every rejection above rolled back, so no unit was quietly taken.
    const untouched = requireRow<{ quantity_available: number }>(
      await service
        .from("offers_v2")
        .select("quantity_available")
        .eq("id", pausedOffer.id)
        .single(),
      "reload offer after rejected reserve"
    );
    expect(untouched.quantity_available).toBe(2);
  });

  it("refuses anon callers on every seller RPC and keeps internal tables unreadable", async () => {
    const product = await createProduct();
    const offer = await publish(owner, product.id, {
      allocation: { storeProductId: product.id, quantity: 1, physicallySetAside: false },
    });

    const sellerCalls: [string, Record<string, unknown>][] = [
      [
        "publish_offer_v2",
        {
          p_store_id: storeId,
          p_input: offerInput(product.id, {
            allocation: { storeProductId: product.id, quantity: 1, physicallySetAside: false },
          }),
          p_idempotency_key: randomUUID(),
        },
      ],
      [
        "pause_offer_v2",
        {
          p_store_id: storeId,
          p_offer_id: offer.id,
          p_idempotency_key: randomUUID(),
          p_expected_version: offer.version,
        },
      ],
      [
        "fulfill_reservation_v2",
        { p_store_id: storeId, p_pickup_code: "LB-anon-99", p_idempotency_key: randomUUID() },
      ],
      [
        "report_stock_mismatch_v2",
        {
          p_store_id: storeId,
          p_offer_id: offer.id,
          p_observed_quantity: 0,
          p_reason: "anon probe",
          p_idempotency_key: randomUUID(),
        },
      ],
      ["list_seller_pickups_v2", { p_store_id: storeId }],
    ];

    for (const [name, args] of sellerCalls) {
      const result = await anon.rpc(name, args);
      // Refused at the grant, before any body runs. The label keeps a
      // failure readable, otherwise the assertion says only that some call
      // in the list came back clean.
      expect(`${name}:${result.error === null}`).toBe(`${name}:false`);
      expect(result.data).toBeNull();
    }

    // The offer the probes named is exactly where it was.
    const untouched = requireRow<{ status: string; version: number }>(
      await service.from("offers_v2").select("status, version").eq("id", offer.id).single(),
      "reload offer after anon probes"
    );
    expect(untouched).toEqual({ status: "live", version: offer.version });
  });

  it("keeps store exceptions and buyer idempotency keys unreadable by any client", async () => {
    // store_exceptions and buyer_idempotency_keys carry seller incident
    // detail and buyer command history. Neither anon nor a signed in member
    // of the store may read a single row of either.
    const readers: [string, SupabaseClient][] = [
      ["anon", anon],
      ["staff", staff],
      ["owner", owner],
    ];
    for (const table of ["store_exceptions", "buyer_idempotency_keys"]) {
      for (const [label, client] of readers) {
        const result = await client.from(table).select("*");
        const rows = result.data ?? [];
        expect(`${label}:${table}:${result.error !== null || rows.length === 0}`).toBe(
          `${label}:${table}:true`
        );
        expect(rows).toHaveLength(0);
      }
    }
  });

  it("checks pause version before status and fingerprints idempotency keys", async () => {
    const product = await createProduct();
    const offer = await publish(manager, product.id);

    const beforePause = requireRow<{ status: string }>(
      await service
        .from("offer_allocations")
        .select("status")
        .eq("offer_id", offer.id)
        .single(),
      "read allocation before pause"
    );
    expect(beforePause.status).toBe("active");

    const key = randomUUID();
    const paused = await manager.rpc("pause_offer_v2", {
      p_store_id: storeId,
      p_offer_id: offer.id,
      p_idempotency_key: key,
      p_expected_version: offer.version,
    });
    expect(paused.error).toBeNull();
    expect(paused.data.status).toBe("paused");

    // A paused offer is out of the pool, so it stops encumbering its
    // product. An allocation row left active forever would keep the stock
    // reserved against an offer nobody can buy.
    const afterPause = requireRow<{ status: string }>(
      await service
        .from("offer_allocations")
        .select("status")
        .eq("offer_id", offer.id)
        .single(),
      "read allocation after pause"
    );
    expect(afterPause.status).toBe("released");

    const replay = await manager.rpc("pause_offer_v2", {
      p_store_id: storeId,
      p_offer_id: offer.id,
      p_idempotency_key: key,
      p_expected_version: 999,
    });
    expect(replay.error).toBeNull();
    expect(replay.data.id).toBe(offer.id);

    const other = await publish(manager, product.id, {
      allocation: { storeProductId: product.id, quantity: 1, physicallySetAside: false },
    });
    const conflict = await manager.rpc("pause_offer_v2", {
      p_store_id: storeId,
      p_offer_id: other.id,
      p_idempotency_key: key,
      p_expected_version: other.version,
    });
    expect(conflict.error?.message).toMatch(/^idempotency_conflict:/);

    const stale = await manager.rpc("pause_offer_v2", {
      p_store_id: storeId,
      p_offer_id: offer.id,
      p_idempotency_key: randomUUID(),
      p_expected_version: offer.version,
    });
    expect(stale.error?.message).toMatch(/^version_conflict:/);
  });

  it("fulfills once, forbids staff and cross-store codes, and guards stock from going negative", async () => {
    const product = await createProduct({ quantity: 2 });
    const offer = await publish(owner, product.id, {
      allocation: { storeProductId: product.id, quantity: 1, physicallySetAside: false },
    });
    const code = "LB-fulfill-77";
    await reserve(offer.id, offer.version, `installation-${randomUUID()}`, randomUUID(), code);

    const staffAttempt = await staff.rpc("fulfill_reservation_v2", {
      p_store_id: storeId,
      p_pickup_code: code,
      p_idempotency_key: randomUUID(),
    });
    expect(staffAttempt.error?.message).toMatch(/^forbidden:/);
    const crossStore = await otherOwner.rpc("fulfill_reservation_v2", {
      p_store_id: otherStoreId,
      p_pickup_code: code,
      p_idempotency_key: randomUUID(),
    });
    expect(crossStore.error?.message).toMatch(/^not_found:/);

    const key = randomUUID();
    const first = await manager.rpc("fulfill_reservation_v2", {
      p_store_id: storeId,
      p_pickup_code: code,
      p_idempotency_key: key,
    });
    expect(first.error).toBeNull();
    expect(first.data.status).toBe("fulfilled");
    const replay = await manager.rpc("fulfill_reservation_v2", {
      p_store_id: storeId,
      p_pickup_code: code,
      p_idempotency_key: key,
    });
    expect(replay.error).toBeNull();
    expect(replay.data).toEqual(first.data);
    const keyConflict = await manager.rpc("fulfill_reservation_v2", {
      p_store_id: storeId,
      p_pickup_code: "LB-a-different-code",
      p_idempotency_key: key,
    });
    expect(keyConflict.error?.message).toMatch(/^idempotency_conflict:/);

    const reloaded = requireRow<{ on_hand_quantity: number }>(
      await service.from("store_products").select("on_hand_quantity").eq("id", product.id).single(),
      "reload fulfilled product"
    );
    expect(reloaded.on_hand_quantity).toBe(1);
    const movements = await service
      .from("stock_movements")
      .select("id")
      .eq("store_product_id", product.id)
      .eq("kind", "fulfillment");
    expect(movements.data).toHaveLength(1);

    const collisionCode = "LB-collision-66";
    const activeProduct = await createProduct({ quantity: 1 });
    const activeOffer = await publish(owner, activeProduct.id, {
      allocation: { storeProductId: activeProduct.id, quantity: 1, physicallySetAside: false },
    });
    const activeReservation = await reserve(
      activeOffer.id,
      activeOffer.version,
      `collision-active-${randomUUID()}`,
      randomUUID(),
      collisionCode
    );
    const expiredProduct = await createProduct({ quantity: 1 });
    const expiredOffer = await publish(owner, expiredProduct.id, {
      allocation: { storeProductId: expiredProduct.id, quantity: 1, physicallySetAside: false },
    });
    const expiredReservation = await reserve(
      expiredOffer.id,
      expiredOffer.version,
      `collision-expired-${randomUUID()}`,
      randomUUID(),
      collisionCode
    );
    await service
      .from("reservations_v2")
      .update({ hold_expires_at: new Date(Date.now() - 60 * 1000).toISOString() })
      .eq("id", expiredReservation.reservation.id);
    const collisionFulfill = await owner.rpc("fulfill_reservation_v2", {
      p_store_id: storeId,
      p_pickup_code: collisionCode,
      p_idempotency_key: randomUUID(),
    });
    expect(collisionFulfill.error).toBeNull();
    expect(collisionFulfill.data.reservation_id).toBe(activeReservation.reservation.id);

    const emptyProduct = await createProduct({ quantity: 1 });
    const emptyOffer = await publish(owner, emptyProduct.id, {
      allocation: { storeProductId: emptyProduct.id, quantity: 1, physicallySetAside: false },
    });
    const emptyCode = "LB-empty-88";
    await reserve(emptyOffer.id, emptyOffer.version, undefined, undefined, emptyCode);
    await service.from("store_products").update({ on_hand_quantity: 0 }).eq("id", emptyProduct.id);
    const guarded = await owner.rpc("fulfill_reservation_v2", {
      p_store_id: storeId,
      p_pickup_code: emptyCode,
      p_idempotency_key: randomUUID(),
    });
    expect(guarded.error?.message).toMatch(/^validation_failed:/);
  });

  it("fails all held reservations on mismatch and preserves their allocation while the exception is open", async () => {
    const product = await createProduct({ quantity: 3 });
    const offer = await publish(owner, product.id);
    await reserve(offer.id, offer.version, "mismatch-installation-a", randomUUID(), "LB-mm-a1");
    await reserve(offer.id, offer.version + 1, "mismatch-installation-b", randomUUID(), "LB-mm-b2");

    const key = randomUUID();
    const mismatch = await manager.rpc("report_stock_mismatch_v2", {
      p_store_id: storeId,
      p_offer_id: offer.id,
      p_observed_quantity: 1,
      p_reason: "two bags could not be found",
      p_idempotency_key: key,
    });
    expect(mismatch.error).toBeNull();
    expect(mismatch.data.offer.status).toBe("paused");
    expect(mismatch.data.exception).toMatchObject({ kind: "stock_mismatch", status: "open" });

    const heldRows = await service
      .from("reservations_v2")
      .select("status")
      .eq("offer_id", offer.id);
    expect(heldRows.data).toHaveLength(2);
    expect(heldRows.data?.every((row) => row.status === "failed_stock_mismatch")).toBe(true);

    const replay = await manager.rpc("report_stock_mismatch_v2", {
      p_store_id: storeId,
      p_offer_id: offer.id,
      p_observed_quantity: 1,
      p_reason: "two bags could not be found",
      p_idempotency_key: key,
    });
    expect(replay.error).toBeNull();
    expect(replay.data.exception.id).toBe(mismatch.data.exception.id);
    const keyConflict = await manager.rpc("report_stock_mismatch_v2", {
      p_store_id: storeId,
      p_offer_id: offer.id,
      p_observed_quantity: 1,
      p_reason: "a different reason",
      p_idempotency_key: key,
    });
    expect(keyConflict.error?.message).toMatch(/^idempotency_conflict:/);

    // A mismatch pauses the offer, so its allocation is released with it.
    const mismatchAllocation = requireRow<{ status: string }>(
      await service
        .from("offer_allocations")
        .select("status")
        .eq("offer_id", offer.id)
        .single(),
      "read allocation after mismatch"
    );
    expect(mismatchAllocation.status).toBe("released");

    const overPublish = await owner.rpc("publish_offer_v2", {
      p_store_id: storeId,
      p_input: offerInput(product.id, {
        allocation: { storeProductId: product.id, quantity: 1, physicallySetAside: false },
      }),
      p_idempotency_key: randomUUID(),
    });
    expect(overPublish.error?.message).toMatch(/^allocation_exceeded:/);

    const pastStart = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const pastEnd = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    await service
      .from("offers_v2")
      .update({ pickup_start: pastStart, pickup_end: pastEnd })
      .eq("id", offer.id);
    const afterExpiry = await owner.rpc("publish_offer_v2", {
      p_store_id: storeId,
      p_input: offerInput(product.id, {
        allocation: { storeProductId: product.id, quantity: 2, physicallySetAside: false },
      }),
      p_idempotency_key: randomUUID(),
    });
    expect(afterExpiry.error?.message).toMatch(/^allocation_exceeded:/);

    const movementRows = await service
      .from("stock_movements")
      .select("kind")
      .eq("store_product_id", product.id);
    expect(movementRows.data?.filter((row) => row.kind === "reservation_release")).toHaveLength(0);
  });

  it("reuses the open exception when a second mismatch lands under a fresh key", async () => {
    const product = await createProduct({ quantity: 3 });
    const offer = await publish(owner, product.id);
    await reserve(offer.id, offer.version, `second-mismatch-${randomUUID()}`);

    const first = await manager.rpc("report_stock_mismatch_v2", {
      p_store_id: storeId,
      p_offer_id: offer.id,
      p_observed_quantity: 1,
      p_reason: "one bag could not be found",
      p_idempotency_key: randomUUID(),
    });
    expect(first.error).toBeNull();

    // Reporting again under a fresh key is a real case, a member who finds
    // one more bag missing after the first report. Only one mismatch may be
    // open per offer, so the second report has to reuse the exception that
    // is already open rather than collide with the index enforcing that.
    const second = await manager.rpc("report_stock_mismatch_v2", {
      p_store_id: storeId,
      p_offer_id: offer.id,
      p_observed_quantity: 0,
      p_reason: "the last bag is gone too",
      p_idempotency_key: randomUUID(),
    });
    expect(second.error).toBeNull();
    expect(second.data.exception.id).toBe(first.data.exception.id);
    expect(second.data.offer.status).toBe("paused");
    expect(second.data.offer.version).toBeGreaterThan(first.data.offer.version);

    const openExceptions = await service
      .from("store_exceptions")
      .select("id")
      .eq("related_offer_id", offer.id)
      .eq("kind", "stock_mismatch")
      .eq("status", "open");
    expect(openExceptions.error).toBeNull();
    expect(openExceptions.data).toHaveLength(1);

    const reservationRows = await service
      .from("reservations_v2")
      .select("status")
      .eq("offer_id", offer.id);
    expect(reservationRows.data).toHaveLength(1);
    expect(reservationRows.data?.[0].status).toBe("failed_stock_mismatch");
  });

  it("lazily expires no-shows in both buyer and seller reads and never fulfills an expired hold", async () => {
    const product = await createProduct();
    const offer = await publish(owner, product.id, {
      allocation: { storeProductId: product.id, quantity: 1, physicallySetAside: false },
    });
    const installation = `expiry-installation-${randomUUID()}`;
    const code = "LB-expired-44";
    const held = await reserve(offer.id, offer.version, installation, randomUUID(), code);

    const pastStart = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const pastEnd = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    await service.from("offers_v2").update({ pickup_start: pastStart, pickup_end: pastEnd }).eq("id", offer.id);
    await service.from("reservations_v2").update({ hold_expires_at: pastEnd }).eq("id", held.reservation.id);

    const fulfill = await owner.rpc("fulfill_reservation_v2", {
      p_store_id: storeId,
      p_pickup_code: code,
      p_idempotency_key: randomUUID(),
    });
    expect(fulfill.error?.message).toMatch(/^invalid_state:.*expir/i);

    const buyerRead = await anon.rpc("get_buyer_reservations_v2", {
      p_installation_id: installation,
    });
    expect(buyerRead.error).toBeNull();
    expect(buyerRead.data).toHaveLength(1);
    expect(buyerRead.data[0]).toMatchObject({
      id: held.reservation.id,
      status: "expired_no_show",
      pickup_code_hint: "44",
    });
    expect(buyerRead.data[0].pickup_code_hash).toBeUndefined();

    const sellerProduct = await createProduct();
    const sellerOffer = await publish(owner, sellerProduct.id, {
      allocation: { storeProductId: sellerProduct.id, quantity: 1, physicallySetAside: false },
    });
    const sellerHeld = await reserve(
      sellerOffer.id,
      sellerOffer.version,
      `seller-expiry-${randomUUID()}`,
      randomUUID(),
      "LB-seller-expired-55"
    );
    await service
      .from("offers_v2")
      .update({ pickup_start: pastStart, pickup_end: pastEnd })
      .eq("id", sellerOffer.id);
    await service
      .from("reservations_v2")
      .update({ hold_expires_at: pastEnd })
      .eq("id", sellerHeld.reservation.id);

    const sellerRead = await staff.rpc("list_seller_pickups_v2", { p_store_id: storeId });
    expect(sellerRead.error).toBeNull();
    expect(sellerRead.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reservation_id: held.reservation.id, status: "expired_no_show" }),
        expect.objectContaining({
          reservation_id: sellerHeld.reservation.id,
          status: "expired_no_show",
        }),
      ])
    );

    const reloadedOffer = requireRow<{ quantity_available: number; status: string }>(
      await service.from("offers_v2").select("quantity_available, status").eq("id", offer.id).single(),
      "reload expired offer"
    );
    expect(reloadedOffer).toEqual({ quantity_available: 1, status: "expired" });

    // The sweep also releases the allocation. An expired offer encumbers
    // nothing, and nothing will ever come along later to clean the row up.
    const expiredAllocation = requireRow<{ status: string }>(
      await service
        .from("offer_allocations")
        .select("status")
        .eq("offer_id", offer.id)
        .single(),
      "read allocation after expiry"
    );
    expect(expiredAllocation.status).toBe("released");
  });

  it("writes the required audit and outbox records without exposing pickup plaintext", async () => {
    const audits = await service
      .from("audit_entries")
      .select("actor, command, detail")
      .eq("store_id", storeId);
    expect(audits.error).toBeNull();
    const commands = new Set(audits.data?.map((row) => row.command));
    expect([...commands]).toEqual(
      expect.arrayContaining([
        "publish_offer_v2",
        "reserve_offer_v2",
        "cancel_reservation_v2",
        "pause_offer_v2",
        "fulfill_reservation_v2",
        "report_stock_mismatch_v2",
      ])
    );
    expect(
      audits.data?.some(
        (row) => row.command === "reserve_offer_v2" && row.actor.startsWith("installation:")
      )
    ).toBe(true);
    expect(JSON.stringify(audits.data)).not.toContain("LB-fulfill-77");

    const outbox = await service.from("outbox_events").select("event_type, payload");
    expect(outbox.error).toBeNull();
    expect(outbox.data?.map((row) => row.event_type)).toEqual(
      expect.arrayContaining([
        "offer_published",
        "reservation_held",
        "reservation_cancelled",
        "offer_paused",
        "reservation_fulfilled",
        "reservation_failed_stock_mismatch",
      ])
    );
    expect(JSON.stringify(outbox.data)).not.toContain("LB-fulfill-77");
  });

  it("fulfills every hold on a physically set aside offer and floors the ledger at zero", async () => {
    // The set aside path exists because the seller has already pulled the
    // units off the shelf, which is why publication is allowed to exceed what
    // the ledger claims. Refusing the second handover on ledger grounds would
    // strand a buyer holding a real code in front of a bag that is physically
    // sitting there.
    const product = await createProduct({ quantity: 1, confidence: "low" });
    const offer = await publish(owner, product.id, {
      allocation: { storeProductId: product.id, quantity: 2, physicallySetAside: true },
    });

    const firstCode = "LB-aside-01";
    const secondCode = "LB-aside-02";
    await reserve(offer.id, offer.version, `aside-a-${randomUUID()}`, randomUUID(), firstCode);
    await reserve(
      offer.id,
      offer.version + 1,
      `aside-b-${randomUUID()}`,
      randomUUID(),
      secondCode
    );

    const first = await owner.rpc("fulfill_reservation_v2", {
      p_store_id: storeId,
      p_pickup_code: firstCode,
      p_idempotency_key: randomUUID(),
    });
    expect(first.error).toBeNull();
    const second = await owner.rpc("fulfill_reservation_v2", {
      p_store_id: storeId,
      p_pickup_code: secondCode,
      p_idempotency_key: randomUUID(),
    });
    expect(second.error).toBeNull();

    const reloaded = requireRow<{ on_hand_quantity: number }>(
      await service
        .from("store_products")
        .select("on_hand_quantity")
        .eq("id", product.id)
        .single(),
      "reload set aside product"
    );
    expect(reloaded.on_hand_quantity).toBe(0);

    // The movement rows carry what was actually applied, not a fabricated -1,
    // so the movements still sum to the true on hand quantity.
    const movements = await service
      .from("stock_movements")
      .select("delta, created_at")
      .eq("store_product_id", product.id)
      .eq("kind", "fulfillment")
      .order("created_at", { ascending: true });
    expect(movements.error).toBeNull();
    expect(movements.data?.map((row) => row.delta)).toEqual([-1, 0]);
  });

  it("refuses an approved adjustment that would undercut a live non set aside offer", async () => {
    const product = await createProduct({ quantity: 10 });
    await publish(owner, product.id, {
      allocation: { storeProductId: product.id, quantity: 10, physicallySetAside: false },
    });

    const countSessionId = randomUUID();
    const counted = await staff.rpc("record_inventory_count_v2", {
      p_store_id: storeId,
      p_count_session_id: countSessionId,
      p_lines: [{ storeProductId: product.id, observedQuantity: 5 }],
    });
    expect(counted.error).toBeNull();
    const proposal = counted.data[0] as { id: string; version: number };

    // The resulting quantity, 5, is comfortably above zero. Only the
    // encumbrance guard can catch this one, and without it half the units
    // promised to buyers would silently stop existing.
    const approved = await manager.rpc("approve_stock_adjustment_v2", {
      p_store_id: storeId,
      p_proposal_id: proposal.id,
      p_decision: "approve",
      p_idempotency_key: randomUUID(),
      p_expected_version: proposal.version,
    });
    expect(approved.error?.message).toMatch(
      /^validation_failed: adjustment would undercut allocated offers/
    );

    const reloaded = requireRow<{ on_hand_quantity: number }>(
      await service
        .from("store_products")
        .select("on_hand_quantity")
        .eq("id", product.id)
        .single(),
      "reload undercut product"
    );
    expect(reloaded.on_hand_quantity).toBe(10);
  });

  it("keeps a discrepant count unpublishable at the stale quantity until it is approved", async () => {
    const product = await createProduct({ quantity: 10 });

    const counted = await staff.rpc("record_inventory_count_v2", {
      p_store_id: storeId,
      p_count_session_id: randomUUID(),
      p_lines: [{ storeProductId: product.id, observedQuantity: 7 }],
    });
    expect(counted.error).toBeNull();
    const proposal = counted.data[0] as { id: string; version: number };

    const afterCount = requireRow<{ confidence: string; on_hand_quantity: number }>(
      await service
        .from("store_products")
        .select("confidence, on_hand_quantity")
        .eq("id", product.id)
        .single(),
      "reload counted product"
    );
    expect(afterCount.confidence).toBe("low");
    expect(afterCount.on_hand_quantity).toBe(10);

    // Not publishable at the observed quantity either. A discrepant count is
    // not a licence to publish a smaller number, it is a statement that this
    // ledger row cannot be trusted at all until somebody reviews it.
    const blocked = await owner.rpc("publish_offer_v2", {
      p_store_id: storeId,
      p_input: offerInput(product.id, {
        allocation: { storeProductId: product.id, quantity: 7, physicallySetAside: false },
      }),
      p_idempotency_key: randomUUID(),
    });
    expect(blocked.error?.message).toMatch(/^allocation_exceeded:/);

    const approved = await manager.rpc("approve_stock_adjustment_v2", {
      p_store_id: storeId,
      p_proposal_id: proposal.id,
      p_decision: "approve",
      p_idempotency_key: randomUUID(),
      p_expected_version: proposal.version,
    });
    expect(approved.error).toBeNull();

    const afterApproval = requireRow<{ confidence: string; on_hand_quantity: number }>(
      await service
        .from("store_products")
        .select("confidence, on_hand_quantity")
        .eq("id", product.id)
        .single(),
      "reload approved product"
    );
    expect(afterApproval.confidence).toBe("high");
    expect(afterApproval.on_hand_quantity).toBe(7);

    const published = await owner.rpc("publish_offer_v2", {
      p_store_id: storeId,
      p_input: offerInput(product.id, {
        allocation: { storeProductId: product.id, quantity: 7, physicallySetAside: false },
      }),
      p_idempotency_key: randomUUID(),
    });
    expect(published.error).toBeNull();
  });

  it("denies every direct write to offers_v2 and every read of audit_entries", async () => {
    // offers_v2 carries a select grant so members can read their own store's
    // offers. Writes belong to publish_offer_v2 and pause_offer_v2 alone, and
    // a member who could insert one directly would bypass every allocation
    // ceiling in this file. Same reasoning as the store_products write pin.
    const product = await createProduct();
    const writers: [string, SupabaseClient][] = [
      ["anon", anon],
      ["staff", staff],
      ["owner", owner],
    ];
    for (const [label, client] of writers) {
      const attempt = await client.from("offers_v2").insert({
        store_id: storeId,
        store_product_id: product.id,
        title: `Direct insert by ${label}`,
        category: "bakery",
        offer_price_uzs: 1000,
        quantity_total: 1,
        quantity_available: 1,
        pickup_start: new Date(suiteBaseMs + 60 * 60 * 1000).toISOString(),
        pickup_end: new Date(suiteBaseMs + 3 * 60 * 60 * 1000).toISOString(),
      });
      expect(`${label}:${attempt.error !== null}`).toBe(`${label}:true`);
    }

    // audit_entries is the tamper evident record of who did what. No client
    // role reads it, the service role and a future operator console do.
    for (const [label, client] of writers) {
      const read = await client.from("audit_entries").select("*");
      const rows = read.data ?? [];
      expect(`${label}:${read.error !== null || rows.length === 0}`).toBe(
        `${label}:true`
      );
      expect(rows).toHaveLength(0);
    }
  });
});

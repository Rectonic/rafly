/**
 * Unit coverage for the Supabase backed facades against stub clients.
 *
 * mappers.test.ts already pins every row mapper and errorCodeFrom in
 * isolation. This suite pins the facade wiring around them, the parts a
 * mapper test cannot reach: that every method returns a Result instead of
 * throwing when the client itself throws, the idempotency_conflict bridge
 * reserveOfferV2 adds on top of the RPC, that a non uuid countSessionId is
 * rewritten before it reaches the RPC, that a replay's null pickupCode
 * survives untouched, and that a full Postgrest shaped error still maps
 * through the same error table a plain message does.
 *
 * The stub client follows the pattern in flag-source.test.ts, a plain object
 * standing in for SupabaseClient rather than a mocking library. select, eq,
 * in, order and maybeSingle all return the same thenable chain object, which
 * is enough for every call shape these two facades make, none of them branch
 * on the builder beyond chaining a handful of these calls before an await.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  toStableUuid,
  type PublicOfferRow,
  type ReservationRow,
} from "@/lib/api/mappers";
import type { BuyerMarketplaceApiV2, SellerStoreApiV2 } from "@/lib/api";
import { makeSupabaseBuyerApi } from "@/lib/api/supabase-buyer-api";
import { makeSupabaseSellerApi } from "@/lib/api/supabase-seller-api";
import type { PublishOfferV2Input, Result } from "@/lib/contracts";

interface RpcCall {
  name: string;
  args: unknown;
}

interface Outcome {
  data: unknown;
  error: unknown;
}

/**
 * A thenable stand in for a PostgrestFilterBuilder. Real supabase-js lets a
 * caller await at any point in a chain because every chain method returns a
 * builder that is itself a promise. This stub does the same with one shared
 * object, so whichever of select, eq, in, order or maybeSingle a facade
 * happens to call, awaiting the result at the end resolves to the same fixed
 * outcome.
 */
function makeChain(outcome: Outcome): Record<string, unknown> {
  const chain: Record<string, unknown> = {};
  const link = () => chain;
  chain.select = link;
  chain.eq = link;
  chain.in = link;
  chain.order = link;
  chain.maybeSingle = link;
  chain.single = link;
  chain.then = (
    onFulfilled?: (value: Outcome) => unknown,
    onRejected?: (reason: unknown) => unknown
  ) => Promise.resolve(outcome).then(onFulfilled, onRejected);
  return chain;
}

interface StubClientConfig {
  /** Called for every client.rpc(...), defaults to no data and no error. */
  rpc?: (name: string, args: unknown) => Outcome;
  /** Called for every client.from(table), defaults to no data and no error. */
  from?: (table: string) => Outcome;
  /** Every rpc call this client saw, name and args, in call order. */
  rpcCalls?: RpcCall[];
}

function makeStubClient(config: StubClientConfig = {}): SupabaseClient {
  return {
    rpc: (name: string, args: unknown) => {
      config.rpcCalls?.push({ name, args });
      const outcome = config.rpc
        ? config.rpc(name, args)
        : { data: null, error: null };
      return makeChain(outcome);
    },
    from: (table: string) => {
      const outcome = config.from
        ? config.from(table)
        : { data: null, error: null };
      return makeChain(outcome);
    },
  } as unknown as SupabaseClient;
}

/**
 * A client where every property access throws, standing in for a transport
 * that never gets as far as returning a Postgrest shaped error, a network
 * drop or a thrown TypeError from fetch itself. Every facade method wraps its
 * whole body in try/catch, so exercising this proves the wrapper actually
 * works rather than assuming it from reading the source.
 */
function makeThrowingClient(message = "stub transport failure"): SupabaseClient {
  const thrower = () => {
    throw new Error(message);
  };
  return new Proxy({}, { get: () => thrower }) as unknown as SupabaseClient;
}

const offerSnapshotRow: PublicOfferRow = {
  id: "11111111-1111-4111-8111-111111111111",
  version: 1,
  store_id: "22222222-2222-4222-8222-222222222222",
  store_name: "Chorsu Corner Market",
  address: "12 Navoi street",
  latitude: 41.3111,
  longitude: 69.2797,
  title: "Bakery rescue box",
  category: "bakery",
  image_url: null,
  contents: ["bread"],
  offer_price_uzs: 20000,
  reference_price_uzs: 40000,
  discount_percent: 50,
  quantity_available: 2,
  pickup_start: "2026-08-10T17:00:00+00:00",
  pickup_end: "2026-08-10T20:00:00+00:00",
  allergens: [],
  dietary_badges: [],
  pickup_instructions: null,
  cancellation_policy: null,
  last_verified_at: "2026-08-10T09:00:00+00:00",
  status: "live",
};

function makeReservationRow(
  overrides: Partial<ReservationRow> = {}
): ReservationRow {
  return {
    id: "55555555-5555-4555-8555-555555555555",
    version: 2,
    offer_id: offerSnapshotRow.id,
    status: "held",
    quantity: 1,
    offer_snapshot: offerSnapshotRow,
    pickup_code_hint: "AB",
    hold_expires_at: "2026-08-10T20:00:00+00:00",
    created_at: "2026-08-10T09:30:00+00:00",
    updated_at: "2026-08-10T09:30:00+00:00",
    ...overrides,
  };
}

const publishInput: PublishOfferV2Input = {
  storeId: "store-1",
  idempotencyKey: "idem-1",
  allocation: {
    storeProductId: "product-1",
    quantity: 2,
    physicallySetAside: false,
  },
  title: "Evening rescue bag",
  category: "bakery",
  imageUrl: null,
  contents: ["bread"],
  offerPriceUzs: 10000,
  referencePriceUzs: 20000,
  pickupStart: "2026-08-10T17:00:00.000Z",
  pickupEnd: "2026-08-10T20:00:00.000Z",
  allergens: [],
  dietaryBadges: [],
  pickupInstructions: null,
  cancellationPolicy: null,
};

describe("never throws", () => {
  const buyerApi = makeSupabaseBuyerApi(makeThrowingClient());
  const sellerApi = makeSupabaseSellerApi(makeThrowingClient());

  const buyerCalls: [string, () => Promise<Result<unknown>>][] = [
    ["listMarketplaceOffersV2", () => buyerApi.listMarketplaceOffersV2()],
    ["getMarketplaceOfferV2", () => buyerApi.getMarketplaceOfferV2("offer-1")],
    [
      "reserveOfferV2",
      () =>
        buyerApi.reserveOfferV2({
          offerId: "offer-1",
          quantity: 1,
          clientReservationId: "client-1",
          installationId: "install-1",
          expectedOfferVersion: 1,
        }),
    ],
    [
      "cancelReservationV2",
      () =>
        buyerApi.cancelReservationV2({
          reservationId: "reservation-1",
          installationId: "install-1",
          idempotencyKey: "idem-1",
        }),
    ],
    ["getBuyerReservationsV2", () => buyerApi.getBuyerReservationsV2("install-1")],
  ];

  const sellerCalls: [string, () => Promise<Result<unknown>>][] = [
    ["getMyStoreMembershipsV2", () => sellerApi.getMyStoreMembershipsV2()],
    ["listStoreOffersV2", () => sellerApi.listStoreOffersV2("store-1")],
    ["listStoreInventoryV2", () => sellerApi.listStoreInventoryV2("store-1")],
    [
      "recordInventoryCountV2",
      () =>
        sellerApi.recordInventoryCountV2({
          storeId: "store-1",
          countSessionId: "count-session-1",
          lines: [{ storeProductId: "product-1", observedQuantity: 4 }],
        }),
    ],
    [
      "approveStockAdjustmentV2",
      () =>
        sellerApi.approveStockAdjustmentV2({
          storeId: "store-1",
          proposalId: "proposal-1",
          decision: "approve",
          idempotencyKey: "idem-1",
          expectedVersion: 1,
        }),
    ],
    ["approveAndPublishOfferV2", () => sellerApi.approveAndPublishOfferV2(publishInput)],
    [
      "pauseOfferV2",
      () =>
        sellerApi.pauseOfferV2({
          storeId: "store-1",
          offerId: "offer-1",
          idempotencyKey: "idem-1",
          expectedVersion: 1,
        }),
    ],
    ["listSellerPickupsV2", () => sellerApi.listSellerPickupsV2("store-1")],
    [
      "fulfillReservationV2",
      () =>
        sellerApi.fulfillReservationV2({
          storeId: "store-1",
          pickupCode: "ABCDEF",
          idempotencyKey: "idem-1",
        }),
    ],
    [
      "reportStockMismatchV2",
      () =>
        sellerApi.reportStockMismatchV2({
          storeId: "store-1",
          offerId: "offer-1",
          observedQuantity: 1,
          reason: "shelf came up short",
          idempotencyKey: "idem-1",
        }),
    ],
    ["listStoreExceptionsV2", () => sellerApi.listStoreExceptionsV2("store-1")],
  ];

  it.each(buyerCalls)(
    "buyer %s returns an err result instead of throwing",
    async (_name, call) => {
      const result = await call();
      expect(result.ok).toBe(false);
      if (result.ok) {
        return;
      }
      expect(["network_error", "unknown"]).toContain(result.error.code);
    }
  );

  it.each(sellerCalls)(
    "seller %s returns an err result instead of throwing",
    async (_name, call) => {
      const result = await call();
      expect(result.ok).toBe(false);
      if (result.ok) {
        return;
      }
      expect(["network_error", "unknown"]).toContain(result.error.code);
    }
  );

  it("covers every method the two interfaces declare, so a new method cannot silently skip this property", () => {
    const buyerApiForKeys: BuyerMarketplaceApiV2 = buyerApi;
    const sellerApiForKeys: SellerStoreApiV2 = sellerApi;
    expect(buyerCalls.map(([name]) => name).sort()).toEqual(
      Object.keys(buyerApiForKeys).sort()
    );
    expect(sellerCalls.map(([name]) => name).sort()).toEqual(
      Object.keys(sellerApiForKeys).sort()
    );
  });
});

describe("reserveOfferV2 idempotency conflict bridge", () => {
  it("reports idempotency_conflict when a replayed clientReservationId belongs to a different offer", async () => {
    const client = makeStubClient({
      rpc: () => ({
        data: {
          reservation: makeReservationRow({ offer_id: "offer-ALREADY-BOUND" }),
          pickup_code: null,
          replayed: true,
        },
        error: null,
      }),
    });
    const api = makeSupabaseBuyerApi(client);

    const result = await api.reserveOfferV2({
      offerId: "offer-REQUESTED",
      quantity: 1,
      clientReservationId: "shared-client-id",
      installationId: "install-1",
      expectedOfferVersion: 1,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe("idempotency_conflict");
    // The message names the client id that was reused and the offer it is
    // already bound to, not the offer the caller just asked for, that is
    // the whole point of the message.
    expect(result.error.message).toContain("shared-client-id");
    expect(result.error.message).toContain("offer-ALREADY-BOUND");
  });

  it("does not raise the conflict when the replayed row already belongs to the requested offer", async () => {
    const client = makeStubClient({
      rpc: () => ({
        data: {
          reservation: makeReservationRow(),
          pickup_code: null,
          replayed: true,
        },
        error: null,
      }),
    });
    const api = makeSupabaseBuyerApi(client);

    const result = await api.reserveOfferV2({
      offerId: offerSnapshotRow.id,
      quantity: 1,
      clientReservationId: "shared-client-id",
      installationId: "install-1",
      expectedOfferVersion: 1,
    });

    expect(result.ok).toBe(true);
  });
});

describe("recordInventoryCountV2 count session id", () => {
  it("derives a stable uuid from a non uuid countSessionId before the rpc call", async () => {
    const calls: RpcCall[] = [];
    const client = makeStubClient({
      rpcCalls: calls,
      rpc: () => ({ data: [], error: null }),
    });
    const api = makeSupabaseSellerApi(client);

    const result = await api.recordInventoryCountV2({
      storeId: "store-1",
      countSessionId: "count-session-1",
      lines: [{ storeProductId: "product-1", observedQuantity: 4 }],
    });

    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("record_inventory_count_v2");
    const args = calls[0].args as { p_count_session_id: string };
    expect(args.p_count_session_id).toBe(toStableUuid("count-session-1"));
    expect(args.p_count_session_id).not.toBe("count-session-1");
  });

  it("passes an already valid uuid countSessionId straight through, lowercased", async () => {
    const calls: RpcCall[] = [];
    const client = makeStubClient({
      rpcCalls: calls,
      rpc: () => ({ data: [], error: null }),
    });
    const api = makeSupabaseSellerApi(client);
    const uuidSessionId = "11111111-1111-4111-8111-11111111111A";

    await api.recordInventoryCountV2({
      storeId: "store-1",
      countSessionId: uuidSessionId,
      lines: [],
    });

    const args = calls[0].args as { p_count_session_id: string };
    expect(args.p_count_session_id).toBe(uuidSessionId.toLowerCase());
  });
});

describe("reserveOfferV2 pickup code passthrough", () => {
  it("keeps pickupCode null on a replay instead of coercing it to an empty string", async () => {
    const client = makeStubClient({
      rpc: () => ({
        data: {
          reservation: makeReservationRow(),
          pickup_code: null,
          replayed: true,
        },
        error: null,
      }),
    });
    const api = makeSupabaseBuyerApi(client);

    const result = await api.reserveOfferV2({
      offerId: offerSnapshotRow.id,
      quantity: 1,
      clientReservationId: "shared-client-id",
      installationId: "install-1",
      expectedOfferVersion: 1,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.pickupCode).toBeNull();
    expect(result.value.pickupCode).not.toBe("");
  });

  it("still passes the raw code through on a fresh, non replayed reservation", async () => {
    const client = makeStubClient({
      rpc: () => ({
        data: {
          reservation: makeReservationRow(),
          pickup_code: "ABCD12",
          replayed: false,
        },
        error: null,
      }),
    });
    const api = makeSupabaseBuyerApi(client);

    const result = await api.reserveOfferV2({
      offerId: offerSnapshotRow.id,
      quantity: 1,
      clientReservationId: "fresh-client-id",
      installationId: "install-1",
      expectedOfferVersion: 1,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.pickupCode).toBe("ABCD12");
  });
});

describe("error prefix mapping through a real RPC shaped error", () => {
  it("maps a full Postgrest error object, not just a bare message, through the same prefix table", async () => {
    const client = makeStubClient({
      rpc: () => ({
        data: null,
        error: {
          message: "forbidden: role staff may not pause offers",
          details: null,
          hint: null,
          code: "P0001",
        },
      }),
    });
    const api = makeSupabaseSellerApi(client);

    const result = await api.pauseOfferV2({
      storeId: "store-1",
      offerId: "offer-1",
      idempotencyKey: "idem-1",
      expectedVersion: 1,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe("forbidden");
    expect(result.error.message).toBe("forbidden: role staff may not pause offers");
    expect(result.error.retryable).toBe(false);
    expect(result.error.details).toEqual({ pgCode: "P0001" });
  });

  it("maps the 42501 insufficient privilege code to forbidden through the facade too", async () => {
    const client = makeStubClient({
      rpc: () => ({
        data: null,
        error: {
          message: "permission denied for function list_store_offers_v2",
          details: null,
          hint: null,
          code: "42501",
        },
      }),
    });
    const api = makeSupabaseSellerApi(client);

    const result = await api.listStoreOffersV2("store-1");

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe("forbidden");
    expect(result.error.retryable).toBe(false);
  });
});

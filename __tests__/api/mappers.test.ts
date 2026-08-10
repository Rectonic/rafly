/**
 * Row mapper tests.
 *
 * Every mapper turns a snake case row, exactly as PostgREST hands it back,
 * into the camelCase DTO the coordinator contracts declare. The assertions
 * check the whole object rather than a field at a time, and they check the
 * key set separately, so an internal column that leaks through the mapper
 * fails the suite instead of riding along into the UI.
 */

import {
  PUBLIC_OFFER_TIMEZONE,
  commandErrorFrom,
  computeDiscountPercent,
  errorCodeFrom,
  mapExceptionRow,
  mapInventoryRow,
  mapMembershipRow,
  mapProposalRow,
  mapPublicOfferRow,
  mapReservationRow,
  mapSellerOfferRow,
  mapSellerPickupRow,
  toIsoDateTime,
  toStableUuid,
  type PublicOfferRow,
  type RawOfferRow,
  type ReservationRow,
  type StoreEnrichment,
} from "@/lib/api/mappers";

const publicOfferRow: PublicOfferRow = {
  id: "11111111-1111-4111-8111-111111111111",
  version: 3,
  store_id: "22222222-2222-4222-8222-222222222222",
  store_name: "Chorsu Corner Market",
  address: "12 Navoi street",
  latitude: 41.3111,
  longitude: 69.2797,
  title: "Bakery rescue box",
  category: "bakery",
  image_url: null,
  contents: ["bread", "pastry"],
  offer_price_uzs: 20000,
  reference_price_uzs: 50000,
  discount_percent: 60,
  quantity_available: 2,
  pickup_start: "2026-08-10T17:00:00+00:00",
  pickup_end: "2026-08-10T20:00:00+00:00",
  allergens: ["gluten"],
  dietary_badges: ["vegetarian"],
  pickup_instructions: "Ask at the counter",
  cancellation_policy: "Cancel before pickup start",
  last_verified_at: "2026-08-10T09:00:00+00:00",
  status: "live",
};

const rawOfferRow: RawOfferRow = {
  id: "11111111-1111-4111-8111-111111111111",
  store_id: "22222222-2222-4222-8222-222222222222",
  store_product_id: "33333333-3333-4333-8333-333333333333",
  title: "Bakery rescue box",
  category: "bakery",
  image_url: null,
  contents: ["bread", "pastry"],
  offer_price_uzs: 20000,
  reference_price_uzs: 50000,
  quantity_total: 2,
  quantity_available: 1,
  pickup_start: "2026-08-10T17:00:00+00:00",
  pickup_end: "2026-08-10T20:00:00+00:00",
  allergens: ["gluten"],
  dietary_badges: ["vegetarian"],
  pickup_instructions: "Ask at the counter",
  cancellation_policy: "Cancel before pickup start",
  status: "paused",
  physically_set_aside: true,
  last_verified_at: "2026-08-10T09:00:00+00:00",
  version: 4,
  publish_idempotency_key: "publish-key-1",
  approved_by: "44444444-4444-4444-8444-444444444444",
  created_at: "2026-08-10T08:00:00+00:00",
};

const store: StoreEnrichment = {
  storeName: "Chorsu Corner Market",
  storeAddress: "12 Navoi street",
  latitude: 41.3111,
  longitude: 69.2797,
};

const reservationRow: ReservationRow = {
  id: "55555555-5555-4555-8555-555555555555",
  version: 2,
  offer_id: publicOfferRow.id,
  status: "held",
  quantity: 1,
  offer_snapshot: publicOfferRow,
  pickup_code_hint: "45",
  hold_expires_at: "2026-08-10T20:00:00+00:00",
  created_at: "2026-08-10T09:30:00+00:00",
  updated_at: "2026-08-10T09:30:00+00:00",
};

const OFFER_KEYS = [
  "id",
  "version",
  "storeId",
  "storeName",
  "storeAddress",
  "latitude",
  "longitude",
  "title",
  "category",
  "imageUrl",
  "contents",
  "offerPriceUzs",
  "referencePriceUzs",
  "discountPercent",
  "quantityAvailable",
  "pickupStart",
  "pickupEnd",
  "timezone",
  "allergens",
  "dietaryBadges",
  "pickupInstructions",
  "cancellationPolicy",
  "lastVerifiedAt",
  "status",
].sort();

describe("toIsoDateTime", () => {
  it("normalises a PostgREST offset timestamp to an ISO string with milliseconds", () => {
    expect(toIsoDateTime("2026-08-10T17:00:00+00:00")).toBe(
      "2026-08-10T17:00:00.000Z"
    );
    expect(toIsoDateTime("2026-08-10T22:00:00+05:00")).toBe(
      "2026-08-10T17:00:00.000Z"
    );
  });
});

describe("toStableUuid", () => {
  const uuidShape =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  it("passes a value that is already a uuid straight through, lowercased", () => {
    expect(toStableUuid("11111111-1111-4111-8111-111111111111")).toBe(
      "11111111-1111-4111-8111-111111111111"
    );
    expect(toStableUuid("11111111-1111-4111-8111-11111111111A")).toBe(
      "11111111-1111-4111-8111-11111111111a"
    );
  });

  it("derives a well formed uuid from any other string", () => {
    expect(toStableUuid("count-session-1")).toMatch(uuidShape);
    expect(toStableUuid("")).toMatch(uuidShape);
  });

  it("is deterministic, which is what keeps the derived id idempotent", () => {
    expect(toStableUuid("count-session-1")).toBe(
      toStableUuid("count-session-1")
    );
    expect(toStableUuid("count-session-1")).not.toBe(
      toStableUuid("count-session-2")
    );
  });
});

describe("computeDiscountPercent", () => {
  it("pins the 1700 against 4000 boundary to 58, the exact numeric answer the SQL view also produces", () => {
    // Subtracting the price ratio from one before multiplying by 100 loses
    // precision in doubles right at this pair, landing on 57. Multiplying
    // the difference by 100 before dividing once keeps the boundary exact.
    expect(computeDiscountPercent(1700, 4000)).toBe(58);
  });

  it("still matches the plain cases the mappers already exercise", () => {
    expect(computeDiscountPercent(20000, 50000)).toBe(60);
    expect(computeDiscountPercent(20000, 30000)).toBe(33);
    expect(computeDiscountPercent(20000, null)).toBeNull();
    expect(computeDiscountPercent(20000, 0)).toBeNull();
  });
});

describe("mapPublicOfferRow", () => {
  it("maps a public view row to the exact marketplace offer DTO", () => {
    expect(mapPublicOfferRow(publicOfferRow)).toEqual({
      id: publicOfferRow.id,
      version: 3,
      storeId: publicOfferRow.store_id,
      storeName: "Chorsu Corner Market",
      storeAddress: "12 Navoi street",
      latitude: 41.3111,
      longitude: 69.2797,
      title: "Bakery rescue box",
      category: "bakery",
      imageUrl: null,
      contents: ["bread", "pastry"],
      offerPriceUzs: 20000,
      referencePriceUzs: 50000,
      discountPercent: 60,
      quantityAvailable: 2,
      pickupStart: "2026-08-10T17:00:00.000Z",
      pickupEnd: "2026-08-10T20:00:00.000Z",
      timezone: PUBLIC_OFFER_TIMEZONE,
      allergens: ["gluten"],
      dietaryBadges: ["vegetarian"],
      pickupInstructions: "Ask at the counter",
      cancellationPolicy: "Cancel before pickup start",
      lastVerifiedAt: "2026-08-10T09:00:00.000Z",
      status: "live",
    });
  });

  it("produces exactly the contract key set", () => {
    expect(Object.keys(mapPublicOfferRow(publicOfferRow)).sort()).toEqual(
      OFFER_KEYS
    );
  });

  it("carries the Asia Tashkent timezone constant the view does not store", () => {
    expect(mapPublicOfferRow(publicOfferRow).timezone).toBe("Asia/Tashkent");
  });

  it("defaults missing store coordinates to zero rather than emitting null", () => {
    const mapped = mapPublicOfferRow({
      ...publicOfferRow,
      latitude: null,
      longitude: null,
    });

    expect(mapped.latitude).toBe(0);
    expect(mapped.longitude).toBe(0);
  });

  it("keeps json array columns as arrays even when the row carries null", () => {
    const mapped = mapPublicOfferRow({
      ...publicOfferRow,
      contents: null,
      allergens: null,
      dietary_badges: null,
    });

    expect(mapped.contents).toEqual([]);
    expect(mapped.allergens).toEqual([]);
    expect(mapped.dietaryBadges).toEqual([]);
  });

  it("leaves the discount null when the row has no reference price", () => {
    const mapped = mapPublicOfferRow({
      ...publicOfferRow,
      reference_price_uzs: null,
      discount_percent: null,
    });

    expect(mapped.referencePriceUzs).toBeNull();
    expect(mapped.discountPercent).toBeNull();
  });
});

describe("mapSellerOfferRow", () => {
  it("redacts every internal column and enriches from the store row", () => {
    expect(mapSellerOfferRow(rawOfferRow, store)).toEqual({
      id: rawOfferRow.id,
      version: 4,
      storeId: rawOfferRow.store_id,
      storeName: "Chorsu Corner Market",
      storeAddress: "12 Navoi street",
      latitude: 41.3111,
      longitude: 69.2797,
      title: "Bakery rescue box",
      category: "bakery",
      imageUrl: null,
      contents: ["bread", "pastry"],
      offerPriceUzs: 20000,
      referencePriceUzs: 50000,
      discountPercent: 60,
      quantityAvailable: 1,
      pickupStart: "2026-08-10T17:00:00.000Z",
      pickupEnd: "2026-08-10T20:00:00.000Z",
      timezone: PUBLIC_OFFER_TIMEZONE,
      allergens: ["gluten"],
      dietaryBadges: ["vegetarian"],
      pickupInstructions: "Ask at the counter",
      cancellationPolicy: "Cancel before pickup start",
      lastVerifiedAt: "2026-08-10T09:00:00.000Z",
      status: "paused",
    });
  });

  it("produces exactly the contract key set with no internal column left over", () => {
    const mapped = mapSellerOfferRow(rawOfferRow, store);
    const keys = Object.keys(mapped);

    expect(keys.sort()).toEqual(OFFER_KEYS);
    for (const internal of [
      "storeProductId",
      "store_product_id",
      "publishIdempotencyKey",
      "publish_idempotency_key",
      "physicallySetAside",
      "physically_set_aside",
      "approvedBy",
      "approved_by",
      "quantityTotal",
      "quantity_total",
      "createdAt",
      "created_at",
    ]) {
      expect(keys).not.toContain(internal);
    }
  });

  it("computes the discount the same way the public view does", () => {
    expect(
      mapSellerOfferRow(
        { ...rawOfferRow, offer_price_uzs: 20000, reference_price_uzs: 30000 },
        store
      ).discountPercent
    ).toBe(33);
    expect(
      mapSellerOfferRow({ ...rawOfferRow, reference_price_uzs: null }, store)
        .discountPercent
    ).toBeNull();
  });

  it("falls back to the pickup start when a row carries no verification time", () => {
    expect(
      mapSellerOfferRow({ ...rawOfferRow, last_verified_at: null }, store)
        .lastVerifiedAt
    ).toBe("2026-08-10T17:00:00.000Z");
  });
});

describe("mapReservationRow", () => {
  it("maps a reservation row to the exact buyer reservation DTO", () => {
    expect(mapReservationRow(reservationRow)).toEqual({
      id: reservationRow.id,
      version: 2,
      offerId: publicOfferRow.id,
      status: "held",
      quantity: 1,
      offerSnapshot: mapPublicOfferRow(publicOfferRow),
      pickupCodeHint: "45",
      holdExpiresAt: "2026-08-10T20:00:00.000Z",
      createdAt: "2026-08-10T09:30:00.000Z",
      updatedAt: "2026-08-10T09:30:00.000Z",
    });
  });

  it("produces exactly the contract key set and never a hash or an installation id", () => {
    const keys = Object.keys(mapReservationRow(reservationRow));

    expect(keys.sort()).toEqual(
      [
        "id",
        "version",
        "offerId",
        "status",
        "quantity",
        "offerSnapshot",
        "pickupCodeHint",
        "holdExpiresAt",
        "createdAt",
        "updatedAt",
      ].sort()
    );
    expect(keys).not.toContain("pickupCodeHash");
    expect(keys).not.toContain("installationId");
    expect(keys).not.toContain("clientReservationId");
  });

  it("pins quantity to one whatever the row says", () => {
    expect(
      mapReservationRow({ ...reservationRow, quantity: 4 }).quantity
    ).toBe(1);
  });
});

describe("mapSellerPickupRow", () => {
  it("maps a pickup row to the exact seller pickup DTO", () => {
    const mapped = mapSellerPickupRow({
      reservation_id: reservationRow.id,
      offer_id: publicOfferRow.id,
      offer_title: "Bakery rescue box",
      status: "fulfilled",
      pickup_code_hint: "45",
      hold_expires_at: "2026-08-10T20:00:00+00:00",
      pickup_start: "2026-08-10T17:00:00+00:00",
      pickup_end: "2026-08-10T20:00:00+00:00",
      created_at: "2026-08-10T09:30:00+00:00",
      version: 3,
    });

    expect(mapped).toEqual({
      reservationId: reservationRow.id,
      offerId: publicOfferRow.id,
      offerTitle: "Bakery rescue box",
      status: "fulfilled",
      pickupCodeHint: "45",
      holdExpiresAt: "2026-08-10T20:00:00.000Z",
      pickupStart: "2026-08-10T17:00:00.000Z",
      pickupEnd: "2026-08-10T20:00:00.000Z",
      createdAt: "2026-08-10T09:30:00.000Z",
      version: 3,
    });
    expect(Object.keys(mapped)).toHaveLength(10);
  });
});

describe("mapInventoryRow", () => {
  it("maps an inventory summary row to the exact DTO", () => {
    const mapped = mapInventoryRow({
      store_product_id: "33333333-3333-4333-8333-333333333333",
      store_id: publicOfferRow.store_id,
      product_name: "Fresh bread loaf",
      barcode: "4780000000011",
      category: "bakery",
      on_hand_quantity: 10,
      confidence: "high",
      last_verified_at: "2026-08-10T09:00:00+00:00",
      max_offerable_quantity: 8,
      allocated_quantity: 2,
      expiry_date: "2026-08-12",
      has_open_exceptions: false,
      version: 5,
    });

    expect(mapped).toEqual({
      storeProductId: "33333333-3333-4333-8333-333333333333",
      storeId: publicOfferRow.store_id,
      productName: "Fresh bread loaf",
      barcode: "4780000000011",
      category: "bakery",
      onHandQuantity: 10,
      confidence: "high",
      lastVerifiedAt: "2026-08-10T09:00:00.000Z",
      maxOfferableQuantity: 8,
      allocatedQuantity: 2,
      expiryDate: "2026-08-12",
      hasOpenExceptions: false,
      version: 5,
    });
    expect(Object.keys(mapped)).toHaveLength(13);
  });

  it("keeps a null verification time and a null expiry date null", () => {
    const mapped = mapInventoryRow({
      store_product_id: "33333333-3333-4333-8333-333333333333",
      store_id: publicOfferRow.store_id,
      product_name: "Chilled yoghurt",
      barcode: null,
      category: null,
      on_hand_quantity: 6,
      confidence: "low",
      last_verified_at: null,
      max_offerable_quantity: 0,
      allocated_quantity: 0,
      expiry_date: null,
      has_open_exceptions: true,
      version: 1,
    });

    expect(mapped.lastVerifiedAt).toBeNull();
    expect(mapped.expiryDate).toBeNull();
    expect(mapped.barcode).toBeNull();
    expect(mapped.category).toBeNull();
  });
});

describe("mapProposalRow", () => {
  it("maps a proposal row plus the product name to the exact DTO", () => {
    const mapped = mapProposalRow(
      {
        id: "66666666-6666-4666-8666-666666666666",
        store_id: publicOfferRow.store_id,
        store_product_id: "33333333-3333-4333-8333-333333333333",
        current_quantity: 10,
        proposed_quantity: 7,
        delta: -3,
        reason: "count",
        status: "pending",
        created_by_role: "staff",
        created_at: "2026-08-10T09:15:00+00:00",
        version: 1,
      },
      "Fresh bread loaf"
    );

    expect(mapped).toEqual({
      id: "66666666-6666-4666-8666-666666666666",
      storeId: publicOfferRow.store_id,
      storeProductId: "33333333-3333-4333-8333-333333333333",
      productName: "Fresh bread loaf",
      currentQuantity: 10,
      proposedQuantity: 7,
      delta: -3,
      reason: "count",
      status: "pending",
      createdByRole: "staff",
      createdAt: "2026-08-10T09:15:00.000Z",
      version: 1,
    });
    expect(Object.keys(mapped)).toHaveLength(12);
  });
});

describe("mapExceptionRow", () => {
  it("maps a store exception row to the exact DTO and drops the product link shape", () => {
    const mapped = mapExceptionRow({
      id: "77777777-7777-4777-8777-777777777777",
      store_id: publicOfferRow.store_id,
      kind: "stock_mismatch",
      message: "shelf was empty (observed 0)",
      status: "open",
      resolution_note: null,
      resolved_at: null,
      related_offer_id: publicOfferRow.id,
      related_store_product_id: "33333333-3333-4333-8333-333333333333",
      created_at: "2026-08-10T09:45:00+00:00",
    });

    expect(mapped).toEqual({
      id: "77777777-7777-4777-8777-777777777777",
      storeId: publicOfferRow.store_id,
      kind: "stock_mismatch",
      message: "shelf was empty (observed 0)",
      status: "open",
      resolutionNote: null,
      resolvedAt: null,
      relatedOfferId: publicOfferRow.id,
      relatedStoreProductId: "33333333-3333-4333-8333-333333333333",
      createdAt: "2026-08-10T09:45:00.000Z",
    });
    expect(Object.keys(mapped)).toHaveLength(10);
  });
});

describe("mapMembershipRow", () => {
  it("maps a membership row to the exact DTO with nested store flags", () => {
    const mapped = mapMembershipRow({
      store_id: publicOfferRow.store_id,
      store_name: "Chorsu Corner Market",
      role: "manager",
      pilot_mode_enabled: true,
      shop_seller_beta_enabled: false,
    });

    expect(mapped).toEqual({
      storeId: publicOfferRow.store_id,
      storeName: "Chorsu Corner Market",
      role: "manager",
      storeFlags: { pilotModeEnabled: true, shopSellerBetaEnabled: false },
    });
    expect(Object.keys(mapped)).toHaveLength(4);
  });
});

describe("errorCodeFrom", () => {
  const table: [string, string][] = [
    ["not_found: offer x does not exist", "not_found"],
    ["forbidden: role staff may not publish offers", "forbidden"],
    ["validation_failed: idempotency key is required", "validation_failed"],
    ["version_conflict: offer x expected version 1", "version_conflict"],
    ["invalid_state: reservation x is fulfilled", "invalid_state"],
    ["idempotency_conflict: key reused with different input", "idempotency_conflict"],
    ["sold_out: offer x has no units left", "sold_out"],
    ["offer_not_live: offer x is paused", "offer_not_live"],
    ["allocation_exceeded: allocation of 5 exceeds 2", "allocation_exceeded"],
  ];

  it.each(table)("maps the %s prefix", (message, expected) => {
    expect(errorCodeFrom({ message })).toBe(expected);
  });

  it("strips the postgres error context prefix before reading the code", () => {
    expect(
      errorCodeFrom({ message: 'invalid input syntax for type uuid: "nope"' })
    ).toBe("not_found");
    expect(errorCodeFrom({ code: "22P02", message: "whatever" })).toBe(
      "not_found"
    );
  });

  const pgCodeTable: [string, string, string][] = [
    [
      "22P02",
      "forbidden: a message no caller actually writes for this code",
      "not_found",
    ],
    [
      "42501",
      "permission denied for function list_store_offers_v2",
      "forbidden",
    ],
  ];

  it.each(pgCodeTable)(
    "lets the postgres code %s win over the message, mapping to %s",
    (code, message, expected) => {
      expect(errorCodeFrom({ code, message })).toBe(expected);
    }
  );

  it("maps an unknown prefix to unknown", () => {
    expect(errorCodeFrom({ message: "boom: something exploded" })).toBe(
      "unknown"
    );
    expect(errorCodeFrom({ message: "no colon at all" })).toBe("unknown");
    expect(errorCodeFrom(null)).toBe("unknown");
  });

  it("maps transport failures to network_error", () => {
    expect(errorCodeFrom(new TypeError("Network request failed"))).toBe(
      "network_error"
    );
    expect(errorCodeFrom({ message: "fetch failed" })).toBe("network_error");
    expect(errorCodeFrom({ message: "TypeError: Failed to fetch" })).toBe(
      "network_error"
    );
  });

  it("never lets a prefix inside the message body win over the real prefix", () => {
    expect(
      errorCodeFrom({ message: "not_found: no reservation sold_out here" })
    ).toBe("not_found");
  });
});

describe("commandErrorFrom", () => {
  it("returns an err result carrying the code, the message and the retryable flag", () => {
    const result = commandErrorFrom({
      message: "sold_out: offer x has no units left",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected an error result");
    }
    expect(result.error.code).toBe("sold_out");
    expect(result.error.message).toBe("sold_out: offer x has no units left");
    expect(result.error.retryable).toBe(false);
  });

  it("marks a transport failure retryable", () => {
    const result = commandErrorFrom(new TypeError("Network request failed"));

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected an error result");
    }
    expect(result.error.code).toBe("network_error");
    expect(result.error.retryable).toBe(true);
  });
});

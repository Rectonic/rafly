import {
  buildReservationCode,
  buildReservationInsert,
  createPickupReservation,
  syncPickupOrder,
  syncPickupOrderStatus,
} from "@/lib/reservations";
import type { Offer } from "@/types/offer";

let mockIsSupabaseConfigured = false;
let mockSupabase: unknown = null;

jest.mock("@/lib/supabase", () => ({
  get supabase() {
    return mockSupabase;
  },
  isSupabaseConfigured: () => mockIsSupabaseConfigured,
}));

describe("buildReservationCode", () => {
  it("formats compact seller pickup codes for scanner entry", () => {
    expect(buildReservationCode("seller-offer-1", 123456)).toBe("LB-ER1-123456");
  });
});

describe("buildReservationInsert", () => {
  const sellerOffer: Offer = {
    businessType: "shop",
    category: "Baked Goods",
    discount: 45,
    distance: "0.8 km",
    endTime: "20:30",
    id: "seller-offer-1",
    image: "",
    location: {
      address: "12 Market Street",
      lat: 41.3111,
      lng: 69.2797,
    },
    newPrice: 5,
    oldPrice: 9,
    quantityAvailable: 3,
    rating: 4.8,
    restaurant: "Night Bakery",
    reviews: 124,
    sellerId: "seller-1",
    source: "seller",
    title: "Closing-time pastry bag",
  };

  it("builds pickup_orders rows for seller-backed marketplace offers", () => {
    expect(
      buildReservationInsert(
        sellerOffer,
        "LB-ER1-123456",
        "Mobile customer",
        "Забрать до 20:30"
      )
    ).toEqual({
      customer_name: "Mobile customer",
      offer_id: "seller-offer-1",
      pickup_window: "Забрать до 20:30",
      reservation_code: "LB-ER1-123456",
      seller_id: "seller-1",
      total: 5,
    });
  });

  it("does not build Supabase rows for seed-only buyer offers", () => {
    expect(
      buildReservationInsert(
        {
          ...sellerOffer,
          id: "seed-1",
          sellerId: undefined,
          source: "seed",
        },
        "LB-EED-123456"
      )
    ).toBeNull();
  });

  it("returns a recoverable local reservation when seller sync is unavailable", async () => {
    mockIsSupabaseConfigured = false;
    mockSupabase = null;

    await expect(createPickupReservation(sellerOffer)).resolves.toEqual(
      expect.objectContaining({
        synced: false,
      })
    );
  });

  it("returns a recoverable failed sync when seller reservation RPC times out", async () => {
    jest.useFakeTimers();
    try {
      mockIsSupabaseConfigured = true;
      mockSupabase = {
        rpc: jest.fn(() => new Promise(() => undefined)),
      };
      let result:
        | Awaited<ReturnType<typeof createPickupReservation>>
        | undefined;

      void createPickupReservation(sellerOffer, "Pickup by 20:30", {
        syncTimeoutMs: 25,
      }).then((nextResult) => {
        result = nextResult;
      });

      await jest.advanceTimersByTimeAsync(25);
      await Promise.resolve();
      await Promise.resolve();

      expect(result).toEqual(
        expect.objectContaining({
          syncError: "Reservation sync timed out. Try again from Reservations.",
          synced: false,
        })
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it("reserves seller offers through the atomic reservation RPC", async () => {
    mockIsSupabaseConfigured = true;
    const rpc = jest.fn().mockResolvedValue({
      data: [
        {
          pickup_order_id: "pickup-order-1",
          quantity_available: 2,
          status: "pending",
        },
      ],
      error: null,
    });
    mockSupabase = {
      rpc,
    };

    await expect(
      syncPickupOrder({
        customer_name: "Mobile customer",
        offer_id: "seller-offer-1",
        pickup_window: "Pickup by 20:30",
        reservation_code: "LB-ER1-123456",
        seller_id: "seller-1",
        total: 5,
      })
    ).resolves.toEqual({
      pickupOrderId: "pickup-order-1",
      quantityAvailable: 2,
      synced: true,
    });
    expect(rpc).toHaveBeenCalledWith("reserve_seller_offer", {
      p_customer_name: "Mobile customer",
      p_offer_id: "seller-offer-1",
      p_pickup_window: "Pickup by 20:30",
      p_reservation_code: "LB-ER1-123456",
    });
  });

  it("marks seller pickup orders cancelled through the lifecycle RPC", async () => {
    mockIsSupabaseConfigured = true;
    const rpc = jest.fn().mockResolvedValue({
      data: [
        {
          pickup_order_id: "pickup-order-1",
          quantity_available: 3,
          status: "cancelled",
        },
      ],
      error: null,
    });
    mockSupabase = {
      rpc,
    };

    await expect(
      syncPickupOrderStatus({
        pickupCode: "LB-ER1-123456",
        reservation: {
          offerId: "seller-offer-1",
          sellerId: "seller-1",
        },
        status: "cancelled",
      })
    ).resolves.toEqual({
      pickupOrderId: "pickup-order-1",
      quantityAvailable: 3,
      synced: true,
    });

    expect(rpc).toHaveBeenCalledWith("cancel_seller_reservation", {
      p_offer_id: "seller-offer-1",
      p_reservation_code: "LB-ER1-123456",
    });
  });

  it("reports a failed lifecycle sync when the seller pickup order is no longer pending", async () => {
    mockIsSupabaseConfigured = true;
    mockSupabase = {
      rpc: jest.fn().mockResolvedValue({
        data: null,
        error: { message: "Seller pickup order is no longer pending." },
      }),
    };

    await expect(
      syncPickupOrderStatus({
        pickupCode: "LB-ER1-123456",
        reservation: {
          offerId: "seller-offer-1",
          sellerId: "seller-1",
        },
        status: "cancelled",
      })
    ).resolves.toEqual({
      syncError: "Seller pickup order is no longer pending.",
      synced: false,
    });
  });
});

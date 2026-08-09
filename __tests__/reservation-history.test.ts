import {
  buildBuyerReservation,
  getEffectiveReservationStatus,
} from "@/lib/reservation-history";
import type { Offer } from "@/types/offer";

const offer: Offer = {
  businessType: "shop",
  category: "Baked Goods",
  discount: 65,
  distance: "2.8 km",
  endTime: "18:45",
  id: "9",
  image: "",
  location: {
    address: "Yashnobod District, Tashkent",
    lat: 41.33177,
    lng: 69.30091,
  },
  newPrice: 5.6,
  oldPrice: 16,
  quantityAvailable: 9,
  rating: 4.7,
  restaurant: "Butter House",
  reviews: 129,
  source: "seed",
  title: "Morning Pastry Pack",
};

describe("reservation history helpers", () => {
  it("builds persisted buyer reservation metadata without exposing the raw pickup code", () => {
    const reservation = buildBuyerReservation({
      now: new Date("2026-05-28T12:00:00.000Z"),
      offer,
      pickupCode: "LB-009-123456",
      synced: false,
    });

    expect(reservation).toEqual(
      expect.objectContaining({
        codeHint: "3456",
        offerId: "9",
        offerTitle: "Morning Pastry Pack",
        restaurant: "Butter House",
        status: "active",
        syncStatus: "local",
        total: 5.6,
      })
    );
    expect(JSON.stringify(reservation)).not.toContain("LB-009-123456");
  });

  it("accepts a localized pickup window for persisted buyer copy", () => {
    const reservation = buildBuyerReservation({
      now: new Date("2026-05-28T12:00:00.000Z"),
      offer,
      pickupCode: "LB-009-123456",
      pickupWindow: "Забрать до 18:45",
      synced: false,
    });

    expect(reservation.pickupWindow).toBe("Забрать до 18:45");
  });

  it("treats active reservations past pickup time as expired", () => {
    const reservation = buildBuyerReservation({
      now: new Date("2026-05-28T12:00:00.000Z"),
      offer,
      pickupCode: "LB-009-123456",
      synced: true,
    });

    expect(
      getEffectiveReservationStatus(
        reservation,
        new Date("2026-05-28T19:00:00.000Z")
      )
    ).toBe("expired");
  });

  it("does not override completed or cancelled reservation statuses", () => {
    const reservation = buildBuyerReservation({
      now: new Date("2026-05-28T12:00:00.000Z"),
      offer,
      pickupCode: "LB-009-123456",
      synced: true,
    });

    expect(
      getEffectiveReservationStatus(
        { ...reservation, status: "completed" },
        new Date("2026-05-28T19:00:00.000Z")
      )
    ).toBe("completed");
    expect(
      getEffectiveReservationStatus(
        { ...reservation, status: "cancelled" },
        new Date("2026-05-28T19:00:00.000Z")
      )
    ).toBe("cancelled");
  });
});

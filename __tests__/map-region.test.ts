import { getOfferMapRegion } from "@/lib/map-region";
import type { Offer } from "@/types/offer";

const offer = (id: string, lat: number, lng: number): Offer =>
  ({
    id,
    title: id,
    restaurant: "Test",
    image: "",
    oldPrice: 10,
    newPrice: 5,
    discount: 50,
    distance: "1 km",
    endTime: "20:00",
    rating: 4.5,
    reviews: 10,
    category: "Meals",
    location: {
      address: "Tashkent",
      lat,
      lng,
    },
  }) as Offer;

describe("getOfferMapRegion", () => {
  it("centers the map around all offer coordinates with useful padding", () => {
    expect(
      getOfferMapRegion([
        offer("west", 41.3, 69.2),
        offer("east", 41.4, 69.4),
      ])
    ).toEqual({
      latitude: 41.35,
      latitudeDelta: 0.14,
      longitude: 69.3,
      longitudeDelta: 0.24,
    });
  });

  it("uses a stable Tashkent fallback when there are no offers", () => {
    expect(getOfferMapRegion([])).toEqual({
      latitude: 41.3111,
      latitudeDelta: 0.08,
      longitude: 69.2797,
      longitudeDelta: 0.08,
    });
  });

  it("centers on the user location when nearby filtering has no matching offers", () => {
    expect(getOfferMapRegion([], { lat: 41.32, lng: 69.29 })).toEqual({
      latitude: 41.32,
      latitudeDelta: 0.04,
      longitude: 69.29,
      longitudeDelta: 0.04,
    });
  });

  it("keeps the user location inside the region when offers are filtered nearby", () => {
    expect(
      getOfferMapRegion([offer("north", 41.34, 69.3)], {
        lat: 41.3,
        lng: 69.25,
      })
    ).toEqual({
      latitude: 41.32,
      latitudeDelta: 0.06,
      longitude: 69.275,
      longitudeDelta: 0.06,
    });
  });
});

import { OFFERS } from "@/data/offers";
import { filterAndSortOffers } from "@/lib/filters";
import type { Offer } from "@/types/offer";

const offerAt = (
  id: string,
  lat: number,
  lng: number,
  distance = "99 km"
): Offer => ({
  category: "Meals",
  discount: 50,
  distance,
  endTime: "20:00",
  id,
  image: "",
  location: {
    address: "Tashkent",
    lat,
    lng,
  },
  newPrice: 5,
  oldPrice: 10,
  rating: 4.5,
  restaurant: "Test",
  reviews: 10,
  title: `Offer ${id}`,
});

describe("filterAndSortOffers", () => {
  it("filters by category, favorites, and search query", () => {
    const offers = filterAndSortOffers({
      activeCategory: "Meals",
      favoriteIds: ["3", "5", "8"],
      offers: OFFERS,
      query: "pasta",
      showFavoritesOnly: true,
      sortMode: "expiry",
    });

    expect(offers.map((offer) => offer.id)).toEqual(["5"]);
  });

  it("sorts by distance ascending", () => {
    const offers = filterAndSortOffers({
      activeCategory: "All",
      favoriteIds: [],
      offers: OFFERS.slice(0, 3),
      query: "",
      showFavoritesOnly: false,
      sortMode: "distance",
    });

    expect(offers.map((offer) => offer.id)).toEqual(["1", "2", "3"]);
  });

  it("filters offers by selected radius from the user's coordinates", () => {
    const offers = filterAndSortOffers({
      activeCategory: "All",
      favoriteIds: [],
      offers: [
        offerAt("near", 41.3135, 69.2573),
        offerAt("far", 41.3466, 69.2736),
      ],
      query: "",
      radiusKm: 2,
      showFavoritesOnly: false,
      sortMode: "distance",
      userLocation: { lat: 41.31348, lng: 69.25726 },
    });

    expect(offers.map((offer) => offer.id)).toEqual(["near"]);
  });

  it("uses the offer distance text for radius filtering until device location is available", () => {
    const offers = filterAndSortOffers({
      activeCategory: "All",
      favoriteIds: [],
      offers: [
        offerAt("close", 41.31, 69.27, "0.9 km"),
        offerAt("outside", 41.31, 69.27, "3.1 km"),
      ],
      query: "",
      radiusKm: 3,
      showFavoritesOnly: false,
      sortMode: "distance",
    });

    expect(offers.map((offer) => offer.id)).toEqual(["close"]);
  });
});

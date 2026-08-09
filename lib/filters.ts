import type { Offer, OfferFilterCategory } from "@/types/offer";
import { getOfferDistanceKm, type GeoPoint } from "@/lib/geo";

export type SortMode = "expiry" | "price" | "discount" | "distance";
export type RadiusFilterKm = number | null;

export type FilterAndSortOffersInput = {
  offers: Offer[];
  activeCategory: OfferFilterCategory;
  favoriteIds: string[];
  showFavoritesOnly: boolean;
  query: string;
  radiusKm?: RadiusFilterKm;
  sortMode: SortMode;
  userLocation?: GeoPoint | null;
};

function toMinutes(endTime: string) {
  const [hours, minutes] = endTime.split(":").map(Number);
  return hours * 60 + minutes;
}

export function filterAndSortOffers({
  offers,
  activeCategory,
  favoriteIds,
  showFavoritesOnly,
  query,
  radiusKm = null,
  sortMode,
  userLocation = null,
}: FilterAndSortOffersInput) {
  let result =
    activeCategory === "All"
      ? offers
      : offers.filter((offer) => offer.category === activeCategory);

  if (showFavoritesOnly) {
    result = result.filter((offer) => favoriteIds.includes(offer.id));
  }

  if (query.trim()) {
    const normalizedQuery = query.trim().toLowerCase();
    result = result.filter(
      (offer) =>
        offer.title.toLowerCase().includes(normalizedQuery) ||
        offer.restaurant.toLowerCase().includes(normalizedQuery) ||
        offer.category.toLowerCase().includes(normalizedQuery)
    );
  }

  if (radiusKm) {
    result = result.filter(
      (offer) => getOfferDistanceKm(offer, userLocation) <= radiusKm
    );
  }

  const sorted = [...result];

  switch (sortMode) {
    case "price":
      return sorted.sort((left, right) => left.newPrice - right.newPrice);
    case "discount":
      return sorted.sort((left, right) => right.discount - left.discount);
    case "distance":
      return sorted.sort(
        (left, right) =>
          getOfferDistanceKm(left, userLocation) -
          getOfferDistanceKm(right, userLocation)
      );
    default:
      return sorted.sort(
        (left, right) => toMinutes(left.endTime) - toMinutes(right.endTime)
      );
  }
}

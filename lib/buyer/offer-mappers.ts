import type { MarketplaceOfferStatusV2, MarketplaceOfferV2 } from "@/lib/contracts";
import { distanceBetweenKm, type GeoPoint } from "@/lib/geo";
import type { Offer, OfferCategory } from "@/types/offer";

import { formatShortTime } from "./formatting";

/**
 * Thrown when a MarketplaceOfferV2 arrives with a status this mapper does not
 * recognize. The buyer surface must fail visibly rather than silently render
 * an offer whose availability it cannot interpret, an unrecognized status
 * could otherwise be treated as reservable by accident.
 */
export class UnknownOfferStatusError extends Error {
  constructor(status: string) {
    super(`Unrecognized marketplace offer status: ${status}`);
    this.name = "UnknownOfferStatusError";
  }
}

const KNOWN_OFFER_STATUSES: ReadonlySet<MarketplaceOfferStatusV2> = new Set([
  "live",
  "paused",
  "sold_out",
  "expired",
  "withdrawn",
]);

/**
 * The v2 seller facade accepts a free text category string. The buyer feed
 * filters against the fixed OfferCategory set that the existing card grid,
 * filter chips, and seed data already use. This keyword match is a
 * deliberately simple normalization, closest match wins and unmatched
 * categories fall back to Groceries, which fits the Shop Seller packaged
 * goods focus of the beta. A future contract change could carry the buyer
 * facing category directly and remove this mapping.
 */
export function normalizeOfferCategory(rawCategory: string): OfferCategory {
  const normalized = rawCategory.trim().toLowerCase();

  if (/(surprise)/.test(normalized)) {
    return "Surprise Bags";
  }
  if (/(bak|bread|pastry)/.test(normalized)) {
    return "Baked Goods";
  }
  if (/(vegan|vegetarian|plant)/.test(normalized)) {
    return "Vegan";
  }
  if (/(meal|prepared|kitchen|dish)/.test(normalized)) {
    return "Meals";
  }
  return "Groceries";
}

export interface MapMarketplaceOfferV2Options {
  userLocation?: GeoPoint | null;
}

/**
 * Maps the coordinator owned public offer contract onto the existing Offer
 * view model so the feed, favorites, map, and card components can be reused
 * unchanged for pilot mode. Only public MarketplaceOfferV2 fields are read,
 * this function has no access to private stock, confidence, supplier, or
 * staff data because the input type never carries it.
 */
export function mapMarketplaceOfferV2ToOffer(
  offer: MarketplaceOfferV2,
  options: MapMarketplaceOfferV2Options = {}
): Offer {
  if (!KNOWN_OFFER_STATUSES.has(offer.status)) {
    throw new UnknownOfferStatusError(offer.status);
  }

  const newPrice = offer.offerPriceUzs;
  const hasSupportedReference =
    typeof offer.referencePriceUzs === "number" && offer.referencePriceUzs > 0;
  const oldPrice = hasSupportedReference ? (offer.referencePriceUzs as number) : newPrice;
  const discount = hasSupportedReference ? (offer.discountPercent ?? 0) : 0;

  const userLocation = options.userLocation ?? null;
  const distance = userLocation
    ? `${distanceBetweenKm(userLocation, {
        lat: offer.latitude,
        lng: offer.longitude,
      }).toFixed(1)} km`
    : "";

  return {
    id: offer.id,
    title: offer.title,
    restaurant: offer.storeName,
    image: offer.imageUrl ?? "",
    oldPrice,
    newPrice,
    discount,
    distance,
    endTime: formatShortTime(offer.pickupEnd, offer.timezone),
    pickupStart: formatShortTime(offer.pickupStart, offer.timezone),
    rating: 0,
    reviews: 0,
    category: normalizeOfferCategory(offer.category),
    location: {
      lat: offer.latitude,
      lng: offer.longitude,
      address: offer.storeAddress,
    },
    quantityAvailable: offer.quantityAvailable,
    contents: [...offer.contents],
    allergens: [...offer.allergens],
    cancellationPolicy: offer.cancellationPolicy ?? undefined,
    dietaryBadges: [...offer.dietaryBadges],
    pickupInstructions: offer.pickupInstructions ?? undefined,
    sellerId: offer.storeId,
    source: "seller",
    businessType: "shop",
    isSurpriseBag: normalizeOfferCategory(offer.category) === "Surprise Bags",
  };
}

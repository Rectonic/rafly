import type { Locale } from "@/i18n/types";

export type OfferCategory =
  | "Meals"
  | "Baked Goods"
  | "Groceries"
  | "Vegan"
  | "Surprise Bags";

export type OfferFilterCategory = "All" | OfferCategory;

export interface OfferLocation {
  lat: number;
  lng: number;
  address: string;
}

export type LocalizedOfferContent = Partial<
  Record<
    Locale,
    {
      contents?: string[];
      allergens?: string[];
      cancellationPolicy?: string;
      dietaryBadges?: string[];
      locationAddress?: string;
      pickupInstructions?: string;
      restaurant?: string;
      title?: string;
    }
  >
>;

export interface Offer {
  id: string;
  title: string;
  restaurant: string;
  image: string;
  oldPrice: number;
  newPrice: number;
  discount: number;
  distance: string;
  endTime: string;
  rating: number;
  reviews: number;
  category: OfferCategory;
  location: OfferLocation;
  contents?: string[];
  allergens?: string[];
  cancellationPolicy?: string;
  dietaryBadges?: string[];
  pickupInstructions?: string;
  pickupStart?: string;
  quantityAvailable?: number;
  sellerId?: string;
  source?: "seed" | "seller";
  businessType?: "restaurant" | "shop" | "bakery";
  expiryDate?: string;
  isSurpriseBag?: boolean;
  translations?: LocalizedOfferContent;
}

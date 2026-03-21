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
  pickupStart?: string;
  quantityAvailable?: number;
  source?: "seed" | "seller";
  businessType?: "restaurant" | "shop" | "bakery";
  expiryDate?: string;
  isSurpriseBag?: boolean;
}

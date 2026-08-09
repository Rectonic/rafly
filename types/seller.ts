import type { Locale } from "@/i18n/types";
import type { LocalizedOfferContent, OfferCategory } from "@/types/offer";

export type SellerBusinessType = "restaurant" | "shop";

export type LocalizedSellerProfileContent = Partial<
  Record<
    Locale,
    {
      address?: string;
      businessName?: string;
      category?: string;
    }
  >
>;

export interface SellerProfile {
  id: string;
  email: string;
  businessName: string;
  businessType: SellerBusinessType;
  category: string;
  address: string;
  latitude: number;
  longitude: number;
  rating: number;
  reviews: number;
  createdAt: string;
  updatedAt: string;
  translations?: LocalizedSellerProfileContent;
}

export interface InventoryItem {
  id: string;
  sellerId: string;
  productName: string;
  barcode: string;
  expiryDate: string;
  quantity: number;
  source: "camera" | "image" | "manual";
  ocrText?: string;
  createdAt: string;
}

export interface SellerOffer {
  id: string;
  sellerId: string;
  title: string;
  businessName: string;
  category: OfferCategory;
  image: string | null;
  oldPrice: number;
  newPrice: number;
  discount: number;
  distanceText: string;
  pickupStart: string | null;
  pickupEnd: string;
  quantityAvailable: number;
  contents: string[];
  allergens?: string[];
  cancellationPolicy?: string;
  dietaryBadges?: string[];
  pickupInstructions?: string;
  source: string;
  businessType: SellerBusinessType;
  latitude: number;
  longitude: number;
  address: string;
  rating: number;
  reviews: number;
  status: "draft" | "published" | "sold_out";
  publishedAt: string;
  translations?: LocalizedOfferContent;
}

export interface PickupOrder {
  id: string;
  sellerId: string;
  offerId: string | null;
  customerName: string;
  offerTitle: string;
  reservationCode: string;
  pickupWindow: string;
  total: number;
  status: "pending" | "collected" | "cancelled";
  createdAt: string;
}

export interface MealPackageDraft {
  title: string;
  category: OfferCategory;
  oldPrice: string;
  newPrice: string;
  quantity: string;
  pickupStart: string;
  pickupEnd: string;
  image: string;
  contentsText: string;
  allergensText: string;
  cancellationPolicy: string;
  dietaryBadgesText: string;
  pickupInstructions: string;
  isSurpriseBag: boolean;
  translations?: Partial<
    Record<
      Locale,
      {
        contentsText?: string;
        title?: string;
      }
    >
  >;
}

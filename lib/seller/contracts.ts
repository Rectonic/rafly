import type { LocalizedOfferContent, OfferCategory } from "@/types/offer";
import type {
  LocalizedSellerProfileContent,
  SellerBusinessType,
} from "@/types/seller";

export type CreateInventoryItemInput = {
  productName: string;
  barcode: string;
  expiryDate: string;
  quantity: number;
  source: "camera" | "image" | "manual";
  ocrText?: string;
};

export type CreateSellerOfferInput = {
  title: string;
  category: OfferCategory;
  image: string | null;
  oldPrice: number;
  newPrice: number;
  pickupStart: string | null;
  pickupEnd: string;
  quantityAvailable: number;
  contents: string[];
  allergens?: string[];
  cancellationPolicy?: string;
  dietaryBadges?: string[];
  pickupInstructions?: string;
  translations?: LocalizedOfferContent;
};

export type VerifyPickupOrderInput = {
  reservationCode: string;
};

export type UpdateSellerProfileInput = {
  businessName: string;
  businessType: SellerBusinessType;
  category: string;
  address: string;
  latitude: number;
  longitude: number;
  translations?: LocalizedSellerProfileContent;
};

import type { Offer, OfferCategory } from "@/types/offer";

export type SellerBusinessType = "restaurant" | "shop";

export interface SellerProfile {
  id: string;
  email: string;
  businessName: string;
  businessType: SellerBusinessType;
  category: string;
  address: string;
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  rating: number;
  reviews: number;
  createdAt: string;
  updatedAt: string;
}

export interface SellerInventoryItem {
  id: string;
  productName: string;
  barcode: string;
  expiryDate: string;
  quantity: number;
  source: "camera" | "image" | "manual";
  ocrText?: string;
  createdAt: string;
}

export interface SellerPickupOrder {
  id: string;
  customerName: string;
  offerTitle: string;
  reservationCode: string;
  pickupWindow: string;
  total: number;
  status: "pending" | "collected";
}

export interface SellerWorkspaceState {
  profile: SellerProfile | null;
  inventory: SellerInventoryItem[];
  publishedOffers: Offer[];
  pickupOrders: SellerPickupOrder[];
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
}

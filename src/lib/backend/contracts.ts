import type { Offer, OfferCategory } from "@/types/offer";
import type {
  SellerInventoryItem,
  SellerPickupOrder,
  SellerProfile,
} from "@/types/seller";

export type SellerProfileRecord = SellerProfile;

export type InventoryItemRecord = SellerInventoryItem & {
  sellerId: string;
};

export type SellerOfferRecord = Offer & {
  sellerId: string;
  status: "draft" | "published" | "sold_out";
  publishedAt: string;
};

export type PickupOrderRecord = SellerPickupOrder & {
  sellerId: string;
  offerId: string;
  createdAt: string;
};

export type SellerWorkspaceSnapshot = {
  profile: SellerProfileRecord | null;
  inventory: InventoryItemRecord[];
  publishedOffers: SellerOfferRecord[];
  pickupOrders: PickupOrderRecord[];
};

export type CreateInventoryItemInput = Pick<
  InventoryItemRecord,
  "productName" | "barcode" | "expiryDate" | "quantity" | "source" | "ocrText"
>;

export type CreateSellerOfferInput = Pick<
  SellerOfferRecord,
  | "title"
  | "image"
  | "oldPrice"
  | "newPrice"
  | "pickupStart"
  | "endTime"
  | "quantityAvailable"
  | "contents"
> & {
  category: OfferCategory;
};

export type VerifyPickupOrderInput = {
  reservationCode: string;
};

export type UpdateSellerProfileInput = Pick<
  SellerProfile,
  "businessName" | "businessType" | "category" | "address"
> & {
  latitude: number;
  longitude: number;
};

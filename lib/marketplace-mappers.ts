import type { LocalizedOfferContent, Offer } from "@/types/offer";

export type PublishedSellerOfferRow = {
  id: string;
  title: string;
  business_name: string;
  image: string | null;
  old_price: number;
  new_price: number;
  discount: number;
  distance_text: string;
  pickup_start: string | null;
  pickup_end: string;
  rating: number;
  reviews: number;
  category: Offer["category"];
  seller_id: string;
  latitude: number;
  longitude: number;
  address: string;
  quantity_available: number;
  contents: string[] | null;
  allergens?: string[] | null;
  cancellation_policy?: string | null;
  dietary_badges?: string[] | null;
  pickup_instructions?: string | null;
  source: "seed" | "seller" | null;
  business_type: Offer["businessType"] | null;
  translations?: LocalizedOfferContent | null;
};

export function mapPublishedSellerOfferToOffer(
  row: PublishedSellerOfferRow
): Offer {
  return {
    id: row.id,
    title: row.title,
    restaurant: row.business_name,
    image: row.image ?? "",
    oldPrice: Number(row.old_price),
    newPrice: Number(row.new_price),
    discount: row.discount,
    distance: row.distance_text,
    endTime: row.pickup_end,
    pickupStart: row.pickup_start ?? undefined,
    rating: Number(row.rating),
    reviews: row.reviews,
    sellerId: row.seller_id,
    category: row.category,
    location: {
      lat: row.latitude,
      lng: row.longitude,
      address: row.address,
    },
    quantityAvailable: row.quantity_available,
    contents: row.contents ?? [],
    allergens: row.allergens ?? undefined,
    cancellationPolicy: row.cancellation_policy ?? undefined,
    dietaryBadges: row.dietary_badges ?? undefined,
    pickupInstructions: row.pickup_instructions ?? undefined,
    source: row.source ?? "seller",
    businessType: row.business_type ?? "restaurant",
    translations: row.translations ?? undefined,
  };
}

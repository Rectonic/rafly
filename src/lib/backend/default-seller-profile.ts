import type { SellerBusinessType, SellerProfile } from "@/types/seller";

export const DEFAULT_SELLER_AVATAR =
  "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=160&q=80";

export const DEFAULT_SELLER_PROFILE_VALUES = {
  businessName: "The Daily Crumb",
  businessType: "restaurant" as SellerBusinessType,
  category: "Bakery",
  address: "Shaykhontohur District, Tashkent",
  latitude: 41.31348,
  longitude: 69.25726,
  rating: 4.8,
  reviews: 124,
};

export function buildFallbackSellerProfile(email = "seller@lastbite.app"): SellerProfile {
  return {
    id: "local-seller",
    email,
    businessName: DEFAULT_SELLER_PROFILE_VALUES.businessName,
    businessType: DEFAULT_SELLER_PROFILE_VALUES.businessType,
    category: DEFAULT_SELLER_PROFILE_VALUES.category,
    address: DEFAULT_SELLER_PROFILE_VALUES.address,
    location: {
      lat: DEFAULT_SELLER_PROFILE_VALUES.latitude,
      lng: DEFAULT_SELLER_PROFILE_VALUES.longitude,
      address: DEFAULT_SELLER_PROFILE_VALUES.address,
    },
    rating: DEFAULT_SELLER_PROFILE_VALUES.rating,
    reviews: DEFAULT_SELLER_PROFILE_VALUES.reviews,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
}

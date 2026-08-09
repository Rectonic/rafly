import type { SellerProfile } from "@/types/seller";

export const DEFAULT_SELLER_PROFILE_VALUES = {
  address: "Shaykhontohur District, Tashkent",
  businessName: "LastBite Demo Seller",
  businessType: "restaurant" as const,
  category: "Bakery",
  email: "seller@lastbite.local",
  latitude: 41.31348,
  longitude: 69.25726,
  rating: 4.7,
  reviews: 124,
};

export function buildFallbackSellerProfile(
  overrides: Partial<SellerProfile> = {}
): SellerProfile {
  const now = new Date().toISOString();

  return {
    id: overrides.id ?? "local-seller",
    email: overrides.email ?? DEFAULT_SELLER_PROFILE_VALUES.email,
    businessName:
      overrides.businessName ?? DEFAULT_SELLER_PROFILE_VALUES.businessName,
    businessType:
      overrides.businessType ?? DEFAULT_SELLER_PROFILE_VALUES.businessType,
    category: overrides.category ?? DEFAULT_SELLER_PROFILE_VALUES.category,
    address: overrides.address ?? DEFAULT_SELLER_PROFILE_VALUES.address,
    latitude: overrides.latitude ?? DEFAULT_SELLER_PROFILE_VALUES.latitude,
    longitude: overrides.longitude ?? DEFAULT_SELLER_PROFILE_VALUES.longitude,
    rating: overrides.rating ?? DEFAULT_SELLER_PROFILE_VALUES.rating,
    reviews: overrides.reviews ?? DEFAULT_SELLER_PROFILE_VALUES.reviews,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

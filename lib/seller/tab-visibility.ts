import type { SellerBusinessType } from "@/types/seller";

export function getSellerTabVisibility(businessType: SellerBusinessType) {
  return {
    create: businessType === "restaurant",
    inventory: businessType === "shop",
  };
}

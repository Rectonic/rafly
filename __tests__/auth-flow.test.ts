import {
  createMissingSupabaseConfigurationError,
  getPostSignInRoute,
} from "@/lib/seller/auth-flow";
import type { SellerProfile } from "@/types/seller";

describe("getPostSignInRoute", () => {
  it("routes complete seller profiles to the seller tabs", () => {
    expect(getPostSignInRoute({ id: "seller-1" } as SellerProfile)).toBe(
      "/(seller-tabs)"
    );
  });

  it("routes authenticated sellers without a profile to onboarding", () => {
    expect(getPostSignInRoute(null)).toBe("/auth/business-type");
  });
});

describe("createMissingSupabaseConfigurationError", () => {
  it("returns the actionable missing environment message", () => {
    expect(createMissingSupabaseConfigurationError().message).toContain(
      "EXPO_PUBLIC_SUPABASE_URL"
    );
  });
});

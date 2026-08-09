import { useCallback, useMemo, useState } from "react";

import { useAuth } from "@/lib/seller/auth-store";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { UpdateSellerProfileInput } from "@/lib/seller/contracts";

export function useSellerProfile() {
  const { refreshSellerProfile, sellerProfile, session } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateProfile = useCallback(
    async (input: UpdateSellerProfileInput) => {
      if (!isSupabaseConfigured() || !supabase || !session?.user) {
        const missingConfigError = new Error(
          "Supabase is not configured. Add the Expo public env vars first."
        );
        setError(missingConfigError.message);
        throw missingConfigError;
      }

      setIsLoading(true);
      setError(null);

      const { error: updateError } = await supabase
        .from("seller_profiles")
        .update({
          address: input.address,
          business_name: input.businessName,
          business_type: input.businessType,
          category: input.category,
          latitude: input.latitude,
          longitude: input.longitude,
          translations: input.translations ?? {},
        })
        .eq("id", session.user.id);

      if (updateError) {
        setError(updateError.message);
        setIsLoading(false);
        throw updateError;
      }

      await refreshSellerProfile();
      setIsLoading(false);
    },
    [refreshSellerProfile, session?.user]
  );

  return useMemo(
    () => ({
      error,
      isLoading,
      profile: sellerProfile,
      updateProfile,
    }),
    [error, isLoading, sellerProfile, updateProfile]
  );
}

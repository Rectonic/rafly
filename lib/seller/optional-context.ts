import { useContext } from "react";

import { ApiContext, type SellerStoreApiV2 } from "@/lib/api";

/**
 * Task 7 mounts ApiProvider at the app root. Until then, and in any test
 * that does not wrap a screen with it, seller v2 screens must behave like
 * today's v1 only experience rather than throw. This optional accessor
 * returns null instead of throwing so every seller v2 hook can branch to
 * hiding the beta surface when the coordinator provider is absent, the
 * same idiom lib/buyer/optional-context.ts established for the buyer side.
 */
export function useOptionalSellerApi(): SellerStoreApiV2 | null {
  const context = useContext(ApiContext);
  return context ? context.sellerApi : null;
}

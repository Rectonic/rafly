import { useContext } from "react";

import { ApiContext, type BuyerMarketplaceApiV2 } from "@/lib/api";
import { useFeatureFlags } from "@/lib/feature-flags";

/**
 * Task 7 mounts ApiProvider and FeatureFlagsProvider at the app root. Until
 * then, and in any test that does not wrap a screen with them, buyer v2
 * screens must behave exactly like today's demo and v1 experience rather
 * than crash. These optional accessors return null instead of throwing so
 * every buyer v2 hook can branch to the legacy path when the coordinator
 * providers are absent.
 */

export function useOptionalBuyerApi(): BuyerMarketplaceApiV2 | null {
  const context = useContext(ApiContext);
  return context ? context.buyerApi : null;
}

export type OptionalFeatureFlagsState = ReturnType<typeof useFeatureFlags>;

export function useOptionalFlags(): OptionalFeatureFlagsState | null {
  try {
    // useFeatureFlags itself only calls useContext before it may throw, so
    // this hook still executes React hooks unconditionally on every render,
    // the try/catch only decides what optional-context returns afterward.
    return useFeatureFlags();
  } catch {
    return null;
  }
}

/**
 * The single boolean every buyer v2 screen branches on. True only once both
 * providers are mounted and the coordinator flag resolved to pilot. Screens
 * that only need to know which UI to show, not the live feed itself, use
 * this instead of useBuyerMarketplaceFeedV2 so they do not trigger an
 * unrelated list fetch just to answer "which mode am I in".
 */
export function useIsPilotMode(): boolean {
  const api = useOptionalBuyerApi();
  const flagsState = useOptionalFlags();
  return Boolean(api) && flagsState?.flags.marketplaceMode === "pilot";
}

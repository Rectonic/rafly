import { useCallback, useEffect, useRef, useState } from "react";

import type { MarketplaceOfferV2 } from "@/lib/contracts";

import { useOptionalBuyerApi, useOptionalFlags } from "./optional-context";

export interface BuyerMarketplaceFeedV2State {
  /**
   * True only when both a FeatureFlagsProvider resolved marketplaceMode to
   * pilot and an ApiProvider is mounted. Screens use this single flag to
   * decide between the v2 live feed and the existing demo and v1 path,
   * pilot and demo supply are never combined.
   */
  isPilot: boolean;
  isLoading: boolean;
  error: string | null;
  offers: MarketplaceOfferV2[];
  refresh: () => Promise<void>;
}

/**
 * Buyer v2 live feed. Demo mode, a missing ApiProvider, or a missing
 * FeatureFlagsProvider all resolve to the same legacy behavior, an empty v2
 * offer list with no request made, so the calling screen can keep rendering
 * seeds and v1 published offers exactly as it does today. Pilot mode only
 * ever reads from listMarketplaceOffersV2, a failed request surfaces its
 * message and leaves the offer list empty rather than inventing a seed
 * fallback.
 */
export function useBuyerMarketplaceFeedV2(): BuyerMarketplaceFeedV2State {
  const api = useOptionalBuyerApi();
  const flagsState = useOptionalFlags();
  const isPilot = Boolean(api) && flagsState?.flags.marketplaceMode === "pilot";

  const [offers, setOffers] = useState<MarketplaceOfferV2[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSequenceRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!api || !isPilot) {
      setOffers([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    const requestId = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestId;
    setIsLoading(true);
    setError(null);

    const result = await api.listMarketplaceOffersV2();

    if (requestId !== requestSequenceRef.current) {
      // A newer refresh or a mode flip started after this request, its
      // result is stale and must not overwrite the current state.
      return;
    }

    if (result.ok) {
      setOffers(result.value);
      setError(null);
    } else {
      setOffers([]);
      setError(result.error.message);
    }
    setIsLoading(false);
  }, [api, isPilot]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { error, isLoading, isPilot, offers, refresh };
}

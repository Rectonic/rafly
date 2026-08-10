import { useCallback, useEffect, useRef, useState } from "react";

import type { CommandError, MarketplaceOfferV2, Result } from "@/lib/contracts";

import { useOptionalBuyerApi, useIsPilotMode } from "./optional-context";

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
  const isPilot = useIsPilotMode();

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

export interface BuyerMarketplaceOfferV2State {
  isPilot: boolean;
  isLoading: boolean;
  error: CommandError | null;
  offer: MarketplaceOfferV2 | null;
  refresh: () => Promise<Result<MarketplaceOfferV2> | null>;
}

/**
 * Buyer v2 single offer detail. Used for the offer detail screen and for
 * refreshing authoritative offer data, for example after a stale
 * expectedOfferVersion is rejected during a reservation attempt. A refresh
 * error keeps the last known offer on screen instead of clearing it, so a
 * transient failure while the buyer is already looking at an offer does not
 * blank the page, the error is still surfaced through the error field.
 */
export function useBuyerMarketplaceOfferV2(
  offerId: string | undefined
): BuyerMarketplaceOfferV2State {
  const api = useOptionalBuyerApi();
  const isPilot = useIsPilotMode();

  const [offer, setOffer] = useState<MarketplaceOfferV2 | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<CommandError | null>(null);
  const requestSequenceRef = useRef(0);

  const refresh = useCallback(async (): Promise<Result<MarketplaceOfferV2> | null> => {
    if (!api || !isPilot || !offerId) {
      setOffer(null);
      setError(null);
      setIsLoading(false);
      return null;
    }

    const requestId = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestId;
    setIsLoading(true);
    setError(null);

    const result = await api.getMarketplaceOfferV2(offerId);

    if (requestId !== requestSequenceRef.current) {
      return result;
    }

    if (result.ok) {
      setOffer(result.value);
      setError(null);
    } else {
      setError(result.error);
    }
    setIsLoading(false);
    return result;
  }, [api, isPilot, offerId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { error, isLoading, isPilot, offer, refresh };
}

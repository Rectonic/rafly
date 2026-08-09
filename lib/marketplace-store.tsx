import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

import {
  mapPublishedSellerOfferToOffer,
  type PublishedSellerOfferRow,
} from "@/lib/marketplace-mappers";
import type { Offer } from "@/types/offer";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type MarketplaceContextValue = {
  error: string | null;
  isLoading: boolean;
  publishedOffers: Offer[];
  refreshPublishedOffers: () => Promise<void>;
};

const MarketplaceContext = createContext<MarketplaceContextValue | null>(null);

export function MarketplaceProvider({ children }: PropsWithChildren) {
  const [publishedOffers, setPublishedOffers] = useState<Offer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshPublishedOffers = useCallback(async () => {
    if (!isSupabaseConfigured() || !supabase) {
      setPublishedOffers([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const { data, error: loadError } = await supabase
        .from("seller_offers")
        .select(
          [
            "id",
            "title",
            "business_name",
            "seller_id",
            "image",
            "old_price",
            "new_price",
            "discount",
            "distance_text",
            "pickup_start",
            "pickup_end",
            "rating",
            "reviews",
            "category",
            "latitude",
            "longitude",
            "address",
            "quantity_available",
            "contents",
            "allergens",
            "cancellation_policy",
            "dietary_badges",
            "pickup_instructions",
            "source",
            "business_type",
            "translations",
          ].join(",")
        )
        .eq("status", "published");

      if (loadError) {
        setError(loadError.message);
        return;
      }

      setPublishedOffers(
        (data ?? []).map((row) =>
          mapPublishedSellerOfferToOffer(
            row as unknown as PublishedSellerOfferRow
          )
        )
      );
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load seller offers."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshPublishedOffers();
  }, [refreshPublishedOffers]);

  const value = useMemo(
    () => ({
      error,
      isLoading,
      publishedOffers,
      refreshPublishedOffers,
    }),
    [error, isLoading, publishedOffers, refreshPublishedOffers]
  );

  return (
    <MarketplaceContext.Provider value={value}>
      {children}
    </MarketplaceContext.Provider>
  );
}

function useMarketplaceContext() {
  const value = useContext(MarketplaceContext);

  if (!value) {
    throw new Error("MarketplaceProvider is missing.");
  }

  return value;
}

export function usePublishedSellerOffers() {
  return useMarketplaceContext().publishedOffers;
}

export function useMarketplaceState() {
  return useMarketplaceContext();
}

export function useRefreshPublishedSellerOffers() {
  return useMarketplaceContext().refreshPublishedOffers;
}

import { act, renderHook, waitFor } from "@testing-library/react-native";
import React, { type ReactNode } from "react";

import {
  MarketplaceProvider,
  useMarketplaceState,
} from "@/lib/marketplace-store";

let mockIsSupabaseConfigured = true;
let mockSupabase: unknown = null;

jest.mock("@/lib/supabase", () => ({
  get supabase() {
    return mockSupabase;
  },
  isSupabaseConfigured: () => mockIsSupabaseConfigured,
}));

function wrapper({ children }: { children: ReactNode }) {
  return <MarketplaceProvider>{children}</MarketplaceProvider>;
}

function makeSellerOfferRow(id: string, title: string) {
  return {
    address: "12 Market Street",
    business_name: "Night Bakery",
    business_type: "shop",
    category: "Baked Goods",
    contents: ["Pastries"],
    discount: 50,
    distance_text: "0.4 km",
    id,
    image: "",
    latitude: 41.31,
    longitude: 69.27,
    new_price: 5,
    old_price: 10,
    pickup_end: "20:30",
    pickup_start: null,
    quantity_available: 3,
    rating: 4.8,
    reviews: 42,
    seller_id: "seller-1",
    source: "seller",
    title,
    translations: {},
  };
}

describe("MarketplaceProvider", () => {
  beforeEach(() => {
    mockIsSupabaseConfigured = true;
    mockSupabase = null;
  });

  it("preserves stale seller offers and exposes a retryable error after refresh failure", async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({
        data: [makeSellerOfferRow("seller-offer-1", "Evening pastry bag")],
        error: null,
      })
      .mockRejectedValueOnce(new Error("Network unavailable"));
    const select = jest.fn(() => ({
      eq: query,
    }));
    mockSupabase = {
      from: jest.fn(() => ({
        select,
      })),
    };

    const { result } = renderHook(() => useMarketplaceState(), { wrapper });

    await waitFor(() =>
      expect(result.current.publishedOffers).toHaveLength(1)
    );
    expect(result.current.error).toBeNull();

    await act(async () => {
      await result.current.refreshPublishedOffers();
    });

    expect(result.current.publishedOffers).toHaveLength(1);
    expect(result.current.publishedOffers[0].title).toBe("Evening pastry bag");
    expect(result.current.error).toBe("Network unavailable");
    expect(result.current.isLoading).toBe(false);
  });
});

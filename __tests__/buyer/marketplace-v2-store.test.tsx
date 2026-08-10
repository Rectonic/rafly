import { act, renderHook, waitFor } from "@testing-library/react-native";
import { createElement, type ReactNode } from "react";

import { ApiProvider } from "@/lib/api";
import type { FeatureFlagsV2, PublishOfferV2Input } from "@/lib/contracts";
import { FeatureFlagsProvider, useFeatureFlags } from "@/lib/feature-flags";
import {
  InMemoryStoreCore,
  makeDefaultScenario,
  type DefaultScenario,
} from "@/lib/test-kit";

import { useBuyerMarketplaceFeedV2 } from "@/lib/buyer/marketplace-v2-store";

function publishInputFor(
  scenario: DefaultScenario,
  overrides: Partial<PublishOfferV2Input> = {}
): PublishOfferV2Input {
  return {
    storeId: scenario.storeId,
    idempotencyKey: "publish-key-1",
    allocation: {
      storeProductId: scenario.highConfidenceProductId,
      quantity: 2,
      physicallySetAside: false,
    },
    title: "Bakery rescue box",
    category: "bakery",
    imageUrl: null,
    contents: ["bread", "pastry"],
    offerPriceUzs: 20000,
    referencePriceUzs: 50000,
    pickupStart: scenario.pickupStart,
    pickupEnd: scenario.pickupEnd,
    allergens: ["gluten"],
    dietaryBadges: ["vegetarian"],
    pickupInstructions: "Ask at the counter",
    cancellationPolicy: "Cancel before pickup start",
    ...overrides,
  };
}

function makeWorld() {
  const core = new InMemoryStoreCore();
  const scenario = makeDefaultScenario(core);
  const seller = core.sellerApi({ userId: scenario.managerUserId });
  return { core, scenario, seller };
}

function makeWrapper(
  source: () => Promise<FeatureFlagsV2>,
  core: InMemoryStoreCore,
  scenario: DefaultScenario
) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      FeatureFlagsProvider,
      { source },
      createElement(
        ApiProvider,
        {
          buyerApi: core.buyerApi(),
          sellerApi: core.sellerApi({ userId: scenario.managerUserId }),
        },
        children
      )
    );
  };
}

function pilotSource(): Promise<FeatureFlagsV2> {
  return Promise.resolve({ marketplaceMode: "pilot" });
}

function demoSource(): Promise<FeatureFlagsV2> {
  return Promise.resolve({ marketplaceMode: "demo" });
}

describe("useBuyerMarketplaceFeedV2", () => {
  it("shows no v2 offers in demo mode, matching demo showing seeds instead", async () => {
    const { core, scenario, seller } = makeWorld();
    await seller.approveAndPublishOfferV2(publishInputFor(scenario));

    const { result } = renderHook(() => useBuyerMarketplaceFeedV2(), {
      wrapper: makeWrapper(demoSource, core, scenario),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isPilot).toBe(false);
    expect(result.current.offers).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("shows only live v2 offers in pilot mode and never mixes in seed data", async () => {
    const { core, scenario, seller } = makeWorld();
    const published = await seller.approveAndPublishOfferV2(publishInputFor(scenario));
    if (!published.ok) throw new Error("expected publish to succeed");

    const { result } = renderHook(() => useBuyerMarketplaceFeedV2(), {
      wrapper: makeWrapper(pilotSource, core, scenario),
    });

    await waitFor(() => expect(result.current.offers).toHaveLength(1));

    expect(result.current.isPilot).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.offers[0].id).toBe(published.value.id);
    expect(result.current.error).toBeNull();
  });

  it("shows an honest error and never falls back to seed offers when the live API fails", async () => {
    const { core, scenario } = makeWorld();
    const failingBuyerApi = {
      ...core.buyerApi(),
      listMarketplaceOffersV2: async () =>
        ({
          ok: false,
          error: {
            code: "network_error" as const,
            message: "Network unavailable",
            retryable: true,
          },
        }) as const,
    };

    function Wrapper({ children }: { children: ReactNode }) {
      return createElement(
        FeatureFlagsProvider,
        { source: pilotSource },
        createElement(
          ApiProvider,
          {
            buyerApi: failingBuyerApi,
            sellerApi: core.sellerApi({ userId: scenario.managerUserId }),
          },
          children
        )
      );
    }

    const { result } = renderHook(() => useBuyerMarketplaceFeedV2(), {
      wrapper: Wrapper,
    });

    await waitFor(() =>
      expect(result.current.error).toBe("Network unavailable")
    );

    expect(result.current.offers).toEqual([]);
    expect(result.current.isLoading).toBe(false);

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.error).toBe("Network unavailable");
    expect(result.current.offers).toEqual([]);
  });

  it("clears cached pilot supply the moment the mode flips back to demo", async () => {
    const { core, scenario, seller } = makeWorld();
    await seller.approveAndPublishOfferV2(publishInputFor(scenario));

    const source = jest
      .fn<Promise<FeatureFlagsV2>, []>()
      .mockResolvedValueOnce({ marketplaceMode: "pilot" });

    function useCombined() {
      const flags = useFeatureFlags();
      const feed = useBuyerMarketplaceFeedV2();
      return { feed, flags };
    }

    const { result } = renderHook(() => useCombined(), {
      wrapper: makeWrapper(source, core, scenario),
    });

    await waitFor(() => expect(result.current.feed.offers).toHaveLength(1));

    source.mockResolvedValueOnce({ marketplaceMode: "demo" });
    await act(async () => {
      result.current.flags.reload();
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(result.current.flags.flags.marketplaceMode).toBe("demo")
    );
    expect(result.current.feed.offers).toEqual([]);
    expect(result.current.feed.isPilot).toBe(false);
  });

  it("degrades to the legacy path when the coordinator providers are not mounted", () => {
    const { result } = renderHook(() => useBuyerMarketplaceFeedV2());

    expect(result.current.isPilot).toBe(false);
    expect(result.current.offers).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });
});

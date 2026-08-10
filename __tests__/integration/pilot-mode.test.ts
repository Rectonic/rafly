import { act, renderHook, waitFor } from "@testing-library/react-native";
import { createElement, type ReactNode } from "react";

import type { BuyerMarketplaceApiV2, SellerStoreApiV2 } from "@/lib/api";
import { ApiProvider } from "@/lib/api";
import { useBuyerMarketplaceFeedV2 } from "@/lib/buyer/marketplace-v2-store";
import type { FeatureFlagsV2, MarketplaceModeV2 } from "@/lib/contracts";
import { FeatureFlagsProvider, useFeatureFlags, type FlagSourceV2 } from "@/lib/feature-flags";
import { InMemoryStoreCore, makeDefaultScenario, type DefaultScenario } from "@/lib/test-kit";

/**
 * Pilot mode flag proof.
 *
 * useFeatureFlags.test.ts already pins the provider's own internal state
 * machine (loading, ready, failed) in isolation. This file proves the thing
 * that actually matters to a buyer: what the live supply hook a real screen
 * renders off of does in response to that state, driven through one real
 * InMemoryStoreCore that always has a live offer sitting in it. Fail closed
 * is only a real guarantee if a component consuming the flags, not the
 * provider alone, ends up on demo behavior in every failure shape.
 */

function pilotSource(): Promise<FeatureFlagsV2> {
  return Promise.resolve({ marketplaceMode: "pilot" });
}

function erroringSource(): Promise<FeatureFlagsV2> {
  return Promise.reject(new Error("flag source network failure"));
}

function throwingSource(): Promise<FeatureFlagsV2> {
  throw new Error("flag source synchronous failure");
}

function makeWorld() {
  const core = new InMemoryStoreCore();
  const scenario = makeDefaultScenario(core);
  const manager = core.sellerApi({ userId: scenario.managerUserId });
  return { core, manager, scenario };
}

async function publishLiveOffer(manager: SellerStoreApiV2, scenario: DefaultScenario) {
  const result = await manager.approveAndPublishOfferV2({
    allergens: [],
    allocation: {
      physicallySetAside: false,
      quantity: 3,
      storeProductId: scenario.highConfidenceProductId,
    },
    cancellationPolicy: null,
    category: "bakery",
    contents: ["bread"],
    dietaryBadges: [],
    idempotencyKey: "pilot-mode-proof-publish",
    imageUrl: null,
    offerPriceUzs: 15000,
    pickupEnd: scenario.pickupEnd,
    pickupInstructions: null,
    pickupStart: scenario.pickupStart,
    referencePriceUzs: 30000,
    storeId: scenario.storeId,
    title: "Live pilot supply",
  });
  if (!result.ok) {
    throw new Error(`expected the fixture publish to succeed, received ${result.error.code}`);
  }
  return result.value;
}

/** ApiProvider only, no FeatureFlagsProvider anywhere in the tree. */
function apiOnlyWrapper(buyerApi: BuyerMarketplaceApiV2, sellerApi: SellerStoreApiV2) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(ApiProvider, { buyerApi, sellerApi }, children);
  };
}

/** The real app root shape, FeatureFlagsProvider above ApiProvider. */
function flagsAndApiWrapper(
  source: FlagSourceV2,
  buyerApi: BuyerMarketplaceApiV2,
  sellerApi: SellerStoreApiV2
) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      FeatureFlagsProvider,
      { source },
      createElement(ApiProvider, { buyerApi, sellerApi }, children)
    );
  };
}

function useFeedOnly() {
  return useBuyerMarketplaceFeedV2();
}

function useFlagsAndFeed() {
  return { feed: useBuyerMarketplaceFeedV2(), flags: useFeatureFlags() };
}

describe("Pilot mode flag proof", () => {
  it("fails closed to demo behavior when no FeatureFlagsProvider is mounted at all", async () => {
    const { core, manager, scenario } = makeWorld();
    await publishLiveOffer(manager, scenario);
    const buyerApi = core.buyerApi();

    const { result } = renderHook(() => useFeedOnly(), {
      wrapper: apiOnlyWrapper(buyerApi, manager),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isPilot).toBe(false);
    expect(result.current.offers).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("fails closed to demo behavior when the flag source rejects", async () => {
    const { core, manager, scenario } = makeWorld();
    await publishLiveOffer(manager, scenario);
    const buyerApi = core.buyerApi();

    const { result } = renderHook(() => useFlagsAndFeed(), {
      wrapper: flagsAndApiWrapper(erroringSource, buyerApi, manager),
    });

    await waitFor(() => expect(result.current.flags.status).toBe("failed"));
    expect(result.current.flags.flags.marketplaceMode).toBe("demo");
    await waitFor(() => expect(result.current.feed.isLoading).toBe(false));
    expect(result.current.feed.isPilot).toBe(false);
    expect(result.current.feed.offers).toEqual([]);
  });

  it("fails closed to demo behavior when the flag source throws synchronously", async () => {
    const { core, manager, scenario } = makeWorld();
    await publishLiveOffer(manager, scenario);
    const buyerApi = core.buyerApi();

    const { result } = renderHook(() => useFlagsAndFeed(), {
      wrapper: flagsAndApiWrapper(throwingSource, buyerApi, manager),
    });

    await waitFor(() => expect(result.current.flags.status).toBe("failed"));
    expect(result.current.flags.flags.marketplaceMode).toBe("demo");
    await waitFor(() => expect(result.current.feed.isLoading).toBe(false));
    expect(result.current.feed.isPilot).toBe(false);
    expect(result.current.feed.offers).toEqual([]);
  });

  it("shows only v2 live supply once the flag source resolves pilot", async () => {
    const { core, manager, scenario } = makeWorld();
    const offer = await publishLiveOffer(manager, scenario);
    const buyerApi = core.buyerApi();

    const { result } = renderHook(() => useFlagsAndFeed(), {
      wrapper: flagsAndApiWrapper(pilotSource, buyerApi, manager),
    });

    await waitFor(() => expect(result.current.flags.status).toBe("ready"));
    expect(result.current.flags.flags.marketplaceMode).toBe("pilot");
    await waitFor(() => expect(result.current.feed.isPilot).toBe(true));
    await waitFor(() => expect(result.current.feed.offers).toHaveLength(1));
    expect(result.current.feed.offers[0].id).toBe(offer.id);
    expect(result.current.feed.offers[0].title).toBe("Live pilot supply");
  });

  it("a mode flip from pilot to demo clears live supply", async () => {
    const { core, manager, scenario } = makeWorld();
    await publishLiveOffer(manager, scenario);
    const buyerApi = core.buyerApi();
    let currentMode: MarketplaceModeV2 = "pilot";
    const controlledSource: FlagSourceV2 = () =>
      Promise.resolve({ marketplaceMode: currentMode });

    const { result } = renderHook(() => useFlagsAndFeed(), {
      wrapper: flagsAndApiWrapper(controlledSource, buyerApi, manager),
    });

    await waitFor(() => expect(result.current.feed.isPilot).toBe(true));
    await waitFor(() => expect(result.current.feed.offers).toHaveLength(1));

    currentMode = "demo";
    act(() => {
      result.current.flags.reload();
    });

    await waitFor(() => expect(result.current.flags.flags.marketplaceMode).toBe("demo"));
    await waitFor(() => expect(result.current.feed.isPilot).toBe(false));
    await waitFor(() => expect(result.current.feed.offers).toEqual([]));
  });

  it("a mode flip from demo to pilot brings v2 live supply back", async () => {
    const { core, manager, scenario } = makeWorld();
    await publishLiveOffer(manager, scenario);
    const buyerApi = core.buyerApi();
    let currentMode: MarketplaceModeV2 = "demo";
    const controlledSource: FlagSourceV2 = () =>
      Promise.resolve({ marketplaceMode: currentMode });

    const { result } = renderHook(() => useFlagsAndFeed(), {
      wrapper: flagsAndApiWrapper(controlledSource, buyerApi, manager),
    });

    await waitFor(() => expect(result.current.flags.status).toBe("ready"));
    expect(result.current.feed.isPilot).toBe(false);
    expect(result.current.feed.offers).toEqual([]);

    currentMode = "pilot";
    act(() => {
      result.current.flags.reload();
    });

    await waitFor(() => expect(result.current.feed.isPilot).toBe(true));
    await waitFor(() => expect(result.current.feed.offers).toHaveLength(1));
  });
});

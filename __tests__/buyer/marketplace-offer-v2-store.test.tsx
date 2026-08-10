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

import { useBuyerMarketplaceOfferV2 } from "@/lib/buyer/marketplace-v2-store";

function publishInputFor(
  scenario: DefaultScenario,
  overrides: Partial<PublishOfferV2Input> = {}
): PublishOfferV2Input {
  return {
    storeId: scenario.storeId,
    idempotencyKey: "publish-key-1",
    allocation: {
      storeProductId: scenario.highConfidenceProductId,
      quantity: 1,
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

function pilotSource(): Promise<FeatureFlagsV2> {
  return Promise.resolve({ marketplaceMode: "pilot" });
}

function makeWrapper(core: InMemoryStoreCore, scenario: DefaultScenario) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      FeatureFlagsProvider,
      { source: pilotSource },
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

describe("useBuyerMarketplaceOfferV2", () => {
  it("loads a single offer by id in pilot mode", async () => {
    const { core, scenario, seller } = makeWorld();
    const published = await seller.approveAndPublishOfferV2(publishInputFor(scenario));
    if (!published.ok) throw new Error("expected publish to succeed");

    const { result } = renderHook(() => useBuyerMarketplaceOfferV2(published.value.id), {
      wrapper: makeWrapper(core, scenario),
    });

    await waitFor(() => expect(result.current.offer).not.toBeNull());

    expect(result.current.offer?.id).toBe(published.value.id);
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("surfaces a not_found error for an unknown offer id instead of throwing", async () => {
    const { core, scenario } = makeWorld();

    const { result } = renderHook(
      () => useBuyerMarketplaceOfferV2("does-not-exist"),
      { wrapper: makeWrapper(core, scenario) }
    );

    await waitFor(() => expect(result.current.error).not.toBeNull());

    expect(result.current.error?.code).toBe("not_found");
    expect(result.current.offer).toBeNull();
  });

  it("refetches authoritative data on refresh, picking up a sold out transition", async () => {
    const { core, scenario, seller } = makeWorld();
    const published = await seller.approveAndPublishOfferV2(publishInputFor(scenario));
    if (!published.ok) throw new Error("expected publish to succeed");

    const { result } = renderHook(() => useBuyerMarketplaceOfferV2(published.value.id), {
      wrapper: makeWrapper(core, scenario),
    });

    await waitFor(() => expect(result.current.offer?.status).toBe("live"));

    const buyer = core.buyerApi();
    await buyer.reserveOfferV2({
      offerId: published.value.id,
      quantity: 1,
      clientReservationId: "someone-else-reservation",
      installationId: "another-installation",
      expectedOfferVersion: published.value.version,
    });

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.offer?.status).toBe("sold_out");
    expect(result.current.offer?.quantityAvailable).toBe(0);
  });

  it("drops a pilot offer response that lands after the mode flipped to demo", async () => {
    const { core, scenario, seller } = makeWorld();
    const published = await seller.approveAndPublishOfferV2(publishInputFor(scenario));
    if (!published.ok) throw new Error("expected publish to succeed");
    const offerId = published.value.id;

    let releaseRequest!: () => void;
    const inFlight = new Promise<void>((resolve) => {
      releaseRequest = resolve;
    });
    const slowBuyerApi = {
      ...core.buyerApi(),
      getMarketplaceOfferV2: async (offerId: string) => {
        await inFlight;
        return core.buyerApi().getMarketplaceOfferV2(offerId);
      },
    };
    const source = jest
      .fn<Promise<FeatureFlagsV2>, []>()
      .mockResolvedValueOnce({ marketplaceMode: "pilot" });

    function Wrapper({ children }: { children: ReactNode }) {
      return createElement(
        FeatureFlagsProvider,
        { source },
        createElement(
          ApiProvider,
          {
            buyerApi: slowBuyerApi,
            sellerApi: core.sellerApi({ userId: scenario.managerUserId }),
          },
          children
        )
      );
    }

    function useCombined() {
      const flags = useFeatureFlags();
      const detail = useBuyerMarketplaceOfferV2(offerId);
      return { detail, flags };
    }

    const { result } = renderHook(() => useCombined(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.detail.isLoading).toBe(true));

    source.mockResolvedValueOnce({ marketplaceMode: "demo" });
    await act(async () => {
      result.current.flags.reload();
      await Promise.resolve();
    });
    await waitFor(() =>
      expect(result.current.flags.flags.marketplaceMode).toBe("demo")
    );

    await act(async () => {
      releaseRequest();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.detail.offer).toBeNull();
    expect(result.current.detail.isPilot).toBe(false);
    expect(result.current.detail.isLoading).toBe(false);
  });

  it("degrades to an empty offer when the coordinator providers are not mounted", () => {
    const { result } = renderHook(() => useBuyerMarketplaceOfferV2("offer-1"));

    expect(result.current.offer).toBeNull();
    expect(result.current.isPilot).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });
});

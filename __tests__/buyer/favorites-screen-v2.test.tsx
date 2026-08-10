import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { createElement, type ReactNode } from "react";

import FavoritesScreen from "@/app/(tabs)/favorites";
import { ApiProvider, type BuyerMarketplaceApiV2 } from "@/lib/api";
import type { FeatureFlagsV2, PublishOfferV2Input } from "@/lib/contracts";
import { FeatureFlagsProvider } from "@/lib/feature-flags";
import {
  InMemoryStoreCore,
  makeDefaultScenario,
  type DefaultScenario,
} from "@/lib/test-kit";

let mockFavorites: string[] = [];

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("@/components/ScreenScrollView", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ReactMock = require("react");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ScrollView } = require("react-native");
  return {
    ScreenScrollView: ({ children, ...props }: { children: ReactNode }) =>
      ReactMock.createElement(ScrollView, props, children),
  };
});

jest.mock("@/lib/favorites-store", () => ({
  useFavorites: () => mockFavorites,
  useToggleFavorite: () => jest.fn(),
}));

jest.mock("@/lib/locale-store", () => ({
  useLocale: () => "en",
}));

jest.mock("@/lib/marketplace-store", () => ({
  usePublishedSellerOffers: () => [],
}));

jest.mock("@/lib/search-store", () => ({
  useSearchQuery: () => "",
}));

function publishInputFor(
  scenario: DefaultScenario,
  overrides: Partial<PublishOfferV2Input> = {}
): PublishOfferV2Input {
  return {
    storeId: scenario.storeId,
    idempotencyKey: `publish-key-${overrides.title ?? "default"}`,
    allocation: {
      storeProductId: scenario.highConfidenceProductId,
      quantity: 3,
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

function pilotSource(): Promise<FeatureFlagsV2> {
  return Promise.resolve({ marketplaceMode: "pilot" });
}

describe("FavoritesScreen in pilot mode", () => {
  beforeEach(() => {
    mockFavorites = [];
  });

  it("shows only favorited live v2 offers, never seed favorites", async () => {
    const core = new InMemoryStoreCore();
    const scenario = makeDefaultScenario(core);
    const seller = core.sellerApi({ userId: scenario.managerUserId });
    await seller.approveAndPublishOfferV2(
      publishInputFor(scenario, { title: "Bakery rescue box" })
    );
    await seller.approveAndPublishOfferV2(
      publishInputFor(scenario, {
        title: "Dairy clearance crate",
        idempotencyKey: "publish-key-dairy",
      })
    );
    mockFavorites = ["offer-2"];

    const screen = render(
      createElement(
        FeatureFlagsProvider,
        { source: pilotSource },
        createElement(
          ApiProvider,
          {
            buyerApi: core.buyerApi(),
            sellerApi: core.sellerApi({ userId: scenario.managerUserId }),
          },
          createElement(FavoritesScreen)
        )
      )
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(screen.getByText("Dairy clearance crate")).toBeTruthy());
    expect(screen.queryByText("Bakery rescue box")).toBeNull();
    expect(screen.queryByTestId("favorites-empty-state")).toBeNull();
    expect(screen.getByText("UZS 20,000")).toBeTruthy();
  });

  it("shows a loading state while the live feed is fetching, not the empty state", async () => {
    const core = new InMemoryStoreCore();
    const scenario = makeDefaultScenario(core);
    let resolveList: ((result: Awaited<ReturnType<BuyerMarketplaceApiV2["listMarketplaceOffersV2"]>>) => void) | null =
      null;
    const delayedBuyerApi: BuyerMarketplaceApiV2 = {
      ...core.buyerApi(),
      listMarketplaceOffersV2: () =>
        new Promise((resolve) => {
          resolveList = resolve;
        }),
    };

    const screen = render(
      createElement(
        FeatureFlagsProvider,
        { source: pilotSource },
        createElement(
          ApiProvider,
          {
            buyerApi: delayedBuyerApi,
            sellerApi: core.sellerApi({ userId: scenario.managerUserId }),
          },
          createElement(FavoritesScreen)
        )
      )
    );

    await waitFor(() =>
      expect(screen.getByTestId("favorites-pilot-loading-state")).toBeTruthy()
    );
    expect(screen.queryByTestId("favorites-empty-state")).toBeNull();

    await act(async () => {
      resolveList?.(await core.buyerApi().listMarketplaceOffersV2());
    });

    await waitFor(() =>
      expect(screen.queryByTestId("favorites-pilot-loading-state")).toBeNull()
    );
  });

  it("shows an honest error and retry state instead of a false empty favorites message", async () => {
    const core = new InMemoryStoreCore();
    const scenario = makeDefaultScenario(core);
    const failingBuyerApi: BuyerMarketplaceApiV2 = {
      ...core.buyerApi(),
      listMarketplaceOffersV2: async () => ({
        ok: false,
        error: { code: "network_error", message: "Network unavailable", retryable: true },
      }),
    };
    mockFavorites = ["offer-1"];

    const screen = render(
      createElement(
        FeatureFlagsProvider,
        { source: pilotSource },
        createElement(
          ApiProvider,
          {
            buyerApi: failingBuyerApi,
            sellerApi: core.sellerApi({ userId: scenario.managerUserId }),
          },
          createElement(FavoritesScreen)
        )
      )
    );

    await waitFor(() =>
      expect(screen.getByTestId("favorites-pilot-error-state")).toBeTruthy()
    );
    expect(screen.getByText("Network unavailable")).toBeTruthy();
    expect(screen.queryByTestId("favorites-empty-state")).toBeNull();

    failingBuyerApi.listMarketplaceOffersV2 = core.buyerApi().listMarketplaceOffersV2;
    fireEvent.press(screen.getByTestId("favorites-pilot-retry-button"));

    await waitFor(() =>
      expect(screen.queryByTestId("favorites-pilot-error-state")).toBeNull()
    );
  });
});

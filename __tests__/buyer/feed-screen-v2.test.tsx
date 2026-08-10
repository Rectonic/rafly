/* eslint-disable @typescript-eslint/no-require-imports */
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import React, { type ReactNode } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import FeedScreen from "@/app/(tabs)/index";
import { ApiProvider, type BuyerMarketplaceApiV2 } from "@/lib/api";
import type { FeatureFlagsV2, PublishOfferV2Input } from "@/lib/contracts";
import { FeatureFlagsProvider } from "@/lib/feature-flags";
import {
  InMemoryStoreCore,
  makeDefaultScenario,
  type DefaultScenario,
} from "@/lib/test-kit";

const mockPush = jest.fn();
const mockToggleFavorite = jest.fn();
let mockFavorites: string[] = [];
let mockLocale: "en" | "ru" = "en";
const mockUseSafeAreaInsets = jest.mocked(useSafeAreaInsets);

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: jest.fn(),
}));

jest.mock("@/components/ScreenScrollView", () => {
  const ReactMock = require("react");
  const { ScrollView } = require("react-native");
  return {
    ScreenScrollView: ReactMock.forwardRef(
      ({ children, ...props }: { children: ReactNode }, ref: unknown) =>
        ReactMock.createElement(ScrollView, { ...props, ref }, children)
    ),
  };
});

jest.mock("@/components/OffersMap", () => {
  const ReactMock = require("react");
  const { Text, View } = require("react-native");
  return {
    OffersMap: ({ offers }: { offers: { id: string }[] }) =>
      ReactMock.createElement(
        View,
        null,
        ReactMock.createElement(
          Text,
          { testID: "map-offers-count" },
          String(offers.length)
        )
      ),
  };
});

jest.mock(
  "@/lib/device-location",
  () => ({
    getCurrentCoordinates: () => Promise.reject(new Error("not used")),
    isLocationPermissionDeniedError: () => false,
  }),
  { virtual: true }
);

jest.mock("@/lib/favorites-store", () => ({
  useFavorites: () => mockFavorites,
  useToggleFavorite: () => mockToggleFavorite,
}));

jest.mock("@/lib/locale-store", () => ({
  useLocale: () => mockLocale,
}));

jest.mock("@/lib/marketplace-store", () => ({
  useMarketplaceState: () => ({
    error: null,
    isLoading: false,
    publishedOffers: [],
    refreshPublishedOffers: jest.fn(),
  }),
}));

let mockSearchQuery = "";

jest.mock("@/lib/search-store", () => ({
  useSearchQuery: () => mockSearchQuery,
  useSetSearchQuery: () => (nextQuery: string) => {
    mockSearchQuery = nextQuery;
  },
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

function pilotTree(buyerApi: BuyerMarketplaceApiV2, core: InMemoryStoreCore, scenario: DefaultScenario) {
  return (
    <FeatureFlagsProvider source={pilotSource}>
      <ApiProvider
        buyerApi={buyerApi}
        sellerApi={core.sellerApi({ userId: scenario.managerUserId })}
      >
        <FeedScreen />
      </ApiProvider>
    </FeatureFlagsProvider>
  );
}

function renderPilotFeed(core: InMemoryStoreCore, scenario: DefaultScenario) {
  return render(pilotTree(core.buyerApi(), core, scenario));
}

describe("FeedScreen in pilot mode", () => {
  beforeEach(() => {
    mockFavorites = [];
    mockLocale = "en";
    mockSearchQuery = "";
    mockUseSafeAreaInsets.mockReturnValue({ bottom: 34, left: 0, right: 0, top: 47 });
    mockPush.mockClear();
    mockToggleFavorite.mockClear();
  });

  it("shows a loading state while the live feed is fetching", async () => {
    const core = new InMemoryStoreCore();
    const scenario = makeDefaultScenario(core);
    await core
      .sellerApi({ userId: scenario.managerUserId })
      .approveAndPublishOfferV2(publishInputFor(scenario));

    let resolveList: ((result: Awaited<ReturnType<BuyerMarketplaceApiV2["listMarketplaceOffersV2"]>>) => void) | null =
      null;
    const delayedBuyerApi: BuyerMarketplaceApiV2 = {
      ...core.buyerApi(),
      listMarketplaceOffersV2: () =>
        new Promise((resolve) => {
          resolveList = resolve;
        }),
    };

    const screen = render(pilotTree(delayedBuyerApi, core, scenario));

    await waitFor(() => expect(screen.getByTestId("feed-pilot-loading-state")).toBeTruthy());
    // The list has not resolved yet, offers.length is 0 at this point, the
    // generic empty state must not render alongside the loading banner and
    // claim there is nothing to see while a fetch is still in flight.
    expect(screen.queryByTestId("feed-empty-state")).toBeNull();

    await act(async () => {
      resolveList?.(await core.buyerApi().listMarketplaceOffersV2());
    });

    await waitFor(() =>
      expect(screen.queryByTestId("feed-pilot-loading-state")).toBeNull()
    );
    expect(screen.getByText("Bakery rescue box")).toBeTruthy();
  });

  it("shows the honest empty state when pilot mode has no live offers, never seed offers", async () => {
    const core = new InMemoryStoreCore();
    const scenario = makeDefaultScenario(core);

    const screen = renderPilotFeed(core, scenario);

    await waitFor(() => expect(screen.getByTestId("feed-empty-state")).toBeTruthy());
    expect(screen.queryByText("Surprise Bakery Bag")).toBeNull();
    expect(screen.getByTestId("feed-offer-count")).toHaveTextContent(
      "0 offers showing"
    );
  });

  it("shows an honest error and retry state with no seed fallback when the live feed fails", async () => {
    const core = new InMemoryStoreCore();
    const scenario = makeDefaultScenario(core);
    const failingBuyerApi: BuyerMarketplaceApiV2 = {
      ...core.buyerApi(),
      listMarketplaceOffersV2: async () => ({
        ok: false,
        error: {
          code: "network_error",
          message: "Network unavailable",
          retryable: true,
        },
      }),
    };

    const screen = render(
      <FeatureFlagsProvider source={pilotSource}>
        <ApiProvider
          buyerApi={failingBuyerApi}
          sellerApi={core.sellerApi({ userId: scenario.managerUserId })}
        >
          <FeedScreen />
        </ApiProvider>
      </FeatureFlagsProvider>
    );

    await waitFor(() => expect(screen.getByTestId("feed-pilot-error-state")).toBeTruthy());
    expect(screen.queryByTestId("feed-empty-state")).toBeNull();
    expect(screen.queryByText("Surprise Bakery Bag")).toBeNull();

    failingBuyerApi.listMarketplaceOffersV2 = core.buyerApi().listMarketplaceOffersV2;
    fireEvent.press(screen.getByTestId("feed-pilot-retry-button"));

    await waitFor(() =>
      expect(screen.queryByTestId("feed-pilot-error-state")).toBeNull()
    );
  });

  it("keeps search, category filter, sort, radius, favorites, and the map working for live offers", async () => {
    const core = new InMemoryStoreCore();
    const scenario = makeDefaultScenario(core);
    const seller = core.sellerApi({ userId: scenario.managerUserId });
    await seller.approveAndPublishOfferV2(
      publishInputFor(scenario, { title: "Bakery rescue box", category: "bakery" })
    );
    await seller.approveAndPublishOfferV2(
      publishInputFor(scenario, {
        title: "Dairy clearance crate",
        category: "dairy",
        idempotencyKey: "publish-key-dairy",
        allocation: {
          storeProductId: scenario.lowConfidenceProductId,
          quantity: 2,
          physicallySetAside: true,
        },
      })
    );

    const buyerApi = core.buyerApi();
    const screen = render(pilotTree(buyerApi, core, scenario));

    await waitFor(() => expect(screen.getByTestId("map-offers-count")).toHaveTextContent("2"));
    expect(screen.getByText("Bakery rescue box")).toBeTruthy();
    expect(screen.getByText("Dairy clearance crate")).toBeTruthy();

    fireEvent.changeText(
      screen.getByPlaceholderText(
        "Search for restaurants, bakeries, or specific food..."
      ),
      "dairy"
    );
    screen.rerender(pilotTree(buyerApi, core, scenario));

    await waitFor(() => expect(screen.getByTestId("map-offers-count")).toHaveTextContent("1"));
    expect(screen.getByText("Dairy clearance crate")).toBeTruthy();
    expect(screen.queryByText("Bakery rescue box")).toBeNull();

    fireEvent.changeText(
      screen.getByPlaceholderText(
        "Search for restaurants, bakeries, or specific food..."
      ),
      ""
    );
    screen.rerender(pilotTree(buyerApi, core, scenario));

    await waitFor(() => expect(screen.getByTestId("map-offers-count")).toHaveTextContent("2"));

    fireEvent.press(screen.getByTestId("favorite-toggle-offer-1"));
    expect(mockToggleFavorite).toHaveBeenCalledWith("offer-1");

    fireEvent.press(screen.getByText("Bakery rescue box"));
    expect(mockPush).toHaveBeenCalledWith("/offer/offer-1");
  });

  it("shows UZS formatted prices on pilot mode cards, not the dollar formatter", async () => {
    const core = new InMemoryStoreCore();
    const scenario = makeDefaultScenario(core);
    await core
      .sellerApi({ userId: scenario.managerUserId })
      .approveAndPublishOfferV2(publishInputFor(scenario));

    const screen = renderPilotFeed(core, scenario);

    await waitFor(() => expect(screen.getByText("Bakery rescue box")).toBeTruthy());
    expect(screen.getByText("UZS 20,000")).toBeTruthy();
    expect(screen.queryByText("$20000.00")).toBeNull();
  });
});

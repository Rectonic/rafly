/* eslint-disable @typescript-eslint/no-require-imports */
import { act, render, waitFor } from "@testing-library/react-native";
import { createElement } from "react";

import OfferDetailScreen from "@/app/offer/[id]";
import { ApiProvider } from "@/lib/api";
import type { FeatureFlagsV2, PublishOfferV2Input } from "@/lib/contracts";
import { FeatureFlagsProvider } from "@/lib/feature-flags";
import {
  InMemoryStoreCore,
  makeDefaultScenario,
  type DefaultScenario,
} from "@/lib/test-kit";

let mockParams = { id: "offer-1" };

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({
    back: jest.fn(),
    push: jest.fn(),
  }),
}));

jest.mock("@expo/vector-icons/Ionicons", () => ({
  __esModule: true,
  default: ({ name }: { name: string }) => {
    const { Text } = jest.requireActual("react-native");
    const ReactMock = require("react");
    return ReactMock.createElement(Text, { testID: `icon-${name}` }, name);
  },
}));

jest.mock("@/components/ScreenScrollView", () => {
  const ReactMock = require("react");
  const { ScrollView } = require("react-native");
  return {
    ScreenScrollView: ({ children, ...props }: { children: React.ReactNode }) =>
      ReactMock.createElement(ScrollView, props, children),
  };
});

jest.mock("@/lib/favorites-store", () => ({
  useFavorites: () => [],
  useToggleFavorite: () => jest.fn(),
}));

jest.mock("@/lib/locale-store", () => ({
  useLocale: () => "en",
}));

jest.mock("@/lib/marketplace-store", () => ({
  usePublishedSellerOffers: () => [],
}));

jest.mock("@/lib/reservations", () => ({
  createPickupReservation: jest.fn(),
}));

jest.mock("@/lib/reservations-store", () => ({
  useAddReservation: () => jest.fn(),
  useReservationForOffer: () => null,
  useRetryReservationSync: () => jest.fn(),
}));

function publishInputFor(scenario: DefaultScenario): PublishOfferV2Input {
  return {
    storeId: scenario.storeId,
    idempotencyKey: "publish-key-1",
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
  };
}

function pilotSource(): Promise<FeatureFlagsV2> {
  return Promise.resolve({ marketplaceMode: "pilot" });
}

describe("OfferDetailScreen pilot routing", () => {
  beforeEach(() => {
    mockParams = { id: "offer-1" };
  });

  it("renders the v2 detail view once the coordinator providers resolve to pilot mode", async () => {
    const core = new InMemoryStoreCore();
    const scenario = makeDefaultScenario(core);
    const seller = core.sellerApi({ userId: scenario.managerUserId });
    const published = await seller.approveAndPublishOfferV2(publishInputFor(scenario));
    if (!published.ok) throw new Error("expected publish to succeed");
    mockParams = { id: published.value.id };

    // The flags provider starts fail closed (demo) and resolves to pilot on
    // the next microtask, this is the exact transition that would break the
    // rules of hooks if any v1 hook in OfferDetailScreen were skipped while
    // isPilot flips from false to true on an already mounted instance.
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
          createElement(OfferDetailScreen)
        )
      )
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(screen.getByTestId("offer-detail-v2-screen")).toBeTruthy()
    );
    expect(screen.getByText("Bakery rescue box")).toBeTruthy();
    expect(screen.queryByTestId("offer-detail-screen")).toBeNull();
  });

  it("keeps the legacy v1 screen when no coordinator providers are mounted", () => {
    mockParams = { id: "missing-offer" };

    const screen = render(createElement(OfferDetailScreen));

    expect(screen.getByText("Offer not found.")).toBeTruthy();
    expect(screen.queryByTestId("offer-detail-v2-screen")).toBeNull();
  });
});

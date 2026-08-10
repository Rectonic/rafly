/* eslint-disable @typescript-eslint/no-require-imports */
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { createElement, type ReactNode } from "react";

import { OfferDetailV2 } from "@/components/buyer/OfferDetailV2";
import { ApiProvider, type BuyerMarketplaceApiV2 } from "@/lib/api";
import type { FeatureFlagsV2, PublishOfferV2Input } from "@/lib/contracts";
import { FeatureFlagsProvider } from "@/lib/feature-flags";
import {
  InMemoryStoreCore,
  makeDefaultScenario,
  type DefaultScenario,
} from "@/lib/test-kit";

const mockBack = jest.fn();
let mockFavorites: string[] = [];
const mockToggleFavorite = jest.fn();
let mockLocale: "en" | "ru" = "en";

jest.mock("expo-router", () => ({
  useRouter: () => ({
    back: mockBack,
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
    ScreenScrollView: ({ children, ...props }: { children: ReactNode }) =>
      ReactMock.createElement(ScrollView, props, children),
  };
});

jest.mock("@/lib/favorites-store", () => ({
  useFavorites: () => mockFavorites,
  useToggleFavorite: () => mockToggleFavorite,
}));

jest.mock("@/lib/locale-store", () => ({
  useLocale: () => mockLocale,
}));

function publishInputFor(
  scenario: DefaultScenario,
  overrides: Partial<PublishOfferV2Input> = {}
): PublishOfferV2Input {
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

async function renderDetail(
  offerId: string | undefined,
  buyerApi: BuyerMarketplaceApiV2,
  core: InMemoryStoreCore,
  scenario: DefaultScenario
) {
  const screen = render(
    createElement(
      FeatureFlagsProvider,
      { source: pilotSource },
      createElement(
        ApiProvider,
        {
          buyerApi,
          sellerApi: core.sellerApi({ userId: scenario.managerUserId }),
        },
        createElement(OfferDetailV2, { offerId })
      )
    )
  );

  // Flushes the FeatureFlagsProvider source resolution and the offer fetch
  // that follows once isPilot flips true, so callers can assert on settled
  // state without unrelated act() warnings from either promise chain.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

  return screen;
}

describe("OfferDetailV2", () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockToggleFavorite.mockClear();
    mockFavorites = [];
    mockLocale = "en";
  });

  it("shows a not found state for an unknown offer id", async () => {
    const { core, scenario } = makeWorld();

    const screen = await renderDetail("does-not-exist", core.buyerApi(), core, scenario);

    await waitFor(() => expect(screen.getByTestId("offer-detail-v2-not-found")).toBeTruthy());
  });

  it("shows an error and retry state when the live offer request fails", async () => {
    const { core, scenario } = makeWorld();
    const failingBuyerApi: BuyerMarketplaceApiV2 = {
      ...core.buyerApi(),
      getMarketplaceOfferV2: async () => ({
        ok: false,
        error: { code: "network_error", message: "Network unavailable", retryable: true },
      }),
    };

    const screen = await renderDetail("offer-1", failingBuyerApi, core, scenario);

    await waitFor(() => expect(screen.getByTestId("offer-detail-v2-error-state")).toBeTruthy());
    expect(screen.getByText("Network unavailable")).toBeTruthy();

    failingBuyerApi.getMarketplaceOfferV2 = core.buyerApi().getMarketplaceOfferV2;
    fireEvent.press(screen.getByTestId("offer-detail-v2-retry-button"));

    await waitFor(() =>
      expect(screen.queryByTestId("offer-detail-v2-error-state")).toBeNull()
    );
  });

  it("renders public offer details, the discount badge, last verified, and the full pickup window", async () => {
    const { core, scenario, seller } = makeWorld();
    const published = await seller.approveAndPublishOfferV2(publishInputFor(scenario));
    if (!published.ok) throw new Error("expected publish to succeed");

    const screen = await renderDetail(published.value.id, core.buyerApi(), core, scenario);

    await waitFor(() => expect(screen.getByText("Bakery rescue box")).toBeTruthy());
    expect(screen.getByText("Chorsu Corner Market")).toBeTruthy();
    expect(screen.getByText("1 Amir Temur Avenue, Tashkent")).toBeTruthy();
    expect(screen.getByText("UZS 20,000")).toBeTruthy();
    expect(screen.getByText("60% off")).toBeTruthy();
    expect(screen.getByText("bread, pastry")).toBeTruthy();
    expect(screen.getByText("Ask at the counter")).toBeTruthy();
    expect(screen.getByText("vegetarian")).toBeTruthy();
    expect(screen.getByText("gluten")).toBeTruthy();
    expect(screen.getByText("Cancel before pickup start")).toBeTruthy();
    expect(screen.getByTestId("offer-detail-v2-last-verified")).toHaveTextContent(
      /2026/
    );
    expect(screen.getByTestId("offer-detail-v2-pickup-window")).toHaveTextContent(
      /22:00/
    );
    expect(screen.getByTestId("offer-detail-v2-reserve-button")).not.toBeDisabled();
  });

  it("produces no discount claim when the reference price is unsupported", async () => {
    const { core, scenario, seller } = makeWorld();
    const published = await seller.approveAndPublishOfferV2(
      publishInputFor(scenario, { referencePriceUzs: null })
    );
    if (!published.ok) throw new Error("expected publish to succeed");

    const screen = await renderDetail(published.value.id, core.buyerApi(), core, scenario);

    await waitFor(() => expect(screen.getByText("Bakery rescue box")).toBeTruthy());
    expect(screen.queryByTestId("offer-detail-v2-discount-badge")).toBeNull();
  });

  it("disables reservation and shows sold out copy once the last unit is gone", async () => {
    const { core, scenario, seller } = makeWorld();
    const published = await seller.approveAndPublishOfferV2(
      publishInputFor(scenario, {
        allocation: {
          storeProductId: scenario.highConfidenceProductId,
          quantity: 1,
          physicallySetAside: false,
        },
      })
    );
    if (!published.ok) throw new Error("expected publish to succeed");
    const buyer = core.buyerApi();
    await buyer.reserveOfferV2({
      offerId: published.value.id,
      quantity: 1,
      clientReservationId: "someone-elses-reservation",
      installationId: "another-installation",
      expectedOfferVersion: published.value.version,
    });

    const screen = await renderDetail(published.value.id, buyer, core, scenario);

    await waitFor(() => expect(screen.getByText("Sold out")).toBeTruthy());
    expect(screen.getByTestId("offer-detail-v2-reserve-button")).toBeDisabled();
  });

  it("shows an expired disabled state for an offer whose pickup window has closed", async () => {
    const { core, scenario, seller } = makeWorld();
    const published = await seller.approveAndPublishOfferV2(publishInputFor(scenario));
    if (!published.ok) throw new Error("expected publish to succeed");

    core.setNow("2026-08-11T00:00:00.000Z");

    const screen = await renderDetail(published.value.id, core.buyerApi(), core, scenario);

    await waitFor(() => expect(screen.getByText("This offer has expired")).toBeTruthy());
    expect(screen.getByTestId("offer-detail-v2-reserve-button")).toBeDisabled();
  });

  it("closes and toggles favorites", async () => {
    const { core, scenario, seller } = makeWorld();
    const published = await seller.approveAndPublishOfferV2(publishInputFor(scenario));
    if (!published.ok) throw new Error("expected publish to succeed");

    const screen = await renderDetail(published.value.id, core.buyerApi(), core, scenario);

    await waitFor(() => expect(screen.getByText("Bakery rescue box")).toBeTruthy());

    fireEvent.press(screen.getByTestId("offer-detail-v2-close-button"));
    expect(mockBack).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByTestId("offer-detail-v2-favorite-button"));
    expect(mockToggleFavorite).toHaveBeenCalledWith(published.value.id);
  });
});

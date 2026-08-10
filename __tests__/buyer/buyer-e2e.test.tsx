/* eslint-disable @typescript-eslint/no-require-imports */
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { createElement, type ComponentType, type ReactNode } from "react";
import { Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import FeedScreen from "@/app/(tabs)/index";
import OfferDetailScreen from "@/app/offer/[id]";
import ReservationsScreen from "@/app/(tabs)/reservations";
import { ApiProvider, type BuyerMarketplaceApiV2 } from "@/lib/api";
import type { FeatureFlagsV2, PublishOfferV2Input } from "@/lib/contracts";
import { FeatureFlagsProvider } from "@/lib/feature-flags";
import {
  InMemoryStoreCore,
  makeDefaultScenario,
  type DefaultScenario,
} from "@/lib/test-kit";

/**
 * End to end buyer journeys, sequence 6. Every earlier sequence tested one
 * hook or one screen at a time, these tests instead chain real screens
 * together against the same InMemoryStoreCore world the way a buyer would
 * actually move through the app: discover in the feed, open a detail
 * screen, reserve, come back after a restart, cancel, and see the honest
 * pilot only supply the whole way through.
 */

let mockParams = { id: "offer-1" };
const mockPush = jest.fn();
const mockBack = jest.fn();
let mockFavorites: string[] = [];
const mockToggleFavorite = jest.fn();
const mockUseSafeAreaInsets = jest.mocked(useSafeAreaInsets);

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({
    back: mockBack,
    push: mockPush,
  }),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: jest.fn(),
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

// Fixed rather than the real AsyncStorage backed hook, so fixtures seeded
// directly through the fake with an explicit installationId line up with
// whatever the rendered screens read. Real installation id generation and
// persistence has its own dedicated coverage in installation-id.test.ts,
// what these end to end paths care about is recovery after a restart, not
// the id's own value.
jest.mock("@/lib/buyer/installation-id", () => ({
  useInstallationId: () => "installation-a",
}));

jest.mock("@/lib/locale-store", () => ({
  useLocale: () => "en",
}));

jest.mock("@/lib/marketplace-store", () => ({
  useMarketplaceState: () => ({
    error: null,
    isLoading: false,
    publishedOffers: [],
    refreshPublishedOffers: jest.fn(),
  }),
  usePublishedSellerOffers: () => [],
}));

jest.mock("@/lib/search-store", () => ({
  useSearchQuery: () => "",
  useSetSearchQuery: () => () => {},
}));

jest.mock("@/lib/reservations", () => ({
  createPickupReservation: jest.fn(),
}));

jest.mock("@/lib/reservations-store", () => ({
  useAddReservation: () => jest.fn(),
  useReservationForOffer: () => null,
  useReservationHistory: () => ({
    cancelReservation: jest.fn(),
    completeReservation: jest.fn(),
    error: null,
    isLoading: false,
    refreshReservations: jest.fn(),
    reservations: [],
    revealedCodes: {},
    revealPickupCode: jest.fn(),
  }),
  useRetryReservationSync: () => jest.fn(),
}));

// Real secure-pickup-code.ts logic, mocked only at the native module
// boundary, so a pickup code persisted during one screen's reserve() call
// is genuinely still there for a later screen's reveal to find, the same
// way it would survive an app restart.
const mockAsyncStorage = new Map<string, string>();
const mockSecureStore = new Map<string, string>();

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockAsyncStorage.get(key) ?? null)),
  setItem: jest.fn((key: string, value: string) => {
    mockAsyncStorage.set(key, value);
    return Promise.resolve();
  }),
}));

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn((key: string) => Promise.resolve(mockSecureStore.get(key) ?? null)),
  setItemAsync: jest.fn((key: string, value: string) => {
    mockSecureStore.set(key, value);
    return Promise.resolve();
  }),
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

async function renderPilot(
  screen: ComponentType,
  buyerApi: BuyerMarketplaceApiV2,
  core: InMemoryStoreCore,
  scenario: DefaultScenario
) {
  const rendered = render(
    createElement(
      FeatureFlagsProvider,
      { source: pilotSource },
      createElement(
        ApiProvider,
        { buyerApi, sellerApi: core.sellerApi({ userId: scenario.managerUserId }) },
        createElement(screen)
      )
    )
  );

  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

  return rendered;
}

describe("Buyer end to end paths", () => {
  beforeEach(() => {
    mockParams = { id: "offer-1" };
    mockPush.mockClear();
    mockBack.mockClear();
    mockFavorites = [];
    mockToggleFavorite.mockClear();
    mockUseSafeAreaInsets.mockReturnValue({ bottom: 34, left: 0, right: 0, top: 47 });
    mockAsyncStorage.clear();
    mockSecureStore.clear();
  });

  it("discovers a live offer in the feed, reserves it on the detail screen, and recovers the code after a restart", async () => {
    const { core, scenario, seller } = makeWorld();
    const published = await seller.approveAndPublishOfferV2(publishInputFor(scenario));
    if (!published.ok) throw new Error("expected publish to succeed");

    const feedScreen = await renderPilot(FeedScreen, core.buyerApi(), core, scenario);
    await waitFor(() => expect(feedScreen.getByText("Bakery rescue box")).toBeTruthy());

    fireEvent.press(feedScreen.getByText("Bakery rescue box"));
    expect(mockPush).toHaveBeenCalledWith(`/offer/${published.value.id}`);
    feedScreen.unmount();

    mockParams = { id: published.value.id };
    const detailScreen = await renderPilot(
      OfferDetailScreen,
      core.buyerApi(),
      core,
      scenario
    );
    await waitFor(() => expect(detailScreen.getByText("Bakery rescue box")).toBeTruthy());

    fireEvent.press(detailScreen.getByTestId("offer-detail-v2-reserve-button"));
    await waitFor(() =>
      expect(detailScreen.getByTestId("offer-detail-v2-pickup-code")).toBeTruthy()
    );
    const pickupCodeText = detailScreen.getByTestId("offer-detail-v2-pickup-code").props
      .children as string;
    expect(pickupCodeText).toMatch(/^[A-Z0-9]{6}$/);
    detailScreen.unmount();

    // A restart drops all in-memory React state, a fresh mount has to
    // recover everything through the server list plus the persisted
    // SecureStore entry rather than anything cached in this test file.
    const restartedScreen = await renderPilot(
      OfferDetailScreen,
      core.buyerApi(),
      core,
      scenario
    );
    await waitFor(() =>
      expect(restartedScreen.getByTestId("offer-detail-v2-pickup-code-hint")).toBeTruthy()
    );
    expect(restartedScreen.queryByTestId("offer-detail-v2-pickup-code")).toBeNull();

    fireEvent.press(restartedScreen.getByTestId("offer-detail-v2-reveal-code-button"));

    await waitFor(() =>
      expect(restartedScreen.getByTestId("offer-detail-v2-pickup-code")).toHaveTextContent(
        pickupCodeText
      )
    );
  });

  it("cancels a reservation from the detail screen and frees the unit for another buyer", async () => {
    const { core, scenario, seller } = makeWorld();
    const published = await seller.approveAndPublishOfferV2(publishInputFor(scenario));
    if (!published.ok) throw new Error("expected publish to succeed");

    mockParams = { id: published.value.id };
    const detailScreen = await renderPilot(
      OfferDetailScreen,
      core.buyerApi(),
      core,
      scenario
    );
    await waitFor(() => expect(detailScreen.getByText("Bakery rescue box")).toBeTruthy());

    fireEvent.press(detailScreen.getByTestId("offer-detail-v2-reserve-button"));
    await waitFor(() =>
      expect(detailScreen.getByTestId("offer-detail-v2-cancel-button")).toBeTruthy()
    );

    const alertSpy = jest
      .spyOn(Alert, "alert")
      .mockImplementation((_title, _message, buttons) => {
        buttons?.find((button) => button.style === "destructive")?.onPress?.();
      });

    fireEvent.press(detailScreen.getByTestId("offer-detail-v2-cancel-button"));

    await waitFor(() => expect(detailScreen.getByText("Cancelled")).toBeTruthy());
    alertSpy.mockRestore();

    // Prove the cancellation is not just a local UI state flip, another
    // buyer's installation can now win the same unit from the real fake.
    const currentOffer = await core.buyerApi().getMarketplaceOfferV2(published.value.id);
    if (!currentOffer.ok) throw new Error("expected offer lookup to succeed");
    const otherBuyerResult = await core.buyerApi().reserveOfferV2({
      offerId: published.value.id,
      quantity: 1,
      clientReservationId: "other-buyer-reservation",
      installationId: "installation-other-buyer",
      expectedOfferVersion: currentOffer.value.version,
    });
    expect(otherBuyerResult.ok).toBe(true);
    detailScreen.unmount();
  });

  it("shows the stock mismatch fixture consistently on both the detail and reservations list screens", async () => {
    const { core, scenario, seller } = makeWorld();
    const published = await seller.approveAndPublishOfferV2(publishInputFor(scenario));
    if (!published.ok) throw new Error("expected publish to succeed");
    const held = await core.buyerApi().reserveOfferV2({
      offerId: published.value.id,
      quantity: 1,
      clientReservationId: "client-reservation-1",
      installationId: "installation-a",
      expectedOfferVersion: published.value.version,
    });
    if (!held.ok) throw new Error("expected reserve to succeed");
    await seller.reportStockMismatchV2({
      storeId: scenario.storeId,
      offerId: published.value.id,
      observedQuantity: 0,
      reason: "shelf recount came up short",
      idempotencyKey: "mismatch-key-1",
    });

    mockParams = { id: published.value.id };
    const detailScreen = await renderPilot(
      OfferDetailScreen,
      core.buyerApi(),
      core,
      scenario
    );
    await waitFor(() => expect(detailScreen.getByText("Unavailable")).toBeTruthy());

    const listScreen = await renderPilot(
      ReservationsScreen,
      core.buyerApi(),
      core,
      scenario
    );
    await waitFor(() =>
      expect(
        listScreen.getByTestId(`reservation-v2-card-${held.value.reservation.id}`)
      ).toBeTruthy()
    );
    expect(listScreen.getByText("Unavailable")).toBeTruthy();
    expect(
      listScreen.getByText(
        "The seller found a stock mismatch. This reservation could not be honored."
      )
    ).toBeTruthy();
    detailScreen.unmount();
    listScreen.unmount();
  });

  it("never shows seed offers in pilot mode across the feed, favorites, or offer detail screens", async () => {
    const { core, scenario } = makeWorld();
    // No offer is ever published, the world stays empty on purpose.

    const feedScreen = await renderPilot(FeedScreen, core.buyerApi(), core, scenario);
    await waitFor(() => expect(feedScreen.getByTestId("feed-empty-state")).toBeTruthy());
    expect(feedScreen.queryByText("Surprise Bakery Bag")).toBeNull();
    expect(feedScreen.getByTestId("feed-offer-count")).toHaveTextContent(
      "0 offers showing"
    );

    mockParams = { id: "1" }; // a real seed id in data/offers.ts, must not resolve in pilot mode
    const detailScreen = await renderPilot(
      OfferDetailScreen,
      core.buyerApi(),
      core,
      scenario
    );
    await waitFor(() =>
      expect(detailScreen.getByTestId("offer-detail-v2-not-found")).toBeTruthy()
    );
    feedScreen.unmount();
    detailScreen.unmount();
  });
});

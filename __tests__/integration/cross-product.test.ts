/* eslint-disable @typescript-eslint/no-require-imports */
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { createElement, type ComponentType, type ReactNode } from "react";
import { Alert } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import FavoritesScreen from "@/app/(tabs)/favorites";
import FeedScreen from "@/app/(tabs)/index";
import ReservationsScreen from "@/app/(tabs)/reservations";
import OfferDetailScreen from "@/app/offer/[id]";
import OrdersScreen from "@/app/(seller-tabs)/orders";
import PublishV2Screen from "@/app/(seller-tabs)/publish-v2";
import { ApiProvider, type BuyerMarketplaceApiV2, type SellerStoreApiV2 } from "@/lib/api";
import type { FeatureFlagsV2, PublishOfferV2Input, Result } from "@/lib/contracts";
import { FeatureFlagsProvider, type FlagSourceV2 } from "@/lib/feature-flags";
import {
  InMemoryStoreCore,
  makeDefaultScenario,
  type DefaultScenario,
} from "@/lib/test-kit";

/**
 * Cross product integration suite, fake backed.
 *
 * Every test in this file drives ONE shared InMemoryStoreCore through REAL
 * buyer screens and REAL seller screens, mounted together under the same
 * ApiProvider plus FeatureFlagsProvider tree the real app root uses. Neither
 * seller-v2-e2e.test.tsx nor buyer-e2e.test.tsx proves the seam between the
 * two product surfaces, one only calls the buyer facade directly and the
 * other only calls the seller facade directly. This file is the one place
 * that proves a unit a seller publishes through their real screen is the
 * exact unit a buyer sees and reserves through their real screen, and that a
 * seller action taken through their real screen is what the buyer's real
 * screen reports back.
 *
 * Only navigation (expo-router) and native modules (AsyncStorage,
 * SecureStore, vector icons, the map) are mocked. Every store, hook, and
 * screen component is the real production module.
 */

let mockParams: { id: string } = { id: "offer-1" };
const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockFavorites: string[] = [];
const mockToggleFavorite = jest.fn();
let mockInstallationId: string | null = "installation-a";

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({
    back: mockBack,
    push: mockPush,
    replace: mockReplace,
  }),
}));

jest.mock("@expo/vector-icons/Ionicons", () => () => null);

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

// A controllable installation id rather than the real AsyncStorage backed
// hook, so a mismatch or cancel journey can switch which buyer's device is
// looking at the shared world simply by pointing this at a different
// scenario installation before a render. installation-id.test.ts owns the
// real hook's own persistence behavior.
jest.mock("@/lib/buyer/installation-id", () => ({
  useInstallationId: () => mockInstallationId,
}));

const mockAsyncStorage = new Map<string, string>();
const mockSecureStore = new Map<string, string>();

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockAsyncStorage.get(key) ?? null)),
  removeItem: jest.fn((key: string) => {
    mockAsyncStorage.delete(key);
    return Promise.resolve();
  }),
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

const safeAreaMetrics = {
  frame: { height: 844, width: 390, x: 0, y: 0 },
  insets: { bottom: 0, left: 0, right: 0, top: 0 },
};

function pilotSource(): Promise<FeatureFlagsV2> {
  return Promise.resolve({ marketplaceMode: "pilot" });
}

function demoSource(): Promise<FeatureFlagsV2> {
  return Promise.resolve({ marketplaceMode: "demo" });
}

function expectOk<T>(result: Result<T>): T {
  if (!result.ok) {
    throw new Error(`expected ok, received ${result.error.code}: ${result.error.message}`);
  }
  return result.value;
}

function publishInputFor(
  scenario: DefaultScenario,
  overrides: Partial<PublishOfferV2Input> = {}
): PublishOfferV2Input {
  return {
    storeId: scenario.storeId,
    idempotencyKey: `cross-product-publish-${overrides.title ?? "default"}`,
    allocation: {
      storeProductId: scenario.highConfidenceProductId,
      quantity: 1,
      physicallySetAside: false,
    },
    title: "API published rescue box",
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

/**
 * The exact and complete MarketplaceOfferV2 public field set, from
 * lib/contracts/marketplace.ts. Journey 1 asserts a listed offer's own key
 * set against this list instead of only spot checking a few fields, so an
 * accidental private field leaking onto the wire would fail this suite even
 * if nobody remembered to update an allowlist of forbidden names.
 */
const PUBLIC_OFFER_KEYS = [
  "allergens",
  "cancellationPolicy",
  "category",
  "contents",
  "dietaryBadges",
  "discountPercent",
  "id",
  "imageUrl",
  "lastVerifiedAt",
  "latitude",
  "longitude",
  "offerPriceUzs",
  "pickupEnd",
  "pickupInstructions",
  "pickupStart",
  "quantityAvailable",
  "referencePriceUzs",
  "status",
  "storeAddress",
  "storeId",
  "storeName",
  "timezone",
  "title",
  "version",
].sort();

function appTree(
  buyerApi: BuyerMarketplaceApiV2,
  sellerApi: SellerStoreApiV2,
  flagSource: FlagSourceV2,
  children: ReactNode
) {
  return createElement(
    SafeAreaProvider,
    { initialMetrics: safeAreaMetrics },
    createElement(
      FeatureFlagsProvider,
      { source: flagSource },
      createElement(ApiProvider, { buyerApi, sellerApi }, children)
    )
  );
}

async function renderScreen(
  Screen: ComponentType,
  buyerApi: BuyerMarketplaceApiV2,
  sellerApi: SellerStoreApiV2,
  flagSource: FlagSourceV2 = pilotSource
) {
  const rendered = render(appTree(buyerApi, sellerApi, flagSource, createElement(Screen)));

  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

  return rendered;
}

describe("Cross product integration (fake backed)", () => {
  beforeEach(() => {
    mockParams = { id: "offer-1" };
    mockPush.mockClear();
    mockBack.mockClear();
    mockReplace.mockClear();
    mockFavorites = [];
    mockToggleFavorite.mockClear();
    mockInstallationId = "installation-a";
    mockAsyncStorage.clear();
    mockSecureStore.clear();
  });

  it("Journey 1: seller publishes, buyer feed lists the exact public shape, buyer reserves, seller pickup queue shows and fulfills it by the raw code, buyer sees fulfilled", async () => {
    const core = new InMemoryStoreCore();
    const scenario = makeDefaultScenario(core);
    const manager = core.sellerApi({ userId: scenario.managerUserId });
    const buyerApi = core.buyerApi();
    mockInstallationId = scenario.installationA;

    // --- Seller publishes through the real publish flow ---
    const publish = await renderScreen(PublishV2Screen, buyerApi, manager);
    await waitFor(() =>
      expect(
        publish.getByTestId(`publish-v2-product-${scenario.highConfidenceProductId}`)
      ).toBeTruthy()
    );
    fireEvent.press(
      publish.getByTestId(`publish-v2-product-${scenario.highConfidenceProductId}`)
    );
    fireEvent.changeText(publish.getByTestId("publish-v2-quantity-input"), "1");
    fireEvent.changeText(
      publish.getByTestId("publish-v2-title-input"),
      "Cross product bread box"
    );
    fireEvent.changeText(publish.getByTestId("publish-v2-category-input"), "bakery");
    fireEvent.changeText(publish.getByTestId("publish-v2-price-input"), "18000");
    fireEvent.changeText(
      publish.getByTestId("publish-v2-reference-price-input"),
      "30000"
    );
    fireEvent.changeText(publish.getByTestId("publish-v2-contents-input"), "Bread loaf");
    fireEvent.changeText(
      publish.getByTestId("publish-v2-pickup-start-input"),
      scenario.pickupStart
    );
    fireEvent.changeText(
      publish.getByTestId("publish-v2-pickup-end-input"),
      scenario.pickupEnd
    );
    fireEvent.press(publish.getByTestId("publish-v2-review-button"));
    await waitFor(() =>
      expect(publish.getByTestId("publish-v2-review-panel")).toBeTruthy()
    );
    fireEvent.press(publish.getByTestId("publish-v2-confirm-button"));
    await waitFor(() =>
      expect(publish.getByTestId("publish-v2-published-panel")).toBeTruthy()
    );
    publish.unmount();

    const published = expectOk(await manager.listStoreOffersV2(scenario.storeId)).find(
      (candidate) => candidate.title === "Cross product bread box"
    );
    if (!published) {
      throw new Error("expected the published offer to be listed for the store");
    }

    // --- Buyer feed lists exactly the public shape ---
    const listed = expectOk(await buyerApi.listMarketplaceOffersV2());
    expect(listed).toHaveLength(1);
    const publicOffer = listed[0];
    expect(Object.keys(publicOffer).sort()).toEqual(PUBLIC_OFFER_KEYS);
    expect(publicOffer).toMatchObject({
      id: published.id,
      title: "Cross product bread box",
      category: "bakery",
      offerPriceUzs: 18000,
      referencePriceUzs: 30000,
      quantityAvailable: 1,
      status: "live",
      storeId: scenario.storeId,
      storeName: scenario.storeName,
      timezone: "Asia/Tashkent",
    });
    for (const privateField of [
      "storeProductId",
      "allocation",
      "physicallySetAside",
      "quantityTotal",
      "onHandQuantity",
      "confidence",
      "approvedBy",
      "publishIdempotencyKey",
    ]) {
      expect(publicOffer).not.toHaveProperty(privateField);
    }

    const feed = await renderScreen(FeedScreen, buyerApi, manager);
    await waitFor(() => expect(feed.getByText("Cross product bread box")).toBeTruthy());
    expect(feed.getByTestId("feed-offer-count")).toHaveTextContent("1 offer showing");
    fireEvent.press(feed.getByText("Cross product bread box"));
    expect(mockPush).toHaveBeenCalledWith(`/offer/${published.id}`);
    feed.unmount();

    // --- Buyer reserves on the real detail screen ---
    mockParams = { id: published.id };
    const detail = await renderScreen(OfferDetailScreen, buyerApi, manager);
    await waitFor(() => expect(detail.getByText("Cross product bread box")).toBeTruthy());
    fireEvent.press(detail.getByTestId("offer-detail-v2-reserve-button"));
    await waitFor(() =>
      expect(detail.getByTestId("offer-detail-v2-pickup-code")).toBeTruthy()
    );
    const rawCode = detail.getByTestId("offer-detail-v2-pickup-code").props
      .children as string;
    expect(rawCode).toMatch(/^[A-Z0-9]{6}$/);
    detail.unmount();

    const held = expectOk(await buyerApi.getBuyerReservationsV2(scenario.installationA))[0];
    expect(held.status).toBe("held");

    // --- Seller pickup queue shows it and fulfills it by the buyer's raw code ---
    const pickups = await renderScreen(OrdersScreen, buyerApi, manager);
    await waitFor(() =>
      expect(pickups.getByTestId(`pickups-v2-row-${held.id}`)).toBeTruthy()
    );
    fireEvent.changeText(pickups.getByTestId("pickups-v2-code-input"), rawCode);
    fireEvent.press(pickups.getByTestId("pickups-v2-fulfill-button"));
    await waitFor(() =>
      expect(pickups.getByTestId("pickups-v2-success-state")).toBeTruthy()
    );
    pickups.unmount();

    // --- Buyer sees fulfilled ---
    const reservationsList = await renderScreen(ReservationsScreen, buyerApi, manager);
    await waitFor(() =>
      expect(reservationsList.getByTestId(`reservation-v2-card-${held.id}`)).toBeTruthy()
    );
    expect(reservationsList.getByText("Picked up")).toBeTruthy();
    reservationsList.unmount();
  });

  it("Journey 2: a reported stock mismatch pauses the offer and fails both buyer holds with distinct copy on every real screen", async () => {
    const core = new InMemoryStoreCore();
    const scenario = makeDefaultScenario(core);
    const manager = core.sellerApi({ userId: scenario.managerUserId });
    const buyerApi = core.buyerApi();

    const published = expectOk(
      await manager.approveAndPublishOfferV2(
        publishInputFor(scenario, {
          title: "Mismatch box",
          idempotencyKey: "cross-product-mismatch-publish",
          allocation: {
            storeProductId: scenario.highConfidenceProductId,
            quantity: 2,
            physicallySetAside: false,
          },
        })
      )
    );
    mockParams = { id: published.id };

    mockInstallationId = scenario.installationA;
    const detailA = await renderScreen(OfferDetailScreen, buyerApi, manager);
    await waitFor(() =>
      expect(detailA.getByTestId("offer-detail-v2-reserve-button")).toBeTruthy()
    );
    fireEvent.press(detailA.getByTestId("offer-detail-v2-reserve-button"));
    await waitFor(() =>
      expect(detailA.getByTestId("offer-detail-v2-pickup-code")).toBeTruthy()
    );
    detailA.unmount();

    mockInstallationId = scenario.installationB;
    const detailB = await renderScreen(OfferDetailScreen, buyerApi, manager);
    await waitFor(() =>
      expect(detailB.getByTestId("offer-detail-v2-reserve-button")).toBeTruthy()
    );
    fireEvent.press(detailB.getByTestId("offer-detail-v2-reserve-button"));
    await waitFor(() =>
      expect(detailB.getByTestId("offer-detail-v2-pickup-code")).toBeTruthy()
    );
    detailB.unmount();

    const heldA = expectOk(await buyerApi.getBuyerReservationsV2(scenario.installationA))[0];
    const heldB = expectOk(await buyerApi.getBuyerReservationsV2(scenario.installationB))[0];
    expect(heldA.status).toBe("held");
    expect(heldB.status).toBe("held");

    // --- Seller reports the mismatch from the real pickup queue ---
    const pickups = await renderScreen(OrdersScreen, buyerApi, manager);
    await waitFor(() => {
      expect(pickups.getByTestId(`pickups-v2-row-${heldA.id}`)).toBeTruthy();
      expect(pickups.getByTestId(`pickups-v2-row-${heldB.id}`)).toBeTruthy();
    });
    fireEvent.press(pickups.getByTestId(`pickups-v2-report-mismatch-${heldA.id}`));
    fireEvent.changeText(pickups.getByTestId("pickups-v2-mismatch-observed-input"), "0");
    fireEvent.changeText(
      pickups.getByTestId("pickups-v2-mismatch-reason-input"),
      "Cross product shelf recount"
    );
    fireEvent.press(pickups.getByTestId("pickups-v2-mismatch-submit-button"));
    await waitFor(() =>
      expect(pickups.getByTestId("pickups-v2-mismatch-success")).toBeTruthy()
    );

    // --- Seller queue shows both failed entries ---
    fireEvent.press(pickups.getByTestId("pickups-v2-terminal-segment"));
    await waitFor(() => {
      expect(pickups.getByTestId(`pickups-v2-status-${heldA.id}`)).toHaveTextContent(
        "Failed, stock mismatch"
      );
      expect(pickups.getByTestId(`pickups-v2-status-${heldB.id}`)).toHaveTextContent(
        "Failed, stock mismatch"
      );
    });
    pickups.unmount();

    const finalOffer = expectOk(await manager.listStoreOffersV2(scenario.storeId)).find(
      (candidate) => candidate.id === published.id
    );
    expect(finalOffer?.status).toBe("paused");

    // --- Both buyer reservations show the stock mismatch state with its distinct copy ---
    mockInstallationId = scenario.installationA;
    const reservationsA = await renderScreen(ReservationsScreen, buyerApi, manager);
    await waitFor(() =>
      expect(reservationsA.getByTestId(`reservation-v2-card-${heldA.id}`)).toBeTruthy()
    );
    expect(reservationsA.getByText("Unavailable")).toBeTruthy();
    expect(
      reservationsA.getByText(
        "The seller found a stock mismatch. This reservation could not be honored."
      )
    ).toBeTruthy();
    reservationsA.unmount();

    mockInstallationId = scenario.installationB;
    const reservationsB = await renderScreen(ReservationsScreen, buyerApi, manager);
    await waitFor(() =>
      expect(reservationsB.getByTestId(`reservation-v2-card-${heldB.id}`)).toBeTruthy()
    );
    expect(reservationsB.getByText("Unavailable")).toBeTruthy();
    expect(
      reservationsB.getByText(
        "The seller found a stock mismatch. This reservation could not be honored."
      )
    ).toBeTruthy();
    reservationsB.unmount();
  });

  it("Journey 3: a buyer cancellation restores the unit for a second buyer and the seller queue reflects the cancellation", async () => {
    const core = new InMemoryStoreCore();
    const scenario = makeDefaultScenario(core);
    const manager = core.sellerApi({ userId: scenario.managerUserId });
    const buyerApi = core.buyerApi();

    const published = expectOk(
      await manager.approveAndPublishOfferV2(
        publishInputFor(scenario, {
          title: "Cancel path box",
          idempotencyKey: "cross-product-cancel-publish",
          allocation: {
            storeProductId: scenario.highConfidenceProductId,
            quantity: 1,
            physicallySetAside: false,
          },
        })
      )
    );
    mockParams = { id: published.id };

    mockInstallationId = scenario.installationA;
    const detailA = await renderScreen(OfferDetailScreen, buyerApi, manager);
    await waitFor(() =>
      expect(detailA.getByTestId("offer-detail-v2-reserve-button")).toBeTruthy()
    );
    fireEvent.press(detailA.getByTestId("offer-detail-v2-reserve-button"));
    await waitFor(() =>
      expect(detailA.getByTestId("offer-detail-v2-cancel-button")).toBeTruthy()
    );

    const alertSpy = jest
      .spyOn(Alert, "alert")
      .mockImplementation((_title, _message, buttons) => {
        buttons?.find((button) => button.style === "destructive")?.onPress?.();
      });
    fireEvent.press(detailA.getByTestId("offer-detail-v2-cancel-button"));
    await waitFor(() => expect(detailA.getByText("Cancelled")).toBeTruthy());
    alertSpy.mockRestore();
    detailA.unmount();

    const afterCancel = expectOk(await buyerApi.getMarketplaceOfferV2(published.id));
    expect(afterCancel.status).toBe("live");
    expect(afterCancel.quantityAvailable).toBe(1);

    // --- A second buyer can reserve the freed unit through the real detail screen ---
    mockInstallationId = scenario.installationB;
    const detailB = await renderScreen(OfferDetailScreen, buyerApi, manager);
    await waitFor(() =>
      expect(detailB.getByTestId("offer-detail-v2-reserve-button")).toBeTruthy()
    );
    fireEvent.press(detailB.getByTestId("offer-detail-v2-reserve-button"));
    await waitFor(() =>
      expect(detailB.getByTestId("offer-detail-v2-pickup-code")).toBeTruthy()
    );
    detailB.unmount();

    const cancelledA = expectOk(
      await buyerApi.getBuyerReservationsV2(scenario.installationA)
    )[0];
    const heldB = expectOk(await buyerApi.getBuyerReservationsV2(scenario.installationB))[0];
    expect(cancelledA.status).toBe("cancelled_by_buyer");
    expect(heldB.status).toBe("held");

    // --- The seller queue reflects the cancellation ---
    const pickups = await renderScreen(OrdersScreen, buyerApi, manager);
    fireEvent.press(pickups.getByTestId("pickups-v2-terminal-segment"));
    await waitFor(() =>
      expect(pickups.getByTestId(`pickups-v2-status-${cancelledA.id}`)).toHaveTextContent(
        "Cancelled by buyer"
      )
    );
    fireEvent.press(pickups.getByTestId("pickups-v2-pending-segment"));
    await waitFor(() =>
      expect(pickups.getByTestId(`pickups-v2-row-${heldB.id}`)).toBeTruthy()
    );
    pickups.unmount();
  });

  it("Journey 4a: pilot mode renders zero seed offers anywhere, the feed, favorites, or a deep linked detail screen", async () => {
    const core = new InMemoryStoreCore();
    const scenario = makeDefaultScenario(core);
    const manager = core.sellerApi({ userId: scenario.managerUserId });
    const buyerApi = core.buyerApi();

    const published = expectOk(
      await manager.approveAndPublishOfferV2(
        publishInputFor(scenario, {
          title: "Pilot purity box",
          idempotencyKey: "cross-product-pilot-purity-publish",
        })
      )
    );
    // A real seed id rides along in favorites, next to the real live offer,
    // proving a stale favorite from before the pilot went live can never
    // resurrect a seed card once the buyer is in pilot mode.
    mockFavorites = [published.id, "1"];

    const feed = await renderScreen(FeedScreen, buyerApi, manager);
    await waitFor(() => expect(feed.getByText("Pilot purity box")).toBeTruthy());
    expect(feed.queryByText("Surprise Bakery Bag")).toBeNull();
    expect(feed.queryByText("Veggie Delight Box")).toBeNull();
    feed.unmount();

    const favorites = await renderScreen(FavoritesScreen, buyerApi, manager);
    await waitFor(() => expect(favorites.getByText("Pilot purity box")).toBeTruthy());
    expect(favorites.queryByText("Surprise Bakery Bag")).toBeNull();
    favorites.unmount();

    // A deep link straight to a real seed id must read as not found rather
    // than as the seed offer, even though the very same id resolves happily
    // once demo mode is active (Journey 4b below).
    mockParams = { id: "1" };
    const detail = await renderScreen(OfferDetailScreen, buyerApi, manager);
    await waitFor(() =>
      expect(detail.getByTestId("offer-detail-v2-not-found")).toBeTruthy()
    );
    expect(detail.queryByText("Surprise Bakery Bag")).toBeNull();
    detail.unmount();
  });

  it("Journey 4b: demo mode renders seed offers and zero live v2 supply", async () => {
    const core = new InMemoryStoreCore();
    const scenario = makeDefaultScenario(core);
    const manager = core.sellerApi({ userId: scenario.managerUserId });
    const buyerApi = core.buyerApi();

    await manager.approveAndPublishOfferV2(
      publishInputFor(scenario, {
        title: "Should never leak into demo",
        idempotencyKey: "cross-product-demo-purity-publish",
      })
    );

    const feed = await renderScreen(FeedScreen, buyerApi, manager, demoSource);
    await waitFor(() => expect(feed.getByText("Surprise Bakery Bag")).toBeTruthy());
    expect(feed.queryByText("Should never leak into demo")).toBeNull();
    feed.unmount();

    // A real seed id favorited in demo mode must actually render its seed
    // content, not merely fail to show the live offer, proving demo mode
    // still serves seed supply rather than an empty pilot-style feed.
    mockFavorites = ["1"];
    const favorites = await renderScreen(FavoritesScreen, buyerApi, manager, demoSource);
    await waitFor(() => expect(favorites.getByText("Surprise Bakery Bag")).toBeTruthy());
    expect(favorites.queryByText("Should never leak into demo")).toBeNull();
    favorites.unmount();
  });
});

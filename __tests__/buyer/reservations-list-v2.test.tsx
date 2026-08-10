/* eslint-disable @typescript-eslint/no-require-imports */
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { createElement, type ReactNode } from "react";

import ReservationsScreen from "@/app/(tabs)/reservations";
import { ApiProvider, type BuyerMarketplaceApiV2 } from "@/lib/api";
import type { FeatureFlagsV2, PublishOfferV2Input } from "@/lib/contracts";
import { FeatureFlagsProvider } from "@/lib/feature-flags";
import {
  InMemoryStoreCore,
  makeDefaultScenario,
  type DefaultScenario,
} from "@/lib/test-kit";
import { pickupCodeKeyV2 } from "@/lib/buyer/secure-pickup-code";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("@/components/ScreenScrollView", () => {
  const ReactMock = require("react");
  const { ScrollView } = require("react-native");
  return {
    ScreenScrollView: ({ children, ...props }: { children: ReactNode }) =>
      ReactMock.createElement(ScrollView, props, children),
  };
});

jest.mock("@/lib/locale-store", () => ({
  useLocale: () => "en",
}));

jest.mock("@/lib/reservations-store", () => ({
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
}));

jest.mock("@/lib/buyer/installation-id", () => ({
  useInstallationId: () => "installation-a",
}));

const mockAsyncStorage = new Map<string, string>();
const mockSecureStore = new Map<string, string>();

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockAsyncStorage.get(key) ?? null)),
  removeItem: jest.fn(),
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

function publishInputFor(scenario: DefaultScenario): PublishOfferV2Input {
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
  };
}

function makeWorld() {
  const core = new InMemoryStoreCore();
  const scenario = makeDefaultScenario(core);
  const seller = core.sellerApi({ userId: scenario.managerUserId });
  return { core, scenario, seller };
}

/**
 * The plaintext code a first reserve issues. A replay of an already used
 * clientReservationId carries null instead, so a fixture that needs the raw
 * code says so rather than silently threading a null through.
 */
function requireCode(pickupCode: string | null): string {
  if (pickupCode === null) {
    throw new Error("expected a freshly issued pickup code, received a replay");
  }
  return pickupCode;
}

function pilotSource(): Promise<FeatureFlagsV2> {
  return Promise.resolve({ marketplaceMode: "pilot" });
}

async function renderScreen(buyerApi: BuyerMarketplaceApiV2, core: InMemoryStoreCore, scenario: DefaultScenario) {
  const screen = render(
    createElement(
      FeatureFlagsProvider,
      { source: pilotSource },
      createElement(
        ApiProvider,
        { buyerApi, sellerApi: core.sellerApi({ userId: scenario.managerUserId }) },
        createElement(ReservationsScreen)
      )
    )
  );

  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

  return screen;
}

describe("ReservationsScreen in pilot mode", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockAsyncStorage.clear();
    mockSecureStore.clear();
  });

  it("shows the empty state when the installation has no reservations", async () => {
    const { core, scenario } = makeWorld();

    const screen = await renderScreen(core.buyerApi(), core, scenario);

    await waitFor(() => expect(screen.getByTestId("reservations-v2-empty")).toBeTruthy());
  });

  it("lists a held reservation with its hint, reveals the code on request, and links to the offer", async () => {
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
    const heldCode = requireCode(held.value.pickupCode);
    // Calling the facade directly to seed this fixture skips
    // useReserveOfferV2, so the SecureStore write a real reserve() call
    // would have made has to be simulated here for reveal to find anything.
    mockSecureStore.set(pickupCodeKeyV2(held.value.reservation.id), heldCode);

    const screen = await renderScreen(core.buyerApi(), core, scenario);

    await waitFor(() =>
      expect(
        screen.getByTestId(`reservation-v2-card-${held.value.reservation.id}`)
      ).toBeTruthy()
    );
    expect(screen.getByText("Bakery rescue box")).toBeTruthy();
    expect(screen.getByText("Reserved")).toBeTruthy();
    expect(
      screen.getByText(new RegExp(heldCode.slice(-2)))
    ).toBeTruthy();

    fireEvent.press(
      screen.getByTestId(`reservation-v2-reveal-${held.value.reservation.id}`)
    );

    await waitFor(() =>
      expect(
        screen.getByTestId(`reservation-v2-code-${held.value.reservation.id}`)
      ).toHaveTextContent(heldCode)
    );

    fireEvent.press(
      screen.getByTestId(`reservation-v2-view-${held.value.reservation.id}`)
    );
    expect(mockPush).toHaveBeenCalledWith(`/offer/${published.value.id}`);
  });

  it("shows a retryable error state without throwing when the list request fails", async () => {
    const { core, scenario } = makeWorld();
    const failingBuyerApi: BuyerMarketplaceApiV2 = {
      ...core.buyerApi(),
      getBuyerReservationsV2: async () => ({
        ok: false,
        error: { code: "network_error", message: "Network unavailable", retryable: true },
      }),
    };

    const screen = await renderScreen(failingBuyerApi, core, scenario);

    await waitFor(() => expect(screen.getByTestId("reservations-v2-error")).toBeTruthy());

    failingBuyerApi.getBuyerReservationsV2 = core.buyerApi().getBuyerReservationsV2;
    fireEvent.press(screen.getByTestId("reservations-v2-retry"));

    await waitFor(() => expect(screen.getByTestId("reservations-v2-empty")).toBeTruthy());
  });
});

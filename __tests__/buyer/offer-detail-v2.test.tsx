/* eslint-disable @typescript-eslint/no-require-imports */
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { createElement, type ReactNode } from "react";
import { Alert } from "react-native";

import { OfferDetailV2 } from "@/components/buyer/OfferDetailV2";
import { ApiProvider, type BuyerMarketplaceApiV2 } from "@/lib/api";
import type { FeatureFlagsV2, PublishOfferV2Input } from "@/lib/contracts";
import { FeatureFlagsProvider } from "@/lib/feature-flags";
import {
  InMemoryStoreCore,
  makeDefaultScenario,
  type DefaultScenario,
} from "@/lib/test-kit";
import { persistPickupCodeV2 } from "@/lib/buyer/secure-pickup-code";

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

jest.mock("@/lib/buyer/installation-id", () => ({
  useInstallationId: () => "installation-a",
}));

const mockAsyncStorage = new Map<string, string>();
const mockSecureStore = new Map<string, string>();

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockAsyncStorage.get(key) ?? null)),
  setItem: jest.fn((key: string, value: string) => {
    mockAsyncStorage.set(key, value);
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    mockAsyncStorage.delete(key);
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
    mockAsyncStorage.clear();
    mockSecureStore.clear();
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

  it("reserves the offer and shows the raw pickup code immediately after success", async () => {
    const { core, scenario, seller } = makeWorld();
    const published = await seller.approveAndPublishOfferV2(publishInputFor(scenario));
    if (!published.ok) throw new Error("expected publish to succeed");

    const screen = await renderDetail(published.value.id, core.buyerApi(), core, scenario);
    await waitFor(() => expect(screen.getByText("Bakery rescue box")).toBeTruthy());

    await act(async () => {
      fireEvent.press(screen.getByTestId("offer-detail-v2-reserve-button"));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(screen.getByTestId("offer-detail-v2-reservation-panel")).toBeTruthy()
    );
    expect(screen.getByTestId("offer-detail-v2-pickup-code")).toHaveTextContent(
      /^[A-Z0-9]{6}$/
    );
    expect(screen.getByTestId("offer-detail-v2-cancel-button")).toBeTruthy();
    expect(screen.queryByTestId("offer-detail-v2-reserve-button")).toBeNull();
  });

  it("recovers a held reservation on remount and only reveals the code on request", async () => {
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
    // Calling the facade directly (as this setup does to simulate a prior
    // session) skips useReserveOfferV2 entirely, so the prior session's own
    // SecureStore write has to be simulated explicitly here.
    await persistPickupCodeV2(held.value.reservation.id, held.value.pickupCode);

    // A fresh render stands in for the app restarting, no reserve() call
    // happens in this session, recovery relies entirely on the server list
    // and the previously persisted SecureStore entry.
    const screen = await renderDetail(published.value.id, core.buyerApi(), core, scenario);

    await waitFor(() =>
      expect(screen.getByTestId("offer-detail-v2-reservation-panel")).toBeTruthy()
    );
    expect(
      screen.getByTestId("offer-detail-v2-pickup-code-hint")
    ).toHaveTextContent(new RegExp(held.value.pickupCode.slice(-2)));
    expect(screen.queryByTestId("offer-detail-v2-pickup-code")).toBeNull();

    fireEvent.press(screen.getByTestId("offer-detail-v2-reveal-code-button"));

    await waitFor(() =>
      expect(screen.getByTestId("offer-detail-v2-pickup-code")).toHaveTextContent(
        held.value.pickupCode
      )
    );
  });

  it("cancels a held reservation after the buyer confirms and shows the buyer cancelled state", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation((_title, _message, buttons) => {
      const confirmButton = buttons?.find((button) => button.style === "destructive");
      confirmButton?.onPress?.();
    });
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

    const screen = await renderDetail(published.value.id, core.buyerApi(), core, scenario);
    await waitFor(() =>
      expect(screen.getByTestId("offer-detail-v2-cancel-button")).toBeTruthy()
    );

    fireEvent.press(screen.getByTestId("offer-detail-v2-cancel-button"));

    expect(alertSpy).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText("Cancelled")).toBeTruthy(), {
      timeout: 3000,
    });
    expect(screen.getByText("You cancelled this reservation.")).toBeTruthy();
    expect(screen.queryByTestId("offer-detail-v2-cancel-button")).toBeNull();

    alertSpy.mockRestore();
  });

  it("shows the fulfilled terminal state with distinct copy once the seller marks pickup complete", async () => {
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
    await seller.fulfillReservationV2({
      storeId: scenario.storeId,
      pickupCode: held.value.pickupCode,
      idempotencyKey: "fulfill-key-1",
    });

    const screen = await renderDetail(published.value.id, core.buyerApi(), core, scenario);

    await waitFor(() => expect(screen.getByText("Picked up")).toBeTruthy());
    expect(screen.getByTestId("offer-detail-v2-reservation-history")).toBeTruthy();
    expect(screen.getByText("This reservation was picked up.")).toBeTruthy();
    expect(screen.queryByTestId("offer-detail-v2-cancel-button")).toBeNull();
    // The offer still has stock (3 published, 1 fulfilled), the fulfilled
    // history entry must not hide the still-available reserve button.
    expect(screen.getByTestId("offer-detail-v2-reserve-button")).not.toBeDisabled();
  });

  it("shows the stock mismatch terminal state with copy distinct from a seller cancellation", async () => {
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
      reason: "shelf count came up short",
      idempotencyKey: "mismatch-key-1",
    });

    const screen = await renderDetail(published.value.id, core.buyerApi(), core, scenario);

    await waitFor(() => expect(screen.getByText("Unavailable")).toBeTruthy());
    expect(screen.getByTestId("offer-detail-v2-reservation-history")).toBeTruthy();
    expect(
      screen.getByText(
        "The seller found a stock mismatch. This reservation could not be honored."
      )
    ).toBeTruthy();
    expect(screen.queryByTestId("offer-detail-v2-cancel-button")).toBeNull();
    // A stock mismatch pauses the offer itself, the reserve button stays
    // present (this is still a history entry, not a hidden action) but
    // disabled, distinct from a fully hidden control.
    expect(screen.getByTestId("offer-detail-v2-reserve-button")).toBeDisabled();
    expect(screen.getByText("This offer is temporarily paused")).toBeTruthy();
  });

  it("shows distinct seller cancelled and no show copy for terminal states the fake cannot yet produce", async () => {
    // The in memory fake has no facade method that transitions a
    // reservation to cancelled_by_seller or expired_no_show today (see
    // Task 3's handoff notes), so this test drives the copy mapping through
    // a narrowly overridden getBuyerReservationsV2 response rather than the
    // fake's own state machine, everything else stays the real fake.
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

    const sellerCancelledApi: BuyerMarketplaceApiV2 = {
      ...core.buyerApi(),
      getBuyerReservationsV2: async () => ({
        ok: true,
        value: [{ ...held.value.reservation, status: "cancelled_by_seller" }],
      }),
    };
    const sellerCancelledScreen = await renderDetail(
      published.value.id,
      sellerCancelledApi,
      core,
      scenario
    );
    await waitFor(() => expect(sellerCancelledScreen.getByText("Cancelled by seller")).toBeTruthy());
    expect(
      sellerCancelledScreen.getByTestId("offer-detail-v2-reservation-history")
    ).toBeTruthy();
    expect(
      sellerCancelledScreen.getByText(
        "The seller cancelled this reservation. Your unit was released."
      )
    ).toBeTruthy();
    // The offer itself was never touched by this override, it is still
    // live and in stock, a seller cancellation for one past reservation
    // must not hide the reserve button for a new attempt.
    expect(
      sellerCancelledScreen.getByTestId("offer-detail-v2-reserve-button")
    ).not.toBeDisabled();

    const noShowApi: BuyerMarketplaceApiV2 = {
      ...core.buyerApi(),
      getBuyerReservationsV2: async () => ({
        ok: true,
        value: [{ ...held.value.reservation, status: "expired_no_show" }],
      }),
    };
    const noShowScreen = await renderDetail(published.value.id, noShowApi, core, scenario);
    await waitFor(() => expect(noShowScreen.getByText("Expired")).toBeTruthy());
    expect(
      noShowScreen.getByText(
        "The pickup window closed before this reservation was collected."
      )
    ).toBeTruthy();
  });

  it("shows a stale version message and refreshed availability when someone else reserves first", async () => {
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

    const screen = await renderDetail(published.value.id, core.buyerApi(), core, scenario);
    await waitFor(() => expect(screen.getByText("Bakery rescue box")).toBeTruthy());

    // Someone else grabs the only unit after this screen already loaded the
    // offer, the buyer's own reserve attempt now targets a stale version.
    await core.buyerApi().reserveOfferV2({
      offerId: published.value.id,
      quantity: 1,
      clientReservationId: "someone-elses-reservation",
      installationId: "another-installation",
      expectedOfferVersion: published.value.version,
    });

    await act(async () => {
      fireEvent.press(screen.getByTestId("offer-detail-v2-reserve-button"));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(
        screen.getByText(
          "Someone else updated this offer. We refreshed the details, please review and try again."
        )
      ).toBeTruthy()
    );
    await waitFor(() => expect(screen.getByText("Sold out")).toBeTruthy());
  });

  it("shows a retryable network error and lets the buyer retry the same reservation action", async () => {
    const { core, scenario, seller } = makeWorld();
    const published = await seller.approveAndPublishOfferV2(publishInputFor(scenario));
    if (!published.ok) throw new Error("expected publish to succeed");

    let shouldFail = true;
    const flakyBuyerApi: BuyerMarketplaceApiV2 = {
      ...core.buyerApi(),
      reserveOfferV2: async (input) => {
        if (shouldFail) {
          return {
            ok: false,
            error: { code: "network_error", message: "Network unavailable", retryable: true },
          };
        }
        return core.buyerApi().reserveOfferV2(input);
      },
    };

    const screen = await renderDetail(published.value.id, flakyBuyerApi, core, scenario);
    await waitFor(() => expect(screen.getByText("Bakery rescue box")).toBeTruthy());

    await act(async () => {
      fireEvent.press(screen.getByTestId("offer-detail-v2-reserve-button"));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(screen.getByText("Network problem. Please try again.")).toBeTruthy()
    );
    expect(screen.getByTestId("offer-detail-v2-reserve-button")).not.toBeDisabled();

    shouldFail = false;
    await act(async () => {
      fireEvent.press(screen.getByTestId("offer-detail-v2-reserve-button"));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(screen.getByTestId("offer-detail-v2-reservation-panel")).toBeTruthy()
    );
  });

  it("shows a still-available reserve button after cancelling, and a fresh reserve uses a new clientReservationId", async () => {
    const { core, scenario, seller } = makeWorld();
    const published = await seller.approveAndPublishOfferV2(publishInputFor(scenario));
    if (!published.ok) throw new Error("expected publish to succeed");

    const seenClientReservationIds: string[] = [];
    const trackingBuyerApi: BuyerMarketplaceApiV2 = {
      ...core.buyerApi(),
      reserveOfferV2: (input) => {
        seenClientReservationIds.push(input.clientReservationId);
        return core.buyerApi().reserveOfferV2(input);
      },
    };

    const screen = await renderDetail(published.value.id, trackingBuyerApi, core, scenario);
    await waitFor(() => expect(screen.getByText("Bakery rescue box")).toBeTruthy());

    fireEvent.press(screen.getByTestId("offer-detail-v2-reserve-button"));
    await waitFor(() =>
      expect(screen.getByTestId("offer-detail-v2-cancel-button")).toBeTruthy()
    );

    const alertSpy = jest
      .spyOn(Alert, "alert")
      .mockImplementation((_title, _message, buttons) => {
        buttons?.find((button) => button.style === "destructive")?.onPress?.();
      });

    fireEvent.press(screen.getByTestId("offer-detail-v2-cancel-button"));

    // The offer is still live and in stock (quantity 3, one held and
    // released again), the reserve button must come back rather than stay
    // gone forever just because this offer once had a reservation.
    await waitFor(() =>
      expect(screen.getByTestId("offer-detail-v2-reserve-button")).toBeTruthy()
    );
    alertSpy.mockRestore();
    expect(screen.getByTestId("offer-detail-v2-reserve-button")).not.toBeDisabled();
    expect(screen.queryByTestId("offer-detail-v2-cancel-button")).toBeNull();

    // The cancelled reservation still shows as history, distinct from the
    // now-available action panel.
    expect(screen.getByTestId("offer-detail-v2-reservation-history")).toBeTruthy();
    expect(screen.getByText("Cancelled")).toBeTruthy();

    fireEvent.press(screen.getByTestId("offer-detail-v2-reserve-button"));
    await waitFor(() =>
      expect(screen.getByTestId("offer-detail-v2-cancel-button")).toBeTruthy()
    );

    expect(seenClientReservationIds).toHaveLength(2);
    expect(seenClientReservationIds[0]).not.toBe(seenClientReservationIds[1]);
  });

  it("shows an honest message distinct from a reserve error when cancelling fails on a network problem", async () => {
    const { core, scenario, seller } = makeWorld();
    const published = await seller.approveAndPublishOfferV2(publishInputFor(scenario));
    if (!published.ok) throw new Error("expected publish to succeed");

    const flakyCancelBuyerApi: BuyerMarketplaceApiV2 = {
      ...core.buyerApi(),
      cancelReservationV2: async () => ({
        ok: false,
        error: { code: "network_error", message: "Network unavailable", retryable: true },
      }),
    };

    const screen = await renderDetail(published.value.id, flakyCancelBuyerApi, core, scenario);
    await waitFor(() => expect(screen.getByText("Bakery rescue box")).toBeTruthy());

    fireEvent.press(screen.getByTestId("offer-detail-v2-reserve-button"));
    await waitFor(() =>
      expect(screen.getByTestId("offer-detail-v2-cancel-button")).toBeTruthy()
    );

    const alertSpy = jest
      .spyOn(Alert, "alert")
      .mockImplementation((_title, _message, buttons) => {
        buttons?.find((button) => button.style === "destructive")?.onPress?.();
      });

    fireEvent.press(screen.getByTestId("offer-detail-v2-cancel-button"));

    await waitFor(() =>
      expect(
        screen.getByText("Could not cancel, check your connection and try again.")
      ).toBeTruthy()
    );
    alertSpy.mockRestore();

    // The reservation stays held, a failed cancel must not be silently
    // swallowed or read as a reserve failure.
    expect(screen.getByTestId("offer-detail-v2-cancel-button")).toBeTruthy();
    expect(screen.queryByTestId("offer-detail-v2-reserve-error")).toBeNull();
    expect(screen.getByTestId("offer-detail-v2-cancel-error")).toBeTruthy();
  });
});

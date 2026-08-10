/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React, { type ReactNode } from "react";

import OrdersScreen from "@/app/(seller-tabs)/orders";
import { ApiProvider, type SellerStoreApiV2 } from "@/lib/api";
import type { MarketplaceOfferV2, Result, SellerPickupV2 } from "@/lib/contracts";
import { InMemoryStoreCore, makeDefaultScenario } from "@/lib/test-kit";

const mockLegacyRefresh = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("@/components/ScreenScrollView", () => {
  const ReactMock = require("react");
  const { ScrollView } = require("react-native");
  return {
    ScreenScrollView: ({ children, ...props }: { children: ReactNode }) =>
      ReactMock.createElement(ScrollView, props, children),
  };
});

jest.mock("@/components/seller/Scanner", () => ({
  Scanner: () => null,
}));

jest.mock("@/lib/locale-store", () => ({
  useLocale: () => "en",
  useSetLocale: () => jest.fn(),
}));

jest.mock("@/lib/seller/orders-store", () => ({
  useOrders: () => ({
    error: null,
    isLoading: false,
    lastLoadedAt: null,
    orders: [],
    refreshOrders: mockLegacyRefresh,
    verifyingOrderId: null,
    verifyPickup: jest.fn(),
  }),
}));

function makeWorld() {
  const core = new InMemoryStoreCore();
  const scenario = makeDefaultScenario(core);
  return { core, scenario };
}

function providerTree(sellerApi: SellerStoreApiV2, children: ReactNode) {
  const buyerApiStub = {} as never;
  return (
    <ApiProvider buyerApi={buyerApiStub} sellerApi={sellerApi}>
      {children}
    </ApiProvider>
  );
}

function expectOk<T>(result: Result<T>): T {
  if (!result.ok) {
    throw new Error(`expected ok, received ${result.error.code}`);
  }
  return result.value;
}

async function publishOffer(
  core: InMemoryStoreCore,
  scenario: ReturnType<typeof makeDefaultScenario>,
  quantity = 4
): Promise<MarketplaceOfferV2> {
  return expectOk(
    await core.sellerApi({ userId: scenario.managerUserId }).approveAndPublishOfferV2({
      allocation: {
        physicallySetAside: false,
        quantity,
        storeProductId: scenario.highConfidenceProductId,
      },
      allergens: ["gluten"],
      cancellationPolicy: "Cancel before pickup",
      category: "bakery",
      contents: ["bread"],
      dietaryBadges: [],
      idempotencyKey: `publish-${quantity}`,
      imageUrl: null,
      offerPriceUzs: 18000,
      pickupEnd: scenario.pickupEnd,
      pickupInstructions: "Show the pickup code",
      pickupStart: scenario.pickupStart,
      referencePriceUzs: 30000,
      storeId: scenario.storeId,
      title: "Bread rescue box",
    })
  );
}

async function reserve(
  core: InMemoryStoreCore,
  scenario: ReturnType<typeof makeDefaultScenario>,
  offer: MarketplaceOfferV2,
  sequence: number
) {
  return expectOk(
    await core.buyerApi().reserveOfferV2({
      clientReservationId: `client-reservation-${sequence}`,
      expectedOfferVersion: offer.version + sequence - 1,
      installationId: `installation-${sequence}`,
      offerId: offer.id,
      quantity: 1,
    })
  );
}

describe("Seller v2 pickup queue and fulfillment", () => {
  beforeEach(() => {
    mockLegacyRefresh.mockClear();
  });

  it("shows held pickups newest first and keeps terminal pickups in a separate segment", async () => {
    const { core, scenario } = makeWorld();
    const offer = await publishOffer(core, scenario);
    const first = await reserve(core, scenario, offer, 1);
    const second = await reserve(core, scenario, offer, 2);
    const third = await reserve(core, scenario, offer, 3);
    expectOk(
      await core.sellerApi({ userId: scenario.managerUserId }).fulfillReservationV2({
        idempotencyKey: "fulfill-first",
        pickupCode: first.pickupCode,
        storeId: scenario.storeId,
      })
    );

    const screen = render(
      providerTree(
        core.sellerApi({ userId: scenario.managerUserId }),
        <OrdersScreen />
      )
    );

    await waitFor(() =>
      expect(screen.getByTestId(`pickups-v2-row-${third.reservation.id}`)).toBeTruthy()
    );
    const pendingRows = screen.getAllByTestId(/^pickups-v2-row-/);
    expect(pendingRows.map((row) => row.props.testID)).toEqual([
      `pickups-v2-row-${third.reservation.id}`,
      `pickups-v2-row-${second.reservation.id}`,
    ]);
    expect(
      screen.queryByTestId(`pickups-v2-row-${first.reservation.id}`)
    ).toBeNull();

    fireEvent.press(screen.getByTestId("pickups-v2-terminal-segment"));

    expect(screen.getByTestId(`pickups-v2-row-${first.reservation.id}`)).toBeTruthy();
    expect(
      screen.queryByTestId(`pickups-v2-row-${third.reservation.id}`)
    ).toBeNull();
  });

  it("sends the raw field value once while in flight and reuses the action key for a safe repeat", async () => {
    const { core, scenario } = makeWorld();
    const offer = await publishOffer(core, scenario);
    const held = await reserve(core, scenario, offer, 1);
    const workingApi = core.sellerApi({ userId: scenario.managerUserId });
    const seenInputs: { key: string; pickupCode: string }[] = [];
    let resolveFulfillment!: (result: Result<SellerPickupV2>) => void;
    let firstCall = true;
    const delayedApi: SellerStoreApiV2 = {
      ...workingApi,
      fulfillReservationV2: (input) => {
        seenInputs.push({ key: input.idempotencyKey, pickupCode: input.pickupCode });
        if (firstCall) {
          firstCall = false;
          return new Promise((resolve) => {
            resolveFulfillment = resolve;
          });
        }
        return workingApi.fulfillReservationV2(input);
      },
    };
    const screen = render(providerTree(delayedApi, <OrdersScreen />));

    await waitFor(() =>
      expect(screen.getByTestId(`pickups-v2-row-${held.reservation.id}`)).toBeTruthy()
    );
    fireEvent.changeText(screen.getByTestId("pickups-v2-code-input"), held.pickupCode);
    fireEvent.press(screen.getByTestId("pickups-v2-fulfill-button"));
    fireEvent.press(screen.getByTestId("pickups-v2-fulfill-button"));

    expect(seenInputs).toHaveLength(1);
    expect(seenInputs[0].pickupCode).toBe(held.pickupCode);

    resolveFulfillment(
      await workingApi.fulfillReservationV2({
        idempotencyKey: seenInputs[0].key,
        pickupCode: held.pickupCode,
        storeId: scenario.storeId,
      })
    );

    await waitFor(() =>
      expect(screen.getByTestId("pickups-v2-success-state")).toBeTruthy()
    );
    expect(screen.getByDisplayValue(held.pickupCode)).toBeTruthy();
    fireEvent.press(screen.getByTestId("pickups-v2-fulfill-button"));

    await waitFor(() => expect(seenInputs).toHaveLength(2));
    expect(seenInputs[1].key).toBe(seenInputs[0].key);
  });

  it("renders honest wrong-code and stale terminal errors, then refreshes the queue", async () => {
    const { core, scenario } = makeWorld();
    const offer = await publishOffer(core, scenario);
    const held = await reserve(core, scenario, offer, 1);
    const managerApi = core.sellerApi({ userId: scenario.managerUserId });
    const screen = render(providerTree(managerApi, <OrdersScreen />));

    await waitFor(() =>
      expect(screen.getByTestId(`pickups-v2-row-${held.reservation.id}`)).toBeTruthy()
    );
    fireEvent.changeText(screen.getByTestId("pickups-v2-code-input"), "WRONG-CODE");
    fireEvent.press(screen.getByTestId("pickups-v2-fulfill-button"));

    await waitFor(() =>
      expect(screen.getByTestId("pickups-v2-not-found-error")).toHaveTextContent(
        "No active pickup matches that code. Check the full code and try again."
      )
    );

    expectOk(
      await core.buyerApi().cancelReservationV2({
        idempotencyKey: "buyer-cancel-stale-pickup",
        installationId: "installation-1",
        reservationId: held.reservation.id,
      })
    );
    fireEvent.changeText(screen.getByTestId("pickups-v2-code-input"), held.pickupCode);
    fireEvent.press(screen.getByTestId("pickups-v2-fulfill-button"));

    await waitFor(() =>
      expect(screen.getByTestId("pickups-v2-invalid-state-error")).toHaveTextContent(
        "This reservation is no longer active. The queue has been refreshed with its latest state."
      )
    );
    fireEvent.press(screen.getByTestId("pickups-v2-terminal-segment"));
    await waitFor(() =>
      expect(screen.getByTestId(`pickups-v2-row-${held.reservation.id}`)).toBeTruthy()
    );
  });

  it("lets staff view the queue but hides fulfillment controls", async () => {
    const { core, scenario } = makeWorld();
    const offer = await publishOffer(core, scenario);
    const held = await reserve(core, scenario, offer, 1);
    const screen = render(
      providerTree(core.sellerApi({ userId: scenario.staffUserId }), <OrdersScreen />)
    );

    await waitFor(() =>
      expect(screen.getByTestId(`pickups-v2-row-${held.reservation.id}`)).toBeTruthy()
    );
    expect(screen.queryByTestId("pickups-v2-code-input")).toBeNull();
    expect(screen.queryByTestId("pickups-v2-fulfill-button")).toBeNull();
    expect(screen.getByTestId("pickups-v2-role-guidance")).toBeTruthy();
  });

  it("reports a forbidden queue read as an access problem, not a connection problem", async () => {
    const { core, scenario } = makeWorld();
    const workingApi = core.sellerApi({ userId: scenario.managerUserId });
    const forbiddenApi: SellerStoreApiV2 = {
      ...workingApi,
      listSellerPickupsV2: async () => ({
        error: { code: "forbidden", message: "membership removed", retryable: false },
        ok: false,
      }),
    };
    const screen = render(providerTree(forbiddenApi, <OrdersScreen />));

    await waitFor(() =>
      expect(screen.getByTestId("pickups-v2-load-error")).toHaveTextContent(
        "You no longer have access to this store's pickup queue.Retry"
      )
    );
  });

  it("retries a failed queue read and never logs or retains a fulfilled raw code", async () => {
    const { core, scenario } = makeWorld();
    const offer = await publishOffer(core, scenario);
    const held = await reserve(core, scenario, offer, 1);
    const workingApi = core.sellerApi({ userId: scenario.managerUserId });
    let listAttempts = 0;
    const flakyApi: SellerStoreApiV2 = {
      ...workingApi,
      listSellerPickupsV2: async (storeId) => {
        listAttempts += 1;
        if (listAttempts === 1) {
          return {
            error: { code: "network_error", message: "offline", retryable: true },
            ok: false,
          };
        }
        return workingApi.listSellerPickupsV2(storeId);
      },
    };
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => undefined);
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const screen = render(providerTree(flakyApi, <OrdersScreen />));

    await waitFor(() =>
      expect(screen.getByTestId("pickups-v2-load-error")).toHaveTextContent(
        "Unable to load pickups. Check your connection and retry.Retry"
      )
    );
    fireEvent.press(screen.getByTestId("pickups-v2-retry-button"));
    await waitFor(() =>
      expect(screen.getByTestId(`pickups-v2-row-${held.reservation.id}`)).toBeTruthy()
    );

    fireEvent.changeText(screen.getByTestId("pickups-v2-code-input"), held.pickupCode);
    fireEvent.press(screen.getByTestId("pickups-v2-fulfill-button"));
    await waitFor(() =>
      expect(screen.getByTestId("pickups-v2-success-state")).toBeTruthy()
    );

    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue(held.pickupCode)).toBeTruthy();
    screen.unmount();

    const remounted = render(providerTree(workingApi, <OrdersScreen />));
    await waitFor(() =>
      expect(remounted.getByTestId("pickups-v2-code-input")).toBeTruthy()
    );
    expect(remounted.queryByDisplayValue(held.pickupCode)).toBeNull();
    logSpy.mockRestore();
    warnSpy.mockRestore();
  });
});

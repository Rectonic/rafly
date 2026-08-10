/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React, { type ReactNode } from "react";

import OrdersScreen from "@/app/(seller-tabs)/orders";
import { ApiProvider, type SellerStoreApiV2 } from "@/lib/api";
import type {
  MarketplaceOfferV2,
  ReportStockMismatchV2Input,
  Result,
  StoreExceptionV2,
} from "@/lib/contracts";
import { InMemoryStoreCore, makeDefaultScenario } from "@/lib/test-kit";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  router: { push: mockPush },
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

jest.mock("@/components/seller/Scanner", () => ({ Scanner: () => null }));

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
    refreshOrders: jest.fn(),
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
  return (
    <ApiProvider buyerApi={{} as never} sellerApi={sellerApi}>
      {children}
    </ApiProvider>
  );
}

function expectOk<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(`expected ok, received ${result.error.code}`);
  return result.value;
}

async function publishAndReserve(
  core: InMemoryStoreCore,
  scenario: ReturnType<typeof makeDefaultScenario>,
  reservationCount = 1,
  actionSuffix = "main"
) {
  const offer = expectOk(
    await core.sellerApi({ userId: scenario.managerUserId }).approveAndPublishOfferV2({
      allocation: {
        physicallySetAside: false,
        quantity: 4,
        storeProductId: scenario.highConfidenceProductId,
      },
      allergens: [],
      cancellationPolicy: null,
      category: "bakery",
      contents: ["bread"],
      dietaryBadges: [],
      idempotencyKey: `publish-for-mismatch-${actionSuffix}`,
      imageUrl: null,
      offerPriceUzs: 18000,
      pickupEnd: scenario.pickupEnd,
      pickupInstructions: null,
      pickupStart: scenario.pickupStart,
      referencePriceUzs: 30000,
      storeId: scenario.storeId,
      title: `Bread rescue box ${actionSuffix}`,
    })
  );
  const reservations = [];
  for (let sequence = 1; sequence <= reservationCount; sequence += 1) {
    reservations.push(
      expectOk(
        await core.buyerApi().reserveOfferV2({
          clientReservationId: `mismatch-client-${actionSuffix}-${sequence}`,
          expectedOfferVersion: offer.version + sequence - 1,
          installationId: `mismatch-installation-${actionSuffix}-${sequence}`,
          offerId: offer.id,
          quantity: 1,
        })
      )
    );
  }
  return { offer, reservations };
}

function openMismatchForm(
  screen: ReturnType<typeof render>,
  reservationId: string
) {
  fireEvent.press(screen.getByTestId(`pickups-v2-report-mismatch-${reservationId}`));
}

describe("Seller v2 stock mismatch", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it("requires a non-empty reason while accepting an observed quantity of zero", async () => {
    const { core, scenario } = makeWorld();
    const { reservations } = await publishAndReserve(core, scenario);
    const workingApi = core.sellerApi({ userId: scenario.managerUserId });
    const seenInputs: ReportStockMismatchV2Input[] = [];
    const spyApi: SellerStoreApiV2 = {
      ...workingApi,
      reportStockMismatchV2: async (input) => {
        seenInputs.push(input);
        return workingApi.reportStockMismatchV2(input);
      },
    };
    const screen = render(providerTree(spyApi, <OrdersScreen />));

    await waitFor(() =>
      expect(
        screen.getByTestId(`pickups-v2-row-${reservations[0].reservation.id}`)
      ).toBeTruthy()
    );
    openMismatchForm(screen, reservations[0].reservation.id);
    fireEvent.changeText(screen.getByTestId("pickups-v2-mismatch-observed-input"), "0");
    fireEvent.changeText(screen.getByTestId("pickups-v2-mismatch-reason-input"), "   ");

    expect(screen.getByTestId("pickups-v2-mismatch-reason-required")).toBeTruthy();
    fireEvent.press(screen.getByTestId("pickups-v2-mismatch-submit-button"));
    expect(seenInputs).toHaveLength(0);

    fireEvent.changeText(
      screen.getByTestId("pickups-v2-mismatch-reason-input"),
      "Shelf was empty"
    );
    fireEvent.press(screen.getByTestId("pickups-v2-mismatch-submit-button"));

    await waitFor(() => expect(seenInputs).toHaveLength(1));
    expect(seenInputs[0].observedQuantity).toBe(0);
    expect(seenInputs[0].reason).toBe("Shelf was empty");
  });

  it("reuses one idempotency key when the same mismatch action is retried", async () => {
    const { core, scenario } = makeWorld();
    const { reservations } = await publishAndReserve(core, scenario);
    const workingApi = core.sellerApi({ userId: scenario.managerUserId });
    const seenKeys: string[] = [];
    let attempts = 0;
    const flakyApi: SellerStoreApiV2 = {
      ...workingApi,
      reportStockMismatchV2: async (input) => {
        attempts += 1;
        seenKeys.push(input.idempotencyKey);
        if (attempts === 1) {
          return {
            error: { code: "network_error", message: "offline", retryable: true },
            ok: false,
          };
        }
        return workingApi.reportStockMismatchV2(input);
      },
    };
    const screen = render(providerTree(flakyApi, <OrdersScreen />));

    await waitFor(() =>
      expect(
        screen.getByTestId(`pickups-v2-row-${reservations[0].reservation.id}`)
      ).toBeTruthy()
    );
    openMismatchForm(screen, reservations[0].reservation.id);
    fireEvent.changeText(screen.getByTestId("pickups-v2-mismatch-observed-input"), "0");
    fireEvent.changeText(
      screen.getByTestId("pickups-v2-mismatch-reason-input"),
      "Shelf was empty"
    );
    fireEvent.press(screen.getByTestId("pickups-v2-mismatch-submit-button"));
    await waitFor(() =>
      expect(screen.getByTestId("pickups-v2-mismatch-network-error")).toBeTruthy()
    );
    fireEvent.press(screen.getByTestId("pickups-v2-mismatch-submit-button"));

    await waitFor(() => expect(seenKeys).toHaveLength(2));
    expect(seenKeys[0]).toBe(seenKeys[1]);
  });

  it("waits for backend confirmation, then shows the paused offer and every affected failed pickup", async () => {
    const { core, scenario } = makeWorld();
    const { reservations } = await publishAndReserve(core, scenario, 2);
    const workingApi = core.sellerApi({ userId: scenario.managerUserId });
    let resolveMismatch!: (
      result: Result<{ offer: MarketplaceOfferV2; exception: StoreExceptionV2 }>
    ) => void;
    let pendingInput: ReportStockMismatchV2Input | null = null;
    const delayedApi: SellerStoreApiV2 = {
      ...workingApi,
      reportStockMismatchV2: (input) => {
        pendingInput = input;
        return new Promise((resolve) => {
          resolveMismatch = resolve;
        });
      },
    };
    const screen = render(providerTree(delayedApi, <OrdersScreen />));

    await waitFor(() =>
      expect(
        screen.getByTestId(`pickups-v2-row-${reservations[0].reservation.id}`)
      ).toBeTruthy()
    );
    openMismatchForm(screen, reservations[0].reservation.id);
    fireEvent.changeText(screen.getByTestId("pickups-v2-mismatch-observed-input"), "0");
    fireEvent.changeText(
      screen.getByTestId("pickups-v2-mismatch-reason-input"),
      "Shelf was empty"
    );
    fireEvent.press(screen.getByTestId("pickups-v2-mismatch-submit-button"));

    expect(screen.queryByTestId("pickups-v2-mismatch-success")).toBeNull();
    expect(screen.getByTestId("pickups-v2-mismatch-submitting")).toBeTruthy();
    if (!pendingInput) throw new Error("mismatch input was not captured");
    resolveMismatch(await workingApi.reportStockMismatchV2(pendingInput));

    await waitFor(() =>
      expect(screen.getByTestId("pickups-v2-mismatch-success")).toHaveTextContent(
        "Offer paused after the stock mismatch was confirmed."
      )
    );
    fireEvent.press(screen.getByTestId("pickups-v2-terminal-segment"));
    await waitFor(() =>
      expect(
        screen.getByTestId(`pickups-v2-status-${reservations[1].reservation.id}`)
      ).toHaveTextContent("Failed, stock mismatch")
    );
    expect(
      screen.getByTestId(`pickups-v2-status-${reservations[0].reservation.id}`)
    ).toHaveTextContent("Failed, stock mismatch");
  });

  it("shows recount guidance linked to the affected product", async () => {
    const { core, scenario } = makeWorld();
    const { reservations } = await publishAndReserve(core, scenario);
    const screen = render(
      providerTree(core.sellerApi({ userId: scenario.managerUserId }), <OrdersScreen />)
    );

    await waitFor(() =>
      expect(
        screen.getByTestId(`pickups-v2-row-${reservations[0].reservation.id}`)
      ).toBeTruthy()
    );
    openMismatchForm(screen, reservations[0].reservation.id);
    fireEvent.changeText(screen.getByTestId("pickups-v2-mismatch-observed-input"), "0");
    fireEvent.changeText(
      screen.getByTestId("pickups-v2-mismatch-reason-input"),
      "Shelf was empty"
    );
    fireEvent.press(screen.getByTestId("pickups-v2-mismatch-submit-button"));

    await waitFor(() =>
      expect(screen.getByTestId("pickups-v2-mismatch-recount-guidance")).toBeTruthy()
    );
    // The guidance points managers to the in-app resolution command and is
    // explicit that failed reservation units return only after resolution.
    const guidance = screen.getByTestId("pickups-v2-mismatch-recount-guidance");
    expect(guidance).toHaveTextContent("resolve the exception in the inventory screen", {
      exact: false,
    });
    expect(guidance).toHaveTextContent("return to the offerable quantity", {
      exact: false,
    });
    fireEvent.press(screen.getByTestId("pickups-v2-mismatch-recount-button"));
    expect(mockPush).toHaveBeenCalledWith({
      params: { storeProductId: scenario.highConfidenceProductId },
      pathname: "/(seller-tabs)/count-session-v2",
    });
  });

  it("keeps a general recount path when the exception has no related product", async () => {
    const { core, scenario } = makeWorld();
    const { reservations } = await publishAndReserve(core, scenario);
    const workingApi = core.sellerApi({ userId: scenario.managerUserId });
    const noProductApi: SellerStoreApiV2 = {
      ...workingApi,
      reportStockMismatchV2: async (input) => {
        const response = await workingApi.reportStockMismatchV2(input);
        if (!response.ok) return response;
        return {
          ok: true,
          value: {
            ...response.value,
            exception: {
              ...response.value.exception,
              relatedStoreProductId: null,
            },
          },
        };
      },
    };
    const screen = render(providerTree(noProductApi, <OrdersScreen />));

    await waitFor(() =>
      expect(
        screen.getByTestId(`pickups-v2-row-${reservations[0].reservation.id}`)
      ).toBeTruthy()
    );
    openMismatchForm(screen, reservations[0].reservation.id);
    fireEvent.changeText(screen.getByTestId("pickups-v2-mismatch-observed-input"), "0");
    fireEvent.changeText(
      screen.getByTestId("pickups-v2-mismatch-reason-input"),
      "Shelf was empty"
    );
    fireEvent.press(screen.getByTestId("pickups-v2-mismatch-submit-button"));

    await waitFor(() =>
      expect(screen.getByTestId("pickups-v2-mismatch-recount-button")).toBeTruthy()
    );
    fireEvent.press(screen.getByTestId("pickups-v2-mismatch-recount-button"));
    expect(mockPush).toHaveBeenCalledWith("/(seller-tabs)/count-session-v2");
  });

  it("clears a prior confirmation when the manager starts a different mismatch action", async () => {
    const { core, scenario } = makeWorld();
    const first = await publishAndReserve(core, scenario, 1, "first");
    const second = await publishAndReserve(core, scenario, 1, "second");
    const screen = render(
      providerTree(core.sellerApi({ userId: scenario.managerUserId }), <OrdersScreen />)
    );

    await waitFor(() =>
      expect(
        screen.getByTestId(`pickups-v2-row-${first.reservations[0].reservation.id}`)
      ).toBeTruthy()
    );
    openMismatchForm(screen, first.reservations[0].reservation.id);
    fireEvent.changeText(screen.getByTestId("pickups-v2-mismatch-observed-input"), "0");
    fireEvent.changeText(
      screen.getByTestId("pickups-v2-mismatch-reason-input"),
      "First shelf was empty"
    );
    fireEvent.press(screen.getByTestId("pickups-v2-mismatch-submit-button"));
    await waitFor(() =>
      expect(screen.getByTestId("pickups-v2-mismatch-success")).toBeTruthy()
    );

    openMismatchForm(screen, second.reservations[0].reservation.id);

    expect(screen.queryByTestId("pickups-v2-mismatch-success")).toBeNull();
    expect(screen.queryByTestId("pickups-v2-mismatch-recount-guidance")).toBeNull();
  });

  it("keeps the offer and pickup visibly active when the backend rejects the mismatch", async () => {
    const { core, scenario } = makeWorld();
    const { reservations } = await publishAndReserve(core, scenario);
    const workingApi = core.sellerApi({ userId: scenario.managerUserId });
    const rejectingApi: SellerStoreApiV2 = {
      ...workingApi,
      reportStockMismatchV2: async () => ({
        error: { code: "invalid_state", message: "offer changed", retryable: false },
        ok: false,
      }),
    };
    const screen = render(providerTree(rejectingApi, <OrdersScreen />));

    await waitFor(() =>
      expect(
        screen.getByTestId(`pickups-v2-row-${reservations[0].reservation.id}`)
      ).toBeTruthy()
    );
    openMismatchForm(screen, reservations[0].reservation.id);
    fireEvent.changeText(screen.getByTestId("pickups-v2-mismatch-observed-input"), "0");
    fireEvent.changeText(
      screen.getByTestId("pickups-v2-mismatch-reason-input"),
      "Shelf was empty"
    );
    fireEvent.press(screen.getByTestId("pickups-v2-mismatch-submit-button"));

    await waitFor(() =>
      expect(screen.getByTestId("pickups-v2-mismatch-invalid-state-error")).toBeTruthy()
    );
    expect(screen.queryByTestId("pickups-v2-mismatch-success")).toBeNull();
    expect(
      screen.getByTestId(`pickups-v2-status-${reservations[0].reservation.id}`)
    ).toHaveTextContent("Waiting for pickup");
    expect(screen.queryByTestId("pickups-v2-mismatch-recount-guidance")).toBeNull();
  });

  it("hides stock mismatch controls from staff", async () => {
    const { core, scenario } = makeWorld();
    const { reservations } = await publishAndReserve(core, scenario);
    const screen = render(
      providerTree(core.sellerApi({ userId: scenario.staffUserId }), <OrdersScreen />)
    );

    await waitFor(() =>
      expect(
        screen.getByTestId(`pickups-v2-row-${reservations[0].reservation.id}`)
      ).toBeTruthy()
    );
    expect(
      screen.queryByTestId(`pickups-v2-report-mismatch-${reservations[0].reservation.id}`)
    ).toBeNull();
  });
});

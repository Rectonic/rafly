/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React, { type ReactNode } from "react";
import { TextInput } from "react-native";

import InventoryV2Screen from "@/app/(seller-tabs)/inventory-v2";
import { ApiProvider, type SellerStoreApiV2 } from "@/lib/api";
import { InMemoryStoreCore, makeDefaultScenario } from "@/lib/test-kit";

/**
 * Sequence 2, inventory and confidence. The inventory v2 screen is a pure
 * read surface: it renders InventorySummaryV2 rows exactly as the backend
 * computed them and never exposes a control that could set onHandQuantity
 * directly, the only path to a stock change is the count session in
 * sequence 3.
 */

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
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
  useSetLocale: () => jest.fn(),
}));

function makeWorld() {
  const core = new InMemoryStoreCore();
  const scenario = makeDefaultScenario(core);
  const mediumConfidenceProductId = core.addProduct({
    storeId: scenario.storeId,
    productName: "Half price cheese wheel",
    barcode: null,
    category: "dairy",
    onHandQuantity: 3,
    confidence: "medium",
    lastVerifiedAt: null,
    expiryDate: null,
  });
  return { core, mediumConfidenceProductId, scenario };
}

function providerTree(sellerApi: SellerStoreApiV2, children: ReactNode) {
  const buyerApiStub = {} as never;
  return (
    <ApiProvider buyerApi={buyerApiStub} sellerApi={sellerApi}>
      {children}
    </ApiProvider>
  );
}

describe("Seller v2 inventory and confidence", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it("shows a loading state while the access gate and the inventory list resolve", async () => {
    const { core, scenario } = makeWorld();
    const sellerApi = core.sellerApi({ userId: scenario.managerUserId });

    const screen = render(providerTree(sellerApi, <InventoryV2Screen />));

    expect(screen.getByTestId("inventory-v2-access-loading")).toBeTruthy();

    await waitFor(() =>
      expect(screen.getByTestId("inventory-v2-item-summary")).toBeTruthy()
    );
  });

  it("shows the honest empty state when the store has no tracked products", async () => {
    const core = new InMemoryStoreCore();
    const storeId = core.createStore({
      name: "Empty store",
      pilotModeEnabled: true,
      shopSellerBetaEnabled: true,
    });
    core.addMembership({ storeId, userId: "user-empty-owner", role: "owner" });
    const sellerApi = core.sellerApi({ userId: "user-empty-owner" });

    const screen = render(providerTree(sellerApi, <InventoryV2Screen />));

    await waitFor(() => expect(screen.getByTestId("inventory-v2-empty-state")).toBeTruthy());
  });

  it("shows an error state with a working retry when the inventory fetch fails", async () => {
    const { core, scenario } = makeWorld();
    const workingApi = core.sellerApi({ userId: scenario.managerUserId });
    let callCount = 0;
    const flakyApi: SellerStoreApiV2 = {
      ...workingApi,
      listStoreInventoryV2: async (storeId) => {
        callCount += 1;
        if (callCount === 1) {
          return {
            ok: false,
            error: { code: "network_error", message: "Inventory offline", retryable: true },
          };
        }
        return workingApi.listStoreInventoryV2(storeId);
      },
    };

    const screen = render(providerTree(flakyApi, <InventoryV2Screen />));

    await waitFor(() => expect(screen.getByTestId("inventory-v2-error-state")).toBeTruthy());
    expect(screen.getByText("Inventory offline")).toBeTruthy();

    fireEvent.press(screen.getByTestId("inventory-v2-retry-button"));

    await waitFor(() =>
      expect(screen.queryByTestId("inventory-v2-error-state")).toBeNull()
    );
    expect(screen.getByTestId("inventory-v2-item-summary")).toBeTruthy();
  });

  it("shows high, medium, and low confidence with last verified time, optional barcode, and optional expiry", async () => {
    const { core, mediumConfidenceProductId, scenario } = makeWorld();
    const sellerApi = core.sellerApi({ userId: scenario.managerUserId });

    const screen = render(providerTree(sellerApi, <InventoryV2Screen />));
    await waitFor(() => expect(screen.getByTestId("inventory-v2-item-summary")).toBeTruthy());

    // High confidence, has both a barcode and an expiry date.
    expect(
      screen.getByTestId(`inventory-v2-confidence-${scenario.highConfidenceProductId}`)
    ).toHaveTextContent("High confidence");
    expect(
      screen.getByTestId(`inventory-v2-last-verified-${scenario.highConfidenceProductId}`)
    ).toBeTruthy();
    expect(
      screen.getByTestId(`inventory-v2-barcode-${scenario.highConfidenceProductId}`)
    ).toBeTruthy();
    expect(
      screen.getByTestId(`inventory-v2-expiry-${scenario.highConfidenceProductId}`)
    ).toBeTruthy();
    expect(
      screen.getByTestId(`inventory-v2-max-offerable-${scenario.highConfidenceProductId}`)
    ).toHaveTextContent("10", { exact: false });

    // Low confidence, never verified, no barcode recorded in this fixture line.
    expect(
      screen.getByTestId(`inventory-v2-confidence-${scenario.lowConfidenceProductId}`)
    ).toHaveTextContent("Low confidence");
    expect(
      screen.getByTestId(`inventory-v2-last-verified-${scenario.lowConfidenceProductId}`)
    ).toHaveTextContent("Never verified");

    // Medium confidence fixture added for this suite, barcode and expiry optional and absent.
    expect(
      screen.getByTestId(`inventory-v2-confidence-${mediumConfidenceProductId}`)
    ).toHaveTextContent("Medium confidence");
    expect(
      screen.queryByTestId(`inventory-v2-barcode-${mediumConfidenceProductId}`)
    ).toBeNull();
    expect(
      screen.queryByTestId(`inventory-v2-expiry-${mediumConfidenceProductId}`)
    ).toBeNull();
  });

  it("summarizes the exception count and offers a per item action only where an exception is open", async () => {
    const { core, scenario } = makeWorld();
    const manager = core.sellerApi({ userId: scenario.managerUserId });
    const offer = await manager.approveAndPublishOfferV2({
      storeId: scenario.storeId,
      idempotencyKey: "publish-for-mismatch",
      allocation: {
        storeProductId: scenario.highConfidenceProductId,
        quantity: 2,
        physicallySetAside: false,
      },
      title: "Bakery rescue box",
      category: "bakery",
      imageUrl: null,
      contents: ["bread"],
      offerPriceUzs: 20000,
      referencePriceUzs: 50000,
      pickupStart: scenario.pickupStart,
      pickupEnd: scenario.pickupEnd,
      allergens: [],
      dietaryBadges: [],
      pickupInstructions: null,
      cancellationPolicy: null,
    });
    if (!offer.ok) throw new Error("expected publish to succeed");
    await manager.reportStockMismatchV2({
      storeId: scenario.storeId,
      offerId: offer.value.id,
      observedQuantity: 0,
      reason: "shelf was empty",
      idempotencyKey: "mismatch-key-1",
    });

    const screen = render(providerTree(manager, <InventoryV2Screen />));
    await waitFor(() => expect(screen.getByTestId("inventory-v2-item-summary")).toBeTruthy());

    expect(screen.getByTestId("inventory-v2-exceptions-summary")).toHaveTextContent("1", {
      exact: false,
    });
    expect(
      screen.getByTestId(`inventory-v2-exception-action-${scenario.highConfidenceProductId}`)
    ).toBeTruthy();
    expect(
      screen.queryByTestId(`inventory-v2-exception-action-${scenario.lowConfidenceProductId}`)
    ).toBeNull();
  });

  it("never exposes a direct quantity edit control on the inventory screen", async () => {
    const { core, scenario } = makeWorld();
    const sellerApi = core.sellerApi({ userId: scenario.managerUserId });

    const screen = render(providerTree(sellerApi, <InventoryV2Screen />));
    await waitFor(() => expect(screen.getByTestId("inventory-v2-item-summary")).toBeTruthy());

    expect(screen.UNSAFE_queryAllByType(TextInput)).toHaveLength(0);
  });

  it("shows record count for staff but hides publish, and shows both for manager", async () => {
    const { core, scenario } = makeWorld();

    const staffScreen = render(
      providerTree(
        core.sellerApi({ userId: scenario.staffUserId }),
        <InventoryV2Screen />
      )
    );
    await waitFor(() =>
      expect(staffScreen.getByTestId("inventory-v2-record-count-button")).toBeTruthy()
    );
    expect(staffScreen.queryByTestId("inventory-v2-publish-button")).toBeNull();

    const managerScreen = render(
      providerTree(
        core.sellerApi({ userId: scenario.managerUserId }),
        <InventoryV2Screen />
      )
    );
    await waitFor(() =>
      expect(managerScreen.getByTestId("inventory-v2-record-count-button")).toBeTruthy()
    );
    expect(managerScreen.getByTestId("inventory-v2-publish-button")).toBeTruthy();
  });

  it("falls back to the access gate states outside the granted case", async () => {
    const { core, scenario } = makeWorld();
    const stranger = core.sellerApi({ userId: scenario.strangerUserId });

    const screen = render(providerTree(stranger, <InventoryV2Screen />));

    await waitFor(() =>
      expect(screen.getByTestId("inventory-v2-no-membership")).toBeTruthy()
    );
    expect(screen.queryByTestId("inventory-v2-item-summary")).toBeNull();
  });
});

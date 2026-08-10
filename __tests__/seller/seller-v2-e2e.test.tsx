/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React, { type ReactNode } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import CountSessionV2Screen from "@/app/(seller-tabs)/count-session-v2";
import CreateOfferScreen from "@/app/(seller-tabs)/create";
import SellerDashboardScreen from "@/app/(seller-tabs)/index";
import InventoryV2Screen from "@/app/(seller-tabs)/inventory-v2";
import OrdersScreen from "@/app/(seller-tabs)/orders";
import PublishV2Screen from "@/app/(seller-tabs)/publish-v2";
import BusinessTypeScreen from "@/app/auth/business-type";
import { ApiProvider, type SellerStoreApiV2 } from "@/lib/api";
import type { Result } from "@/lib/contracts";
import { LocaleProvider } from "@/lib/locale-store";
import { MarketplaceProvider } from "@/lib/marketplace-store";
import { AuthProvider } from "@/lib/seller/auth-store";
import { InMemoryStoreCore, makeDefaultScenario } from "@/lib/test-kit";

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({}),
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

jest.mock("@expo/vector-icons/Ionicons", () => () => null);

const safeAreaMetrics = {
  frame: { height: 844, width: 390, x: 0, y: 0 },
  insets: { bottom: 0, left: 0, right: 0, top: 0 },
};

function sellerTree(
  core: InMemoryStoreCore,
  sellerApi: SellerStoreApiV2,
  children: ReactNode
) {
  return (
    <SafeAreaProvider initialMetrics={safeAreaMetrics}>
      <LocaleProvider>
        <ApiProvider buyerApi={core.buyerApi()} sellerApi={sellerApi}>
          {children}
        </ApiProvider>
      </LocaleProvider>
    </SafeAreaProvider>
  );
}

function authenticatedSellerTree(
  core: InMemoryStoreCore,
  sellerApi: SellerStoreApiV2,
  children: ReactNode
) {
  return sellerTree(
    core,
    sellerApi,
    <AuthProvider>
      <MarketplaceProvider>{children}</MarketplaceProvider>
    </AuthProvider>
  );
}

function expectOk<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(`expected ok, received ${result.error.code}`);
  return result.value;
}

describe("Seller v2 end-to-end paths", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockReplace.mockClear();
    process.env.EXPO_PUBLIC_LASTBITE_E2E_LOCAL_SELLER = "1";
    process.env.EXPO_PUBLIC_LASTBITE_E2E_SELLER_TYPE = "shop";
  });

  afterEach(() => {
    delete process.env.EXPO_PUBLIC_LASTBITE_E2E_LOCAL_SELLER;
    delete process.env.EXPO_PUBLIC_LASTBITE_E2E_SELLER_TYPE;
  });

  it("connects the beta inventory hub to the real pickup queue", async () => {
    const core = new InMemoryStoreCore();
    const scenario = makeDefaultScenario(core);
    const manager = core.sellerApi({ userId: scenario.managerUserId });
    const screen = render(sellerTree(core, manager, <InventoryV2Screen />));

    await waitFor(() =>
      expect(
        screen.getByTestId(`inventory-v2-row-${scenario.highConfidenceProductId}`)
      ).toBeTruthy()
    );
    fireEvent.press(screen.getByTestId("inventory-v2-pickups-button"));

    expect(mockPush).toHaveBeenCalledWith("/(seller-tabs)/orders");
  });

  it("keeps the Restaurant Seller orders flow frozen under the v2 API provider", async () => {
    process.env.EXPO_PUBLIC_LASTBITE_E2E_SELLER_TYPE = "restaurant";
    const core = new InMemoryStoreCore();
    const scenario = makeDefaultScenario(core);
    const manager = core.sellerApi({ userId: scenario.managerUserId });
    const screen = render(authenticatedSellerTree(core, manager, <OrdersScreen />));

    await waitFor(() =>
      expect(screen.getByTestId("seller-orders-screen")).toBeTruthy()
    );
    expect(screen.getByTestId("orders-manual-code-input")).toBeTruthy();
    expect(screen.queryByTestId("pickups-v2-screen")).toBeNull();
  });

  it("runs onboarding, count, approval, publication, fulfillment, and mismatch through one real fake", async () => {
    process.env.EXPO_PUBLIC_LASTBITE_E2E_SELLER_TYPE = "restaurant";
    const core = new InMemoryStoreCore();
    const scenario = makeDefaultScenario(core);
    const manager = core.sellerApi({ userId: scenario.managerUserId });

    const journey = render(
      authenticatedSellerTree(core, manager, <BusinessTypeScreen />)
    );
    await waitFor(() =>
      expect(journey.getByTestId("business-type-shop-button")).toBeTruthy()
    );
    fireEvent.press(journey.getByTestId("business-type-shop-button"));
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith("/(seller-tabs)")
    );

    journey.rerender(
      authenticatedSellerTree(core, manager, <SellerDashboardScreen />)
    );
    await waitFor(() =>
      expect(journey.getByTestId("seller-dashboard-beta-banner")).toBeTruthy()
    );
    fireEvent.press(journey.getByTestId("seller-dashboard-primary-action"));
    expect(mockPush).toHaveBeenLastCalledWith("/(seller-tabs)/inventory");
    fireEvent.press(journey.getByTestId("seller-dashboard-beta-banner"));
    expect(mockPush).toHaveBeenLastCalledWith("/(seller-tabs)/inventory-v2");
    journey.unmount();

    const inventory = render(sellerTree(core, manager, <InventoryV2Screen />));
    await waitFor(() =>
      expect(
        inventory.getByTestId(`inventory-v2-row-${scenario.highConfidenceProductId}`)
      ).toBeTruthy()
    );
    expect(inventory.getByTestId("inventory-v2-item-summary")).toBeTruthy();
    inventory.unmount();

    const count = render(sellerTree(core, manager, <CountSessionV2Screen />));
    await waitFor(() =>
      expect(
        count.getByTestId(`count-session-v2-select-${scenario.highConfidenceProductId}`)
      ).toBeTruthy()
    );
    fireEvent.press(
      count.getByTestId(`count-session-v2-select-${scenario.highConfidenceProductId}`)
    );
    fireEvent.changeText(
      count.getByTestId(`count-session-v2-quantity-${scenario.highConfidenceProductId}`),
      "8"
    );
    fireEvent.press(count.getByTestId("count-session-v2-submit-button"));
    await waitFor(() =>
      expect(
        count.getByTestId(`count-session-v2-approve-${scenario.highConfidenceProductId}`)
      ).toBeTruthy()
    );
    fireEvent.press(
      count.getByTestId(`count-session-v2-approve-${scenario.highConfidenceProductId}`)
    );
    await waitFor(() =>
      expect(
        count.getByTestId(`count-session-v2-decided-${scenario.highConfidenceProductId}`)
      ).toBeTruthy()
    );
    count.unmount();

    const publish = render(sellerTree(core, manager, <PublishV2Screen />));
    await waitFor(() =>
      expect(
        publish.getByTestId(`publish-v2-product-${scenario.highConfidenceProductId}`)
      ).toBeTruthy()
    );
    fireEvent.press(
      publish.getByTestId(`publish-v2-product-${scenario.highConfidenceProductId}`)
    );
    fireEvent.changeText(publish.getByTestId("publish-v2-quantity-input"), "3");
    fireEvent.changeText(publish.getByTestId("publish-v2-title-input"), "E2E bread box");
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

    const publishedOffers = expectOk(await manager.listStoreOffersV2(scenario.storeId));
    const offer = publishedOffers.find((candidate) => candidate.title === "E2E bread box");
    if (!offer) throw new Error("published E2E offer was not found");
    const firstReservation = expectOk(
      await core.buyerApi().reserveOfferV2({
        clientReservationId: "seller-e2e-first",
        expectedOfferVersion: offer.version,
        installationId: scenario.installationA,
        offerId: offer.id,
        quantity: 1,
      })
    );

    const pickup = render(sellerTree(core, manager, <OrdersScreen />));
    await waitFor(() =>
      expect(
        pickup.getByTestId(`pickups-v2-row-${firstReservation.reservation.id}`)
      ).toBeTruthy()
    );
    fireEvent.changeText(
      pickup.getByTestId("pickups-v2-code-input"),
      firstReservation.pickupCode
    );
    fireEvent.press(pickup.getByTestId("pickups-v2-fulfill-button"));
    await waitFor(() =>
      expect(pickup.getByTestId("pickups-v2-success-state")).toBeTruthy()
    );
    pickup.unmount();

    const refreshedOffer = expectOk(
      await manager.listStoreOffersV2(scenario.storeId)
    ).find((candidate) => candidate.id === offer.id);
    if (!refreshedOffer) throw new Error("fulfilled offer was not found");
    const secondReservation = expectOk(
      await core.buyerApi().reserveOfferV2({
        clientReservationId: "seller-e2e-second",
        expectedOfferVersion: refreshedOffer.version,
        installationId: scenario.installationB,
        offerId: offer.id,
        quantity: 1,
      })
    );

    const mismatch = render(sellerTree(core, manager, <OrdersScreen />));
    await waitFor(() =>
      expect(
        mismatch.getByTestId(`pickups-v2-row-${secondReservation.reservation.id}`)
      ).toBeTruthy()
    );
    fireEvent.press(
      mismatch.getByTestId(
        `pickups-v2-report-mismatch-${secondReservation.reservation.id}`
      )
    );
    fireEvent.changeText(
      mismatch.getByTestId("pickups-v2-mismatch-observed-input"),
      "0"
    );
    fireEvent.changeText(
      mismatch.getByTestId("pickups-v2-mismatch-reason-input"),
      "E2E shelf mismatch"
    );
    fireEvent.press(mismatch.getByTestId("pickups-v2-mismatch-submit-button"));
    await waitFor(() =>
      expect(mismatch.getByTestId("pickups-v2-mismatch-success")).toBeTruthy()
    );

    const finalOffer = expectOk(
      await manager.listStoreOffersV2(scenario.storeId)
    ).find((candidate) => candidate.id === offer.id);
    expect(finalOffer?.status).toBe("paused");
    const finalPickups = expectOk(await manager.listSellerPickupsV2(scenario.storeId));
    expect(
      finalPickups.find(
        (candidate) => candidate.reservationId === firstReservation.reservation.id
      )?.status
    ).toBe("fulfilled");
    expect(
      finalPickups.find(
        (candidate) => candidate.reservationId === secondReservation.reservation.id
      )?.status
    ).toBe("failed_stock_mismatch");
    mismatch.unmount();

    const staff = core.sellerApi({ userId: scenario.staffUserId });
    const staffPickups = render(sellerTree(core, staff, <OrdersScreen />));
    await waitFor(() =>
      expect(staffPickups.getByTestId("pickups-v2-role-guidance")).toBeTruthy()
    );
    expect(staffPickups.queryByTestId("pickups-v2-code-input")).toBeNull();
    expect(staffPickups.queryAllByTestId(/^pickups-v2-report-mismatch-/)).toEqual([]);
    staffPickups.unmount();

    const staffPublish = render(sellerTree(core, staff, <PublishV2Screen />));
    await waitFor(() =>
      expect(staffPublish.getByTestId("publish-v2-forbidden-state")).toBeTruthy()
    );
    staffPublish.unmount();

    process.env.EXPO_PUBLIC_LASTBITE_E2E_SELLER_TYPE = "restaurant";
    const restaurant = render(
      authenticatedSellerTree(core, manager, <CreateOfferScreen />)
    );
    await waitFor(() =>
      expect(restaurant.getByTestId("create-offer-screen")).toBeTruthy()
    );
    expect(restaurant.getByTestId("meal-form-title-input")).toBeTruthy();
    expect(restaurant.getByTestId("meal-form-submit-button")).toBeTruthy();
  });
});

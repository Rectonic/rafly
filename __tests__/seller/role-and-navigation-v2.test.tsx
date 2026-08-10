/* eslint-disable @typescript-eslint/no-require-imports */
import { act, render, renderHook, waitFor } from "@testing-library/react-native";
import React, { type ReactNode } from "react";

import CreateOfferScreen from "@/app/(seller-tabs)/create";
import SellerDashboardScreen from "@/app/(seller-tabs)/index";
import { ApiProvider, type SellerStoreApiV2 } from "@/lib/api";
import { InMemoryStoreCore, makeDefaultScenario } from "@/lib/test-kit";
import {
  canApproveAndPublishV2,
  canRecordInventoryCountV2,
  useStoreMembershipV2,
} from "@/lib/seller/store-context-v2";

/**
 * Sequence 1, role and navigation. Covers the Shop Seller beta access gate
 * that every later v2 screen reads from: membership, store flag, and role
 * collapse into one access value so a screen never has to reimplement the
 * gating rule on its own.
 */

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockSignOut = jest.fn();
const mockUpdateProfile = jest.fn();

const mockRestaurantSellerProfile = {
  address: "Tashkent",
  businessName: "LastBite Demo Seller",
  businessType: "restaurant" as const,
  category: "Bakery",
  latitude: 41.31,
  longitude: 69.27,
};

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
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

jest.mock("@/components/seller/Scanner", () => ({
  Scanner: () => null,
}));

jest.mock("@/lib/locale-store", () => ({
  useLocale: () => "en",
  useSetLocale: () => jest.fn(),
}));

jest.mock("@/lib/seller/auth-store", () => ({
  useAuth: () => ({
    sellerProfile: mockRestaurantSellerProfile,
    signOut: mockSignOut,
  }),
}));

jest.mock("@/lib/seller/inventory-store", () => ({
  useInventory: () => ({ items: [] }),
}));

jest.mock("@/lib/seller/offers-store", () => ({
  useSellerOffers: () => ({
    isLoading: false,
    offers: [],
    publishOffer: jest.fn(),
  }),
}));

jest.mock("@/lib/seller/orders-store", () => ({
  useOrders: () => ({
    error: null,
    isLoading: false,
    orders: [],
    refreshOrders: jest.fn(),
    verifyPickup: jest.fn(),
  }),
}));

jest.mock("@/lib/seller/profile-store", () => ({
  useSellerProfile: () => ({
    updateProfile: mockUpdateProfile,
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

describe("Seller v2 role and navigation", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockReplace.mockClear();
    mockSignOut.mockReset();
    mockUpdateProfile.mockReset();
  });

  describe("access gate role rules", () => {
    it("permits count recording for staff, manager, and owner but not operator", () => {
      expect(canRecordInventoryCountV2("staff")).toBe(true);
      expect(canRecordInventoryCountV2("manager")).toBe(true);
      expect(canRecordInventoryCountV2("owner")).toBe(true);
      expect(canRecordInventoryCountV2("operator")).toBe(false);
      expect(canRecordInventoryCountV2(null)).toBe(false);
    });

    it("permits approval and publication only for manager and owner", () => {
      expect(canApproveAndPublishV2("staff")).toBe(false);
      expect(canApproveAndPublishV2("manager")).toBe(true);
      expect(canApproveAndPublishV2("owner")).toBe(true);
      expect(canApproveAndPublishV2("operator")).toBe(false);
      expect(canApproveAndPublishV2(null)).toBe(false);
    });
  });

  describe("useStoreMembershipV2", () => {
    it("grants access with the role attached once membership and the store flag are both present", async () => {
      const { core, scenario } = makeWorld();
      const sellerApi = core.sellerApi({ userId: scenario.managerUserId });

      const { result } = renderHook(() => useStoreMembershipV2(), {
        wrapper: ({ children }) => providerTree(sellerApi, children),
      });

      await waitFor(() => expect(result.current.access).toBe("granted"));
      expect(result.current.role).toBe("manager");
      expect(result.current.activeMembership?.storeId).toBe(scenario.storeId);
      expect(result.current.canRecordCount).toBe(true);
      expect(result.current.canApproveAndPublish).toBe(true);
    });

    it("denies staff the approval capability while keeping count recording", async () => {
      const { core, scenario } = makeWorld();
      const sellerApi = core.sellerApi({ userId: scenario.staffUserId });

      const { result } = renderHook(() => useStoreMembershipV2(), {
        wrapper: ({ children }) => providerTree(sellerApi, children),
      });

      await waitFor(() => expect(result.current.access).toBe("granted"));
      expect(result.current.role).toBe("staff");
      expect(result.current.canRecordCount).toBe(true);
      expect(result.current.canApproveAndPublish).toBe(false);
    });

    it("grants owner the same capabilities as manager", async () => {
      const { core, scenario } = makeWorld();
      const sellerApi = core.sellerApi({ userId: scenario.ownerUserId });

      const { result } = renderHook(() => useStoreMembershipV2(), {
        wrapper: ({ children }) => providerTree(sellerApi, children),
      });

      await waitFor(() => expect(result.current.access).toBe("granted"));
      expect(result.current.canRecordCount).toBe(true);
      expect(result.current.canApproveAndPublish).toBe(true);
    });

    it("fails closed when the store flag disables the Shop Seller beta", async () => {
      const core = new InMemoryStoreCore();
      const storeId = core.createStore({
        name: "Beta disabled store",
        pilotModeEnabled: true,
        shopSellerBetaEnabled: false,
      });
      core.addMembership({ storeId, userId: "user-owner-disabled", role: "owner" });
      const sellerApi = core.sellerApi({ userId: "user-owner-disabled" });

      const { result } = renderHook(() => useStoreMembershipV2(), {
        wrapper: ({ children }) => providerTree(sellerApi, children),
      });

      await waitFor(() => expect(result.current.access).toBe("disabled"));
      expect(result.current.role).toBe("owner");
      expect(result.current.canRecordCount).toBe(false);
      expect(result.current.canApproveAndPublish).toBe(false);
    });

    it("treats a stranger with no store membership as a cross-store state, not a crash", async () => {
      const { core, scenario } = makeWorld();
      const sellerApi = core.sellerApi({ userId: scenario.strangerUserId });

      const { result } = renderHook(() => useStoreMembershipV2(), {
        wrapper: ({ children }) => providerTree(sellerApi, children),
      });

      await waitFor(() => expect(result.current.access).toBe("no-membership"));
      expect(result.current.activeMembership).toBeNull();
      expect(result.current.role).toBeNull();
      expect(result.current.canRecordCount).toBe(false);
      expect(result.current.canApproveAndPublish).toBe(false);
    });

    it("treats a missing ApiProvider as unauthenticated and falls back without crashing", () => {
      const { result } = renderHook(() => useStoreMembershipV2());

      expect(result.current.access).toBe("unavailable");
      expect(result.current.memberships).toEqual([]);
      expect(result.current.canRecordCount).toBe(false);
      expect(result.current.canApproveAndPublish).toBe(false);
    });

    it("surfaces a membership fetch error with a working retry", async () => {
      const { core, scenario } = makeWorld();
      const workingApi = core.sellerApi({ userId: scenario.managerUserId });
      let callCount = 0;
      const flakyApi: SellerStoreApiV2 = {
        ...workingApi,
        getMyStoreMembershipsV2: async () => {
          callCount += 1;
          if (callCount === 1) {
            return {
              ok: false,
              error: { code: "network_error", message: "offline", retryable: true },
            };
          }
          return workingApi.getMyStoreMembershipsV2();
        },
      };

      const { result } = renderHook(() => useStoreMembershipV2(), {
        wrapper: ({ children }) => providerTree(flakyApi, children),
      });

      await waitFor(() => expect(result.current.access).toBe("error"));
      expect(result.current.error?.code).toBe("network_error");

      await act(async () => {
        await result.current.refresh();
      });

      await waitFor(() => expect(result.current.access).toBe("granted"));
    });
  });

  describe("dashboard beta entry point", () => {
    it("stays hidden with the ordinary v1 dashboard when no ApiProvider is mounted", () => {
      const screen = render(<SellerDashboardScreen />);

      expect(screen.getByTestId("seller-dashboard-screen")).toBeTruthy();
      expect(screen.queryByTestId("seller-dashboard-beta-banner")).toBeNull();
    });

    it("shows the beta entry point once membership, flag, and role are all granted", async () => {
      const { core, scenario } = makeWorld();
      const sellerApi = core.sellerApi({ userId: scenario.managerUserId });

      const screen = render(
        providerTree(sellerApi, <SellerDashboardScreen />)
      );

      await waitFor(() =>
        expect(screen.getByTestId("seller-dashboard-beta-banner")).toBeTruthy()
      );
      screen.getByTestId("seller-dashboard-screen");
    });

    it("keeps the beta entry point hidden when the store flag is disabled", async () => {
      const core = new InMemoryStoreCore();
      const storeId = core.createStore({
        name: "Beta disabled store",
        pilotModeEnabled: true,
        shopSellerBetaEnabled: false,
      });
      core.addMembership({ storeId, userId: "user-manager-disabled", role: "manager" });
      const sellerApi = core.sellerApi({ userId: "user-manager-disabled" });

      const screen = render(
        providerTree(sellerApi, <SellerDashboardScreen />)
      );

      await waitFor(() => expect(mockPush).not.toHaveBeenCalled());
      expect(screen.queryByTestId("seller-dashboard-beta-banner")).toBeNull();
    });
  });

  describe("frozen Restaurant Seller flow", () => {
    it("renders and behaves exactly as before even with v2 providers mounted", () => {
      const { core, scenario } = makeWorld();
      const sellerApi = core.sellerApi({ userId: scenario.managerUserId });

      const screen = render(providerTree(sellerApi, <CreateOfferScreen />));

      expect(screen.getByTestId("create-offer-screen")).toBeTruthy();
      expect(screen.getByTestId("meal-form-title-input")).toBeTruthy();
      expect(screen.getByTestId("meal-form-submit-button")).toBeTruthy();
      expect(screen.queryByTestId("seller-dashboard-beta-banner")).toBeNull();
    });
  });
});

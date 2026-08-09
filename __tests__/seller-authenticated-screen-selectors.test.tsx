import { fireEvent, render } from "@testing-library/react-native";
import React, { type ReactNode } from "react";
import { ScrollView, Text } from "react-native";

import CreateOfferScreen from "@/app/(seller-tabs)/create";
import SellerDashboardScreen from "@/app/(seller-tabs)/index";
import OrdersScreen from "@/app/(seller-tabs)/orders";
import SellerProfileScreen from "@/app/(seller-tabs)/profile";

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockRefreshOrders = jest.fn();
const mockVerifyPickup = jest.fn();
const mockUpdateProfile = jest.fn();
const mockSignOut = jest.fn();
const mockCreateElement = React.createElement;
const mockScrollView = ScrollView;
const mockText = Text;
let mockInventoryItems: unknown[] = [];
let mockSellerOffers: unknown[] = [];
let mockOrders: unknown[] = [];
const mockSellerProfile = {
  address: "Tashkent",
  businessName: "LastBite Demo Seller",
  businessType: "restaurant",
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

jest.mock("@/components/ScreenScrollView", () => ({
  ScreenScrollView: ({
    children,
    ...props
  }: {
    children: ReactNode;
  }) => mockCreateElement(mockScrollView, props, children),
}));

jest.mock("@/components/seller/Scanner", () => ({
  Scanner: ({ visible }: { visible: boolean }) =>
    visible
      ? mockCreateElement(mockText, { testID: "scanner-modal" }, "Scanner")
      : null,
}));

jest.mock("@/lib/locale-store", () => ({
  useLocale: () => "en",
  useSetLocale: () => jest.fn(),
}));

jest.mock("@/lib/seller/auth-store", () => ({
  useAuth: () => ({
    sellerProfile: mockSellerProfile,
    signOut: mockSignOut,
  }),
}));

jest.mock("@/lib/seller/inventory-store", () => ({
  useInventory: () => ({
    items: mockInventoryItems,
  }),
}));

jest.mock("@/lib/seller/offers-store", () => ({
  useSellerOffers: () => ({
    isLoading: false,
    offers: mockSellerOffers,
    publishOffer: jest.fn(),
  }),
}));

jest.mock("@/lib/seller/orders-store", () => ({
  useOrders: () => ({
    error: null,
    isLoading: false,
    orders: mockOrders,
    refreshOrders: mockRefreshOrders,
    verifyPickup: mockVerifyPickup,
  }),
}));

jest.mock("@/lib/seller/profile-store", () => ({
  useSellerProfile: () => ({
    updateProfile: mockUpdateProfile,
  }),
}));

describe("authenticated seller screen selectors", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockRefreshOrders.mockClear();
    mockReplace.mockClear();
    mockSignOut.mockReset();
    mockUpdateProfile.mockReset();
    mockVerifyPickup.mockReset();
    mockInventoryItems = [];
    mockSellerOffers = [];
    mockOrders = [];
  });

  it("exposes seller dashboard navigation selectors", () => {
    const screen = render(<SellerDashboardScreen />);

    expect(screen.getByTestId("seller-dashboard-screen")).toBeTruthy();
    expect(screen.getByTestId("seller-dashboard-primary-action")).toBeTruthy();

    fireEvent.press(screen.getByTestId("seller-dashboard-primary-action"));

    expect(mockPush).toHaveBeenCalledWith("/(seller-tabs)/create");
  });

  it("shows a seller setup checklist with the next incomplete action", () => {
    const screen = render(<SellerDashboardScreen />);

    expect(screen.getByTestId("seller-setup-checklist")).toBeTruthy();
    expect(screen.getByText("Profile ready")).toBeTruthy();
    expect(screen.getByText("Publish first package")).toBeTruthy();
    expect(screen.getByText("Verify first pickup")).toBeTruthy();

    fireEvent.press(screen.getByTestId("seller-setup-action-offer"));

    expect(mockPush).toHaveBeenCalledWith("/(seller-tabs)/create");
  });

  it("exposes create-offer form selectors", () => {
    const screen = render(<CreateOfferScreen />);

    expect(screen.getByTestId("create-offer-screen")).toBeTruthy();
    expect(screen.getByTestId("meal-form-title-input")).toBeTruthy();
    expect(screen.getByTestId("meal-form-contents-input")).toBeTruthy();
    expect(screen.getByTestId("meal-form-old-price-input")).toBeTruthy();
    expect(screen.getByTestId("meal-form-new-price-input")).toBeTruthy();
    expect(screen.getByTestId("meal-form-quantity-input")).toBeTruthy();
    expect(screen.getByTestId("meal-form-submit-button")).toBeTruthy();
  });

  it("exposes orders and scanner selectors", () => {
    const screen = render(<OrdersScreen />);

    expect(screen.getByTestId("seller-orders-screen")).toBeTruthy();
    expect(screen.getByTestId("orders-refresh-button")).toBeTruthy();
    expect(screen.getByTestId("orders-segment-pending")).toBeTruthy();
    expect(screen.getByTestId("orders-segment-collected")).toBeTruthy();
    expect(screen.getByTestId("orders-scan-code-button")).toBeTruthy();
    expect(screen.getByTestId("orders-manual-code-input")).toBeTruthy();
    expect(screen.getByTestId("orders-verify-code-button")).toBeTruthy();

    fireEvent.press(screen.getByTestId("orders-scan-code-button"));

    expect(screen.getByTestId("scanner-modal")).toBeTruthy();
  });

  it("exposes seller profile selectors", () => {
    const screen = render(<SellerProfileScreen />);

    expect(screen.getByTestId("seller-profile-screen")).toBeTruthy();
    expect(screen.getByTestId("seller-profile-business-name-input")).toBeTruthy();
    expect(screen.getByTestId("seller-profile-save-button")).toBeTruthy();
    expect(screen.getByTestId("seller-profile-switch-buyer-button")).toBeTruthy();
    expect(screen.getByTestId("seller-profile-sign-out-button")).toBeTruthy();

    fireEvent.press(screen.getByTestId("seller-profile-switch-buyer-button"));

    expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
  });
});

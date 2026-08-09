import { fireEvent, render } from "@testing-library/react-native";
import React, { type ReactNode } from "react";
import { ScrollView, Text } from "react-native";

import InventoryScreen from "@/app/(seller-tabs)/inventory";
import type { SellerProfile } from "@/types/seller";

const mockAddItem = jest.fn();
const mockDeleteItem = jest.fn();
const mockLoadItems = jest.fn();
const mockCreateElement = React.createElement;
const mockScrollView = ScrollView;
const mockText = Text;
let mockInventoryError: string | null = null;
let mockInventoryIsLoading = false;
let mockSellerProfile: Pick<SellerProfile, "businessType"> | null = {
  businessType: "shop",
};

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

jest.mock("@/lib/seller/auth-store", () => ({
  useAuth: () => ({
    sellerProfile: mockSellerProfile,
  }),
}));

jest.mock("@/lib/seller/inventory-store", () => ({
  useInventory: () => ({
    addItem: mockAddItem,
    deleteItem: mockDeleteItem,
    error: mockInventoryError,
    isLoading: mockInventoryIsLoading,
    items: [],
    loadItems: mockLoadItems,
  }),
}));

jest.mock("@/lib/locale-store", () => ({
  useLocale: () => "en",
}));

describe("InventoryScreen native selectors", () => {
  beforeEach(() => {
    mockAddItem.mockReset();
    mockDeleteItem.mockReset();
    mockLoadItems.mockReset();
    mockInventoryError = null;
    mockInventoryIsLoading = false;
    mockSellerProfile = { businessType: "shop" };
  });

  it("exposes shop inventory intake controls for native automation", () => {
    const screen = render(<InventoryScreen />);

    expect(screen.getByTestId("inventory-screen")).toBeTruthy();
    expect(screen.getByTestId("inventory-scan-barcode-button")).toBeTruthy();
    expect(screen.getByTestId("inventory-read-expiry-button")).toBeTruthy();
    expect(screen.getByTestId("inventory-product-name-input")).toBeTruthy();
    expect(screen.getByTestId("inventory-barcode-input")).toBeTruthy();
    expect(screen.getByTestId("inventory-expiry-date-input")).toBeTruthy();
    expect(screen.getByTestId("inventory-quantity-input")).toBeTruthy();
    expect(screen.getByTestId("inventory-add-item-button")).toBeTruthy();

    fireEvent.press(screen.getByTestId("inventory-scan-barcode-button"));

    expect(screen.getByTestId("scanner-modal")).toBeTruthy();
  });

  it("exposes a deterministic unavailable state for restaurant sellers", () => {
    mockSellerProfile = { businessType: "restaurant" };

    const screen = render(<InventoryScreen />);

    expect(screen.getByTestId("inventory-unavailable-screen")).toBeTruthy();
    expect(screen.getByTestId("inventory-unavailable-message")).toHaveTextContent(
      "Inventory intake is only available for shops."
    );
  });

  it("shows loading, empty, and retryable inventory load states", () => {
    mockInventoryError = "Network unavailable";
    mockInventoryIsLoading = true;

    const screen = render(<InventoryScreen />);

    expect(screen.getByTestId("inventory-loading-state")).toBeTruthy();
    expect(screen.getByTestId("inventory-error-state")).toBeTruthy();

    fireEvent.press(screen.getByTestId("inventory-retry-button"));

    expect(mockLoadItems).toHaveBeenCalledTimes(1);
  });
});

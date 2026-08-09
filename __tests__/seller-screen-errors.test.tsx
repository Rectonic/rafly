import React, { type ReactNode } from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Alert, Pressable, ScrollView, Text } from "react-native";

import CreateOfferScreen from "@/app/(seller-tabs)/create";
import InventoryScreen from "@/app/(seller-tabs)/inventory";
import SellerProfileScreen from "@/app/(seller-tabs)/profile";

type MockSellerProfile = {
  address: string;
  businessName: string;
  businessType: "restaurant" | "shop";
  category: string;
  latitude: number;
  longitude: number;
};

const mockPublishOffer = jest.fn();
const mockRefreshOffers = jest.fn();
const mockAddItem = jest.fn();
const mockUpdateProfile = jest.fn();
const mockSignOut = jest.fn();
let mockSellerProfile: MockSellerProfile;
let mockMealPackageDraft = {
  category: "Meals",
  contentsText: "Soup",
  image: "",
  isSurpriseBag: false,
  newPrice: "5",
  oldPrice: "10",
  pickupEnd: "21:00",
  pickupStart: "",
  quantity: "2",
  title: "Dinner pack",
};
const mockCreateElement = React.createElement;
const mockPressable = Pressable;
const mockScrollView = ScrollView;
const mockText = Text;
let mockSellerOffersError: string | null = null;
let mockSellerOffersLoading = false;

jest.mock("expo-router", () => ({
  useRouter: () => ({
    replace: jest.fn(),
  }),
}));

jest.mock("@/components/ScreenScrollView", () => {
  return {
    ScreenScrollView: ({ children }: { children: ReactNode }) =>
      mockCreateElement(mockScrollView, null, children),
  };
});

jest.mock("@/components/seller/MealPackageForm", () => {
  return {
    MealPackageForm: ({ onSubmit }: { onSubmit: (draft: unknown) => void }) =>
      mockCreateElement(
        mockPressable,
        {
          onPress: () => onSubmit(mockMealPackageDraft),
        },
        mockCreateElement(mockText, null, "Submit package")
      ),
  };
});

jest.mock("@/components/seller/InventoryCard", () => ({
  InventoryCard: () => null,
}));

jest.mock("@/components/seller/Scanner", () => ({
  Scanner: () => null,
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

jest.mock("@/lib/seller/offers-store", () => ({
  useSellerOffers: () => ({
    error: mockSellerOffersError,
    isLoading: mockSellerOffersLoading,
    offers: [],
    publishOffer: mockPublishOffer,
    refreshOffers: mockRefreshOffers,
  }),
}));

jest.mock("@/lib/seller/inventory-store", () => ({
  useInventory: () => ({
    addItem: mockAddItem,
    deleteItem: jest.fn(),
    items: [],
  }),
}));

jest.mock("@/lib/seller/profile-store", () => ({
  useSellerProfile: () => ({
    updateProfile: mockUpdateProfile,
  }),
}));

describe("seller screen mutation errors", () => {
  const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(jest.fn());

  beforeEach(() => {
    alertSpy.mockClear();
    mockPublishOffer.mockReset();
    mockRefreshOffers.mockReset();
    mockAddItem.mockReset();
    mockUpdateProfile.mockReset();
    mockSignOut.mockReset();
    mockSellerOffersError = null;
    mockSellerOffersLoading = false;
    mockMealPackageDraft = {
      category: "Meals",
      contentsText: "Soup",
      image: "",
      isSurpriseBag: false,
      newPrice: "5",
      oldPrice: "10",
      pickupEnd: "21:00",
      pickupStart: "",
      quantity: "2",
      title: "Dinner pack",
    };
    mockSellerProfile = {
      address: "Tashkent",
      businessName: "Seller One",
      businessType: "restaurant",
      category: "Meals",
      latitude: 41.31,
      longitude: 69.27,
    };
  });

  it("alerts publish failures without showing success", async () => {
    mockPublishOffer.mockRejectedValue(new Error("RLS rejected"));

    const screen = render(<CreateOfferScreen />);

    fireEvent.press(screen.getByText("Submit package"));

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith("Publish failed", "RLS rejected")
    );
    expect(alertSpy).not.toHaveBeenCalledWith(
      "Published",
      "The offer is now visible in the buyer feed."
    );
  });

  it("shows retryable published-offer load states on the create screen", () => {
    mockSellerOffersError = "Network unavailable";
    mockSellerOffersLoading = true;

    const screen = render(<CreateOfferScreen />);

    expect(screen.getByTestId("create-offer-loading-state")).toBeTruthy();
    expect(screen.getByTestId("create-offer-error-state")).toBeTruthy();

    fireEvent.press(screen.getByTestId("create-offer-retry-button"));

    expect(mockRefreshOffers).toHaveBeenCalledTimes(1);
  });

  it("shows readable package validation copy instead of raw validation codes", async () => {
    mockMealPackageDraft = {
      ...mockMealPackageDraft,
      contentsText: "",
      title: "",
    };

    const screen = render(<CreateOfferScreen />);

    fireEvent.press(screen.getByText("Submit package"));

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        "Invalid package",
        "Complete the package title, contents, prices, quantity, and pickup time before publishing."
      )
    );
    expect(alertSpy).not.toHaveBeenCalledWith("Invalid package", "missing-fields");
    expect(mockPublishOffer).not.toHaveBeenCalled();
  });

  it("keeps inventory form values and alerts when add fails", async () => {
    mockSellerProfile = {
      ...mockSellerProfile,
      businessType: "shop",
    };
    mockAddItem.mockRejectedValue(new Error("Network unavailable"));

    const screen = render(<InventoryScreen />);

    fireEvent.changeText(screen.getByPlaceholderText("Product name"), "Milk");
    fireEvent.changeText(screen.getByPlaceholderText("Barcode"), "123");
    fireEvent.changeText(screen.getByPlaceholderText("YYYY-MM-DD"), "2026-06-01");
    fireEvent.press(screen.getByText("Add item"));

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        "Inventory save failed",
        "Network unavailable"
      )
    );
    expect(screen.getByDisplayValue("Milk")).toBeTruthy();
    expect(alertSpy).not.toHaveBeenCalledWith("Saved", "Inventory item added.");
  });

  it("shows readable inventory validation copy before add attempts", async () => {
    mockSellerProfile = {
      ...mockSellerProfile,
      businessType: "shop",
    };

    const screen = render(<InventoryScreen />);

    fireEvent.changeText(screen.getByPlaceholderText("Quantity"), "0");
    fireEvent.press(screen.getByText("Add item"));

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        "Invalid inventory item",
        "Enter a product name, expiry date, and quantity above zero before adding stock."
      )
    );
    expect(mockAddItem).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalledWith(
      "Inventory save failed",
      "invalid-inventory"
    );
  });

  it("alerts profile save failures without showing success", async () => {
    mockUpdateProfile.mockRejectedValue(new Error("Profile RLS rejected"));

    const screen = render(<SellerProfileScreen />);

    fireEvent.press(screen.getByText("Save profile"));

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        "Profile save failed",
        "Profile RLS rejected"
      )
    );
    expect(alertSpy).not.toHaveBeenCalledWith("Saved", "Profile updated.");
  });

  it("shows readable profile validation copy before save attempts", async () => {
    const screen = render(<SellerProfileScreen />);

    fireEvent.changeText(screen.getByTestId("seller-profile-business-name-input"), "");
    fireEvent.changeText(screen.getByTestId("seller-profile-latitude-input"), "not-a-number");
    fireEvent.press(screen.getByText("Save profile"));

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        "Profile save failed",
        "Complete every business field before saving settings."
      )
    );
    expect(mockUpdateProfile).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalledWith(
      "Saved",
      "Seller profile synced. Future offers and stock records will use the saved backend business data."
    );
  });
});

import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useInventory } from "@/lib/seller/inventory-store";
import { useSellerOffers } from "@/lib/seller/offers-store";
import { useSellerProfile } from "@/lib/seller/profile-store";

const mockRefreshPublishedSellerOffers = jest.fn();
let mockAuthValue: unknown;
let mockIsSupabaseConfigured = false;
let mockSupabase: unknown = null;

jest.mock("@/lib/marketplace-store", () => ({
  useRefreshPublishedSellerOffers: () => mockRefreshPublishedSellerOffers,
}));

jest.mock("@/lib/seller/auth-store", () => ({
  useAuth: () => mockAuthValue,
}));

jest.mock("@/lib/supabase", () => ({
  get supabase() {
    return mockSupabase;
  },
  isSupabaseConfigured: () => mockIsSupabaseConfigured,
}));

describe("seller workflow async errors", () => {
  beforeEach(() => {
    mockRefreshPublishedSellerOffers.mockReset();
    mockIsSupabaseConfigured = false;
    mockSupabase = null;
    mockAuthValue = {
      refreshSellerProfile: jest.fn(),
      sellerProfile: null,
      session: null,
    };
  });

  it("rejects publish attempts when seller auth or profile is unavailable", async () => {
    const { result } = renderHook(() => useSellerOffers());

    await act(async () => {
      await expect(
        result.current.publishOffer({
          category: "Meals",
          contents: ["Soup"],
          image: null,
          newPrice: 5,
          oldPrice: 10,
          pickupEnd: "21:00",
          pickupStart: null,
          quantityAvailable: 2,
          title: "Dinner pack",
        })
      ).rejects.toThrow("Seller auth and profile are required.");
    });
  });

  it("rejects inventory writes when Supabase is unavailable", async () => {
    const { result } = renderHook(() => useInventory());

    await act(async () => {
      await expect(
        result.current.addItem({
          barcode: "123",
          expiryDate: "2026-06-01",
          productName: "Milk",
          quantity: 1,
          source: "manual",
        })
      ).rejects.toThrow("Supabase is not configured.");
    });
  });

  it("converts inventory load exceptions into retryable store errors", async () => {
    mockIsSupabaseConfigured = true;
    mockAuthValue = {
      refreshSellerProfile: jest.fn(),
      sellerProfile: null,
      session: {
        user: {
          id: "seller-1",
        },
      },
    };
    mockSupabase = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn().mockRejectedValue(new Error("Inventory offline")),
          })),
        })),
      })),
    };

    const { result } = renderHook(() => useInventory());

    await waitFor(() =>
      expect(result.current.error).toBe("Inventory offline")
    );
    expect(result.current.isLoading).toBe(false);
  });

  it("converts seller offer load exceptions into retryable store errors", async () => {
    mockIsSupabaseConfigured = true;
    mockAuthValue = {
      refreshSellerProfile: jest.fn(),
      sellerProfile: {
        address: "Tashkent",
        businessName: "Seller One",
        businessType: "restaurant",
        category: "Meals",
        latitude: 41.31,
        longitude: 69.27,
        rating: 4.8,
        reviews: 10,
      },
      session: {
        user: {
          id: "seller-1",
        },
      },
    };
    mockSupabase = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn().mockRejectedValue(new Error("Offers offline")),
          })),
        })),
      })),
    };

    const { result } = renderHook(() => useSellerOffers());

    await waitFor(() =>
      expect(result.current.error).toBe("Offers offline")
    );
    expect(result.current.isLoading).toBe(false);
  });

  it("rejects profile updates when Supabase is unavailable", async () => {
    const { result } = renderHook(() => useSellerProfile());

    await act(async () => {
      await expect(
        result.current.updateProfile({
          address: "Tashkent",
          businessName: "Test Shop",
          businessType: "shop",
          category: "Groceries",
          latitude: 41.31,
          longitude: 69.27,
        })
      ).rejects.toThrow("Supabase is not configured.");
    });
  });
});

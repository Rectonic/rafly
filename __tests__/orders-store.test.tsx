import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useOrders } from "@/lib/seller/orders-store";

let mockAuthValue: unknown;
let mockIsSupabaseConfigured = false;
let mockSupabase: unknown = null;

jest.mock("@/lib/seller/auth-store", () => ({
  useAuth: () => mockAuthValue,
}));

jest.mock("@/lib/supabase", () => ({
  get supabase() {
    return mockSupabase;
  },
  isSupabaseConfigured: () => mockIsSupabaseConfigured,
}));

describe("useOrders", () => {
  beforeEach(() => {
    mockIsSupabaseConfigured = false;
    mockSupabase = null;
    mockAuthValue = {
      session: null,
    };
  });

  it("rejects pickup verification when Supabase is unavailable", async () => {
    const { result } = renderHook(() => useOrders());

    await act(async () => {
      await expect(result.current.verifyPickup("order-1")).rejects.toThrow(
        "Supabase is not configured."
      );
    });
  });

  it("converts thrown order load failures into a retryable error state", async () => {
    mockIsSupabaseConfigured = true;
    mockAuthValue = {
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
            order: jest.fn().mockRejectedValue(new Error("Network unavailable")),
          })),
        })),
      })),
    };

    const { result } = renderHook(() => useOrders());

    await waitFor(() =>
      expect(result.current.error).toBe("Network unavailable")
    );
    expect(result.current.isLoading).toBe(false);
    expect(result.current.orders).toEqual([]);
  });

  it("records the time of the latest successful order refresh", async () => {
    mockIsSupabaseConfigured = true;
    mockAuthValue = {
      session: {
        user: {
          id: "seller-1",
        },
      },
    };
    mockSupabase = {
      from: jest.fn((table: string) => {
        if (table === "pickup_orders") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn().mockResolvedValue({
                  data: [
                    {
                      created_at: "2026-05-28T12:00:00.000Z",
                      customer_name: "Mobile customer",
                      id: "order-1",
                      offer_id: "offer-1",
                      pickup_window: "Pickup by 20:30",
                      reservation_code: "LB-001-123456",
                      seller_id: "seller-1",
                      status: "pending",
                      total: 8,
                    },
                  ],
                  error: null,
                }),
              })),
            })),
          };
        }

        return {
          select: jest.fn(() => ({
            eq: jest.fn().mockResolvedValue({
              data: [{ id: "offer-1", title: "Dinner pack" }],
              error: null,
            }),
          })),
        };
      }),
    };

    const { result } = renderHook(() => useOrders());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.lastLoadedAt).toEqual(expect.any(String));
    expect(result.current.orders[0]?.offerTitle).toBe("Dinner pack");
  });

  it("only verifies pending pickup orders", async () => {
    mockIsSupabaseConfigured = true;
    mockAuthValue = {
      session: {
        user: {
          id: "seller-1",
        },
      },
    };

    const maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
    const selectUpdated = jest.fn(() => ({ maybeSingle }));
    const eqStatus = jest.fn(() => ({ select: selectUpdated }));
    const eqSeller = jest.fn(() => ({ eq: eqStatus }));
    const eqOrder = jest.fn(() => ({ eq: eqSeller }));
    const update = jest.fn(() => ({ eq: eqOrder }));

    mockSupabase = {
      from: jest.fn((table: string) => {
        if (table === "pickup_orders") {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn().mockResolvedValue({ data: [], error: null }),
              })),
            })),
            update,
          };
        }

        return {
          select: jest.fn(() => ({
            eq: jest.fn().mockResolvedValue({ data: [], error: null }),
          })),
        };
      }),
    };

    const { result } = renderHook(() => useOrders());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await expect(result.current.verifyPickup("order-1")).rejects.toThrow(
        "This pickup order is no longer pending."
      );
    });

    expect(eqStatus).toHaveBeenCalledWith("status", "pending");
    expect(selectUpdated).toHaveBeenCalledWith("id");
  });
});

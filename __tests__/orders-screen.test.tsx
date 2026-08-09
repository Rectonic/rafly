import React, { type ReactNode } from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { ScrollView } from "react-native";

import OrdersScreen from "@/app/(seller-tabs)/orders";

const mockRefreshOrders = jest.fn();
let mockOrdersState: unknown;
const mockCreateElement = React.createElement;
const mockScrollView = ScrollView;

jest.mock("@/components/ScreenScrollView", () => {
  return {
    ScreenScrollView: ({ children }: { children: ReactNode }) =>
      mockCreateElement(mockScrollView, null, children),
  };
});

jest.mock("@/components/seller/Scanner", () => ({
  Scanner: () => null,
}));

jest.mock("@/lib/locale-store", () => ({
  useLocale: () => "en",
}));

jest.mock("@/lib/seller/orders-store", () => ({
  useOrders: () => mockOrdersState,
}));

describe("OrdersScreen", () => {
  beforeEach(() => {
    mockRefreshOrders.mockReset();
    mockOrdersState = {
      error: null,
      isLoading: false,
      lastLoadedAt: null,
      orders: [],
      refreshOrders: mockRefreshOrders,
      verifyingOrderId: null,
      verifyPickup: jest.fn(),
    };
  });

  it("shows an empty state and a manual refresh action", () => {
    const screen = render(<OrdersScreen />);

    expect(screen.getByText("No pending pickup orders yet.")).toBeTruthy();

    fireEvent.press(screen.getByText("Refresh orders"));

    expect(mockRefreshOrders).toHaveBeenCalledTimes(1);
  });

  it("shows order loading and error states", () => {
    mockOrdersState = {
      error: "Network unavailable",
      isLoading: true,
      lastLoadedAt: null,
      orders: [],
      refreshOrders: mockRefreshOrders,
      verifyingOrderId: null,
      verifyPickup: jest.fn(),
    };

    const screen = render(<OrdersScreen />);

    expect(screen.getByTestId("orders-loading-state")).toBeTruthy();
    expect(screen.getByTestId("orders-error-state")).toBeTruthy();
    expect(screen.queryByText("No pending pickup orders yet.")).toBeNull();
  });

  it("disables manual verification while a pickup verification is in flight", () => {
    mockOrdersState = {
      error: null,
      isLoading: false,
      lastLoadedAt: null,
      orders: [
        {
          createdAt: "2026-05-28T12:00:00.000Z",
          customerName: "Mobile customer",
          id: "order-1",
          offerId: "offer-1",
          offerTitle: "Dinner pack",
          pickupWindow: "Pickup by 20:30",
          reservationCode: "LB-001-123456",
          sellerId: "seller-1",
          status: "pending",
          total: 8,
        },
      ],
      refreshOrders: mockRefreshOrders,
      verifyingOrderId: "order-1",
      verifyPickup: jest.fn(),
    };

    const screen = render(<OrdersScreen />);

    expect(screen.getByTestId("orders-verify-code-button")).toBeDisabled();
    expect(screen.getByTestId("order-verify-button-order-1")).toBeDisabled();
  });

  it("shows visual lifecycle states and cancelled orders separately", () => {
    mockOrdersState = {
      error: null,
      isLoading: false,
      lastLoadedAt: null,
      orders: [
        {
          createdAt: "2026-05-28T12:00:00.000Z",
          customerName: "Pending customer",
          id: "order-1",
          offerId: "offer-1",
          offerTitle: "Dinner pack",
          pickupWindow: "Pickup by 20:30",
          reservationCode: "LB-001-123456",
          sellerId: "seller-1",
          status: "pending",
          total: 8,
        },
        {
          createdAt: "2026-05-28T11:00:00.000Z",
          customerName: "Cancelled customer",
          id: "order-2",
          offerId: "offer-2",
          offerTitle: "Lunch pack",
          pickupWindow: "Pickup by 14:30",
          reservationCode: "LB-002-123456",
          sellerId: "seller-1",
          status: "cancelled",
          total: 6,
        },
      ],
      refreshOrders: mockRefreshOrders,
      verifyingOrderId: null,
      verifyPickup: jest.fn(),
    };

    const screen = render(<OrdersScreen />);

    expect(screen.getByTestId("order-status-order-1")).toHaveTextContent(
      "Awaiting pickup"
    );
    expect(screen.getByText("Reserved")).toBeTruthy();
    expect(screen.getByText("Pickup window")).toBeTruthy();
    expect(screen.getAllByText("Collected").length).toBeGreaterThan(0);

    fireEvent.press(screen.getByTestId("orders-segment-cancelled"));

    expect(screen.getByText("Lunch pack")).toBeTruthy();
    expect(screen.getByTestId("order-status-order-2")).toHaveTextContent(
      "Cancelled"
    );
    expect(screen.queryByTestId("order-verify-button-order-2")).toBeNull();
  });

  it("shows when seller orders were last refreshed", () => {
    mockOrdersState = {
      error: null,
      isLoading: false,
      lastLoadedAt: "2026-05-28T12:34:00.000Z",
      orders: [],
      refreshOrders: mockRefreshOrders,
      verifyingOrderId: null,
      verifyPickup: jest.fn(),
    };

    const screen = render(<OrdersScreen />);

    expect(screen.getByTestId("orders-last-updated")).toHaveTextContent(
      /Last refreshed/
    );
  });
});

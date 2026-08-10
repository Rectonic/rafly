import { fireEvent, render } from "@testing-library/react-native";
import React, { type ReactNode } from "react";
import { ScrollView } from "react-native";

import ReservationsScreen from "@/app/(tabs)/reservations";
import type { BuyerReservation } from "@/types/reservation";

const mockCreateElement = React.createElement;
const mockScrollView = ScrollView;
const mockRefreshReservations = jest.fn();
const mockRevealPickupCode = jest.fn();
const mockCancelReservation = jest.fn();
const mockCompleteReservation = jest.fn();

let mockReservationsState: {
  cancelReservation: typeof mockCancelReservation;
  completeReservation: typeof mockCompleteReservation;
  error: string | null;
  isLoading: boolean;
  refreshReservations: typeof mockRefreshReservations;
  reservations: BuyerReservation[];
  revealedCodes: Record<string, string>;
  revealPickupCode: typeof mockRevealPickupCode;
};

jest.mock("@/components/ScreenScrollView", () => ({
  ScreenScrollView: ({
    children,
    ...props
  }: {
    children: ReactNode;
  }) => mockCreateElement(mockScrollView, props, children),
}));

jest.mock("@/lib/locale-store", () => ({
  useLocale: () => "en",
}));

jest.mock("@/lib/reservations-store", () => ({
  useReservationHistory: () => mockReservationsState,
}));

// app/(tabs)/reservations.tsx now imports components/buyer/ReservationsListV2
// for the pilot mode branch. Neither ApiProvider nor FeatureFlagsProvider is
// mounted in this suite, so isPilot stays false and that component never
// renders, but its module graph (expo-router, AsyncStorage, SecureStore)
// still has to resolve at import time.
jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
}));

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
}));

const activeReservation: BuyerReservation = {
  codeHint: "3456",
  createdAt: "2026-05-28T12:00:00.000Z",
  expiresAt: "2026-05-28T18:45:00.000Z",
  id: "reservation-1",
  offerId: "9",
  offerTitle: "Morning Pastry Pack",
  pickupWindow: "Pickup by 18:45",
  reminderScheduledFor: "2026-05-28T13:15:00.000Z",
  reminderStatus: "scheduled",
  restaurant: "Butter House",
  status: "active",
  syncStatus: "local",
  total: 5.6,
};

describe("ReservationsScreen", () => {
  beforeEach(() => {
    mockRefreshReservations.mockReset();
    mockRevealPickupCode.mockReset();
    mockCancelReservation.mockReset();
    mockCompleteReservation.mockReset();
    mockReservationsState = {
      cancelReservation: mockCancelReservation,
      completeReservation: mockCompleteReservation,
      error: null,
      isLoading: false,
      refreshReservations: mockRefreshReservations,
      reservations: [],
      revealedCodes: {},
      revealPickupCode: mockRevealPickupCode,
    };
  });

  it("shows loading, retry, and empty states", () => {
    mockReservationsState = {
      ...mockReservationsState,
      error: "Storage unavailable",
      isLoading: true,
    };

    const screen = render(<ReservationsScreen />);

    expect(screen.getByTestId("reservations-screen")).toBeTruthy();
    expect(screen.getByText("Loading reservations...")).toBeTruthy();
    expect(screen.getByText("Storage unavailable")).toBeTruthy();

    fireEvent.press(screen.getByText("Retry"));

    expect(mockRefreshReservations).toHaveBeenCalledTimes(1);

    mockReservationsState = {
      ...mockReservationsState,
      error: null,
      isLoading: false,
    };
    screen.rerender(<ReservationsScreen />);

    expect(screen.getByTestId("reservations-empty-state")).toHaveTextContent(
      "No active reservations yet."
    );
  });

  it("reveals recoverable pickup codes only after the user requests them", () => {
    mockReservationsState = {
      ...mockReservationsState,
      reservations: [activeReservation],
    };

    const screen = render(<ReservationsScreen />);

    expect(screen.getByText("Morning Pastry Pack")).toBeTruthy();
    expect(screen.getByTestId("reservation-reminder-status-reservation-1"))
      .toHaveTextContent("Reminder scheduled for 18:15");
    expect(screen.getByText("Code ending in 3456")).toBeTruthy();
    expect(screen.queryByText("LB-009-123456")).toBeNull();

    fireEvent.press(screen.getByText("Show pickup code"));

    expect(mockRevealPickupCode).toHaveBeenCalledWith("reservation-1");

    mockReservationsState = {
      ...mockReservationsState,
      revealedCodes: {
        "reservation-1": "LB-009-123456",
      },
    };
    screen.rerender(<ReservationsScreen />);

    expect(screen.getByTestId("reservation-code-reservation-1")).toHaveTextContent(
      "LB-009-123456"
    );
  });

  it("supports active reservation actions and status filters", () => {
    mockReservationsState = {
      ...mockReservationsState,
      reservations: [
        activeReservation,
        {
          ...activeReservation,
          id: "reservation-2",
          offerTitle: "Collected Bag",
          status: "completed",
        },
      ],
    };

    const screen = render(<ReservationsScreen />);

    fireEvent.press(screen.getByText("Mark picked up"));
    expect(mockCompleteReservation).toHaveBeenCalledWith("reservation-1");

    fireEvent.press(screen.getByText("Cancel reservation"));
    expect(mockCancelReservation).toHaveBeenCalledWith("reservation-1");

    fireEvent.press(screen.getByText("Completed"));

    expect(screen.getByText("Collected Bag")).toBeTruthy();
    expect(screen.queryByText("Morning Pastry Pack")).toBeNull();
  });
});

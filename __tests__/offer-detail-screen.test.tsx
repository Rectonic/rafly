import React, { type ReactNode } from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Alert, ScrollView } from "react-native";

import OfferDetailScreen from "@/app/offer/[id]";
import type { BuyerReservation } from "@/types/reservation";

const mockCreateElement = React.createElement;
const mockScrollView = ScrollView;
let mockParams = { id: "9" };
let mockFavorites: string[] = [];
let mockLocale: "en" | "ru" = "en";
const mockToggleFavorite = jest.fn();
const mockCreatePickupReservation = jest.fn();
const mockAddReservation = jest.fn();
const mockRetryReservationSync = jest.fn();
const mockBack = jest.fn();
const mockPush = jest.fn();
let mockExistingReservation: BuyerReservation | null = null;

jest.mock("@expo/vector-icons/Ionicons", () => ({
  __esModule: true,
  default: ({ name }: { name: string }) => {
    const { Text } = jest.requireActual("react-native");
    return mockCreateElement(Text, { testID: `icon-${name}` }, name);
  },
}));

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({
    back: mockBack,
    push: mockPush,
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

jest.mock("@/lib/favorites-store", () => ({
  useFavorites: () => mockFavorites,
  useToggleFavorite: () => mockToggleFavorite,
}));

jest.mock("@/lib/marketplace-store", () => ({
  usePublishedSellerOffers: () => [],
}));

jest.mock("@/lib/locale-store", () => ({
  useLocale: () => mockLocale,
}));

jest.mock("@/lib/reservations", () => ({
  createPickupReservation: (...args: unknown[]) =>
    mockCreatePickupReservation(...args),
}));

jest.mock("@/lib/reservations-store", () => ({
  useAddReservation: () => mockAddReservation,
  useReservationForOffer: () => mockExistingReservation,
  useRetryReservationSync: () => mockRetryReservationSync,
}));

describe("OfferDetailScreen", () => {
  const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(jest.fn());

  beforeEach(() => {
    alertSpy.mockClear();
    mockCreatePickupReservation.mockReset();
    mockAddReservation.mockReset();
    mockRetryReservationSync.mockReset();
    mockBack.mockReset();
    mockPush.mockReset();
    mockToggleFavorite.mockReset();
    mockExistingReservation = null;
    mockFavorites = [];
    mockLocale = "en";
    mockParams = { id: "9" };
  });

  it("renders offer details and toggles favorites", () => {
    const screen = render(<OfferDetailScreen />);

    expect(screen.getByTestId("offer-detail-screen")).toBeTruthy();
    expect(screen.getByTestId("offer-detail-close-button")).toBeTruthy();
    expect(screen.getByTestId("offer-detail-favorite-button")).toBeTruthy();
    expect(screen.getByTestId("offer-detail-reserve-button")).toBeTruthy();
    expect(screen.getByText("Morning Pastry Pack")).toBeTruthy();
    expect(screen.getByText("Butter House")).toBeTruthy();

    fireEvent.press(screen.getByText("Add to favorites"));

    expect(mockToggleFavorite).toHaveBeenCalledWith("9");
  });

  it("renders pickup, dietary, allergen, and policy sections", () => {
    const screen = render(<OfferDetailScreen />);

    expect(screen.getByText("What you might get")).toBeTruthy();
    expect(screen.getByText("Croissants, pain au chocolat, fruit danishes")).toBeTruthy();
    expect(screen.getByText("Pickup instructions")).toBeTruthy();
    expect(
      screen.getByText("Use the side bakery entrance and show your pickup code at the counter.")
    ).toBeTruthy();
    expect(screen.getByText("Dietary")).toBeTruthy();
    expect(screen.getByText("Vegetarian")).toBeTruthy();
    expect(screen.getByText("Allergens")).toBeTruthy();
    expect(screen.getByText("Contains gluten")).toBeTruthy();
    expect(screen.getByText("Contains dairy")).toBeTruthy();
    expect(screen.getByText("Cancellation & refund policy")).toBeTruthy();
    expect(
      screen.getByText("Cancel up to 30 minutes before pickup for an automatic refund.")
    ).toBeTruthy();
  });

  it("closes the offer detail page from the header", () => {
    const screen = render(<OfferDetailScreen />);

    fireEvent.press(screen.getByTestId("offer-detail-close-button"));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it("shows pickup code after a successful reservation", async () => {
    mockCreatePickupReservation.mockResolvedValue({
      reservationCode: "LB-1234",
      synced: false,
    });

    const screen = render(<OfferDetailScreen />);

    fireEvent.press(screen.getByText("Reserve Now"));

    await waitFor(() => expect(screen.getByText("LB-1234")).toBeTruthy());
    expect(screen.getByTestId("reservation-confirmation-panel")).toBeTruthy();
    expect(screen.getByTestId("reservation-pickup-code")).toHaveTextContent(
      "LB-1234"
    );
    expect(mockAddReservation).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "9",
        title: "Morning Pastry Pack",
      }),
      {
        reservationCode: "LB-1234",
        synced: false,
      }
    );
    expect(screen.getByText("Reserved!")).toBeTruthy();
    expect(
      screen.getByText("This demo offer is reserved on this device only.")
    ).toBeTruthy();
  });

  it("renders offer detail reservation copy in Russian for the Russian locale", async () => {
    mockLocale = "ru";
    mockCreatePickupReservation.mockResolvedValue({
      reservationCode: "LB-1234",
      synced: false,
    });

    const screen = render(<OfferDetailScreen />);

    expect(screen.getByText("Утренний набор выпечки")).toBeTruthy();
    expect(screen.getByText("Булочная Butter House")).toBeTruthy();
    expect(screen.getByText("5,60 $ вместо 16,00 $")).toBeTruthy();
    expect(screen.getByText("Забрать до 18:45")).toBeTruthy();
    expect(screen.getByText("Добавить в избранное")).toBeTruthy();
    expect(screen.getByText("Что вы можете получить")).toBeTruthy();
    expect(screen.getByText("Круассаны, пан-о-шоколад, фруктовые слойки")).toBeTruthy();
    expect(screen.getByText("Инструкции по самовывозу")).toBeTruthy();
    expect(
      screen.getByText(
        "Войдите через боковой вход пекарни и покажите код самовывоза у стойки."
      )
    ).toBeTruthy();
    expect(screen.getByText("Диетические отметки")).toBeTruthy();
    expect(screen.getByText("Вегетарианское")).toBeTruthy();
    expect(screen.getByText("Аллергены")).toBeTruthy();
    expect(screen.getByText("Содержит глютен")).toBeTruthy();
    expect(screen.getByText("Содержит молочные продукты")).toBeTruthy();
    expect(screen.getByText("Правила отмены и возврата")).toBeTruthy();
    expect(
      screen.getByText(
        "Отмените за 30 минут до самовывоза, чтобы получить автоматический возврат."
      )
    ).toBeTruthy();

    fireEvent.press(screen.getByText("Забронировать"));

    await waitFor(() => expect(screen.getByText("LB-1234")).toBeTruthy());
    expect(screen.getByText("Забронировано!")).toBeTruthy();
    expect(screen.getByText("Код самовывоза")).toBeTruthy();
    expect(
      screen.getByText("Демо-предложение забронировано только на этом устройстве.")
    ).toBeTruthy();
    expect(screen.queryByText("Reserve now")).toBeNull();
    expect(screen.queryByText("Pickup code")).toBeNull();
    expect(screen.queryByText("Add favorite")).toBeNull();
  });

  it("alerts reservation failures without marking the offer reserved", async () => {
    mockCreatePickupReservation.mockRejectedValue(new Error("Reservation denied"));

    const screen = render(<OfferDetailScreen />);

    fireEvent.press(screen.getByText("Reserve Now"));

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        "Reservation failed",
        "Reservation denied"
      )
    );
    expect(mockAddReservation).not.toHaveBeenCalled();
    expect(screen.getByText("Reserve Now")).toBeTruthy();
  });

  it("does not create duplicate reservations from rapid taps or existing active history", async () => {
    let resolveReservation: (value: {
      reservationCode: string;
      synced: boolean;
    }) => void = () => {};
    mockCreatePickupReservation.mockReturnValue(
      new Promise((resolve) => {
        resolveReservation = resolve;
      })
    );

    const screen = render(<OfferDetailScreen />);
    const reserveButton = screen.getByTestId("offer-detail-reserve-button");

    fireEvent.press(reserveButton);
    fireEvent.press(reserveButton);

    expect(mockCreatePickupReservation).toHaveBeenCalledTimes(1);

    resolveReservation?.({
      reservationCode: "LB-1234",
      synced: false,
    });

    await waitFor(() => expect(screen.getByText("LB-1234")).toBeTruthy());

    mockCreatePickupReservation.mockClear();
    mockExistingReservation = {
      codeHint: "1234",
      createdAt: "2026-05-28T12:00:00.000Z",
      expiresAt: "2026-05-28T18:45:00.000Z",
      id: "reservation-1",
      offerId: "9",
      offerTitle: "Morning Pastry Pack",
      pickupWindow: "Pickup by 18:45",
      restaurant: "Butter House",
      status: "active",
      syncStatus: "local",
      total: 5.6,
    };
    screen.rerender(<OfferDetailScreen />);

    fireEvent.press(screen.getByText("Reserved!"));

    expect(mockCreatePickupReservation).not.toHaveBeenCalled();
  });

  it("links existing reservations to reservation history for secure code recovery", () => {
    mockExistingReservation = {
      codeHint: "7363",
      createdAt: "2026-05-28T12:00:00.000Z",
      expiresAt: "2026-05-28T23:45:00.000Z",
      id: "reservation-1",
      offerId: "9",
      offerTitle: "Morning Pastry Pack",
      pickupWindow: "Pickup by 18:45",
      reminderScheduledFor: "2026-05-28T18:15:00.000Z",
      reminderStatus: "scheduled",
      restaurant: "Butter House",
      status: "active",
      syncStatus: "local",
      total: 5.6,
    };

    const screen = render(<OfferDetailScreen />);

    expect(screen.getByText("Code ending in 7363")).toBeTruthy();
    expect(screen.getByText("Reminder scheduled for 23:15")).toBeTruthy();

    fireEvent.press(screen.getByTestId("offer-detail-view-reservation-button"));

    expect(mockPush).toHaveBeenCalledWith("/reservations");
  });

  it("shows a retryable failed seller sync state for recoverable reservations", async () => {
    mockExistingReservation = {
      codeHint: "1234",
      createdAt: "2026-05-28T12:00:00.000Z",
      expiresAt: "2026-05-28T18:45:00.000Z",
      id: "reservation-1",
      offerId: "9",
      offerTitle: "Morning Pastry Pack",
      pickupWindow: "Pickup by 18:45",
      restaurant: "Butter House",
      sellerId: "seller-1",
      status: "active",
      syncError: "Network unavailable",
      syncStatus: "failed",
      total: 5.6,
    };
    mockRetryReservationSync.mockResolvedValue({
      ...mockExistingReservation,
      syncError: undefined,
      syncStatus: "synced",
    });

    const screen = render(<OfferDetailScreen />);

    expect(screen.getByTestId("reservation-sync-failed-panel")).toBeTruthy();
    expect(screen.getByText("Network unavailable")).toBeTruthy();

    fireEvent.press(screen.getByText("Retry"));

    await waitFor(() =>
      expect(mockRetryReservationSync).toHaveBeenCalledWith("reservation-1")
    );
  });

  it("shows a not-found state for unknown offers", () => {
    mockParams = { id: "missing-offer" };

    const screen = render(<OfferDetailScreen />);

    expect(screen.getByText("Offer not found.")).toBeTruthy();
  });
});

import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { Pressable, Text, View } from "react-native";

import {
  ReservationHistoryProvider,
  reservationCodeFallbackKey,
  reservationCodeKey,
  useReservationHistory,
} from "@/lib/reservations-store";
import type { Offer } from "@/types/offer";

const mockAsyncStorage = new Map<string, string>();
const mockSecureStore = new Map<string, string>();
const mockSchedulePickupReminder = jest.fn();
const mockCancelPickupReminder = jest.fn();
const mockSyncPickupOrder = jest.fn();
const mockSyncPickupOrderStatus = jest.fn();
const mockPickupBy = jest.fn((time: string) => `Pickup by ${time}`);
let mockSecureStoreUnavailable = false;

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn((key: string) =>
    Promise.resolve(mockAsyncStorage.get(key) ?? null)
  ),
  setItem: jest.fn((key: string, value: string) => {
    mockAsyncStorage.set(key, value);
    return Promise.resolve();
  }),
}));

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn((key: string) => {
    if (mockSecureStoreUnavailable) {
      return Promise.reject(new Error("A required entitlement isn't present."));
    }

    return Promise.resolve(mockSecureStore.get(key) ?? null);
  }),
  setItemAsync: jest.fn((key: string, value: string) => {
    if (mockSecureStoreUnavailable) {
      return Promise.reject(new Error("A required entitlement isn't present."));
    }

    mockSecureStore.set(key, value);
    return Promise.resolve();
  }),
}));

jest.mock("@/i18n", () => ({
  useT: () => ({
    buyerReservations: {
      notificationBody: (title: string, pickupWindow: string) =>
        `${title} is waiting. ${pickupWindow}`,
      notificationTitle: "Pickup reminder",
    },
    offer: {
      pickupBy: mockPickupBy,
    },
  }),
}));

jest.mock("@/lib/pickup-reminders", () => ({
  cancelPickupReminder: (...args: unknown[]) => mockCancelPickupReminder(...args),
  schedulePickupReminder: (...args: unknown[]) =>
    mockSchedulePickupReminder(...args),
}));

jest.mock("@/lib/reservations", () => ({
  buildPickupOrderInsertFromReservation: ({
    pickupCode,
    reservation,
  }: {
    pickupCode: string;
    reservation: {
      offerId: string;
      pickupWindow: string;
      sellerId?: string;
      total: number;
    };
  }) =>
    reservation.sellerId
      ? {
          customer_name: "Mobile customer",
          offer_id: reservation.offerId,
          pickup_window: reservation.pickupWindow,
          reservation_code: pickupCode,
          seller_id: reservation.sellerId,
          total: reservation.total,
        }
      : null,
  syncPickupOrder: (...args: unknown[]) => mockSyncPickupOrder(...args),
  syncPickupOrderStatus: (...args: unknown[]) =>
    mockSyncPickupOrderStatus(...args),
}));

const offer: Offer = {
  businessType: "shop",
  category: "Baked Goods",
  discount: 65,
  distance: "2.8 km",
  endTime: "23:45",
  id: "9",
  image: "",
  location: {
    address: "Yashnobod District, Tashkent",
    lat: 41.33177,
    lng: 69.30091,
  },
  newPrice: 5.6,
  oldPrice: 16,
  quantityAvailable: 9,
  rating: 4.7,
  restaurant: "Butter House",
  reviews: 129,
  source: "seed",
  title: "Morning Pastry Pack",
};

const sellerOffer: Offer = {
  ...offer,
  id: "seller-offer-1",
  sellerId: "seller-1",
  source: "seller",
  title: "Closing pasta bundle",
};

function ReservationProbe() {
  const {
    addReservation,
    cancelReservation,
    completeReservation,
    isLoading,
    reservations,
    revealedCodes,
    revealPickupCode,
    retryReservationSync,
  } = useReservationHistory();
  const firstReservation = reservations[0];

  return (
    <View>
      <Text testID="reservation-loading">{String(isLoading)}</Text>
      <Text testID="reservation-count">{String(reservations.length)}</Text>
      <Text testID="reservation-title">
        {firstReservation?.offerTitle ?? "none"}
      </Text>
      <Text testID="reservation-id">{firstReservation?.id ?? "none"}</Text>
      <Text testID="reservation-reminder-id">
        {firstReservation?.reminderNotificationId ?? "none"}
      </Text>
      <Text testID="reservation-reminder-status">
        {firstReservation?.reminderStatus ?? "none"}
      </Text>
      <Text testID="reservation-sync-status">
        {firstReservation?.syncStatus ?? "none"}
      </Text>
      <Text testID="reservation-sync-error">
        {firstReservation?.syncError ?? "none"}
      </Text>
      <Text testID="reservation-code">
        {firstReservation ? revealedCodes[firstReservation.id] ?? "hidden" : "none"}
      </Text>
      <Pressable
        onPress={() =>
          void addReservation(offer, {
            reservationCode: "LB-009-123456",
            synced: false,
          })
        }
        testID="add-reservation"
      />
      <Pressable
        onPress={() =>
          void addReservation(sellerOffer, {
            reservationCode: "LB-ER1-123456",
            syncError: "Network unavailable",
            synced: false,
          })
        }
        testID="add-failed-seller-reservation"
      />
      <Pressable
        onPress={() =>
          void addReservation(sellerOffer, {
            reservationCode: "LB-ER1-123456",
            synced: true,
          })
        }
        testID="add-synced-seller-reservation"
      />
      <Pressable
        onPress={() => {
          if (firstReservation) {
            void revealPickupCode(firstReservation.id);
          }
        }}
        testID="reveal-reservation"
      />
      <Pressable
        onPress={() => {
          if (firstReservation) {
            void cancelReservation(firstReservation.id);
          }
        }}
        testID="cancel-reservation"
      />
      <Pressable
        onPress={() => {
          if (firstReservation) {
            void completeReservation(firstReservation.id);
          }
        }}
        testID="complete-reservation"
      />
      <Pressable
        onPress={() => {
          if (firstReservation) {
            void retryReservationSync(firstReservation.id);
          }
        }}
        testID="retry-reservation-sync"
      />
    </View>
  );
}

function renderProbe() {
  return render(
    <ReservationHistoryProvider>
      <ReservationProbe />
    </ReservationHistoryProvider>
  );
}

describe("ReservationHistoryProvider", () => {
  beforeEach(() => {
    mockAsyncStorage.clear();
    mockSecureStore.clear();
    mockSchedulePickupReminder.mockReset();
    mockCancelPickupReminder.mockReset();
    mockSyncPickupOrder.mockReset();
    mockSyncPickupOrderStatus.mockReset();
    mockPickupBy.mockClear();
    mockSchedulePickupReminder.mockResolvedValue({
      reminderNotificationId: "notification-1",
      reminderScheduledFor: "2026-05-28T18:15:00.000Z",
      reminderStatus: "scheduled",
    });
    mockSecureStoreUnavailable = false;
    delete process.env.EXPO_PUBLIC_LASTBITE_ALLOW_INSECURE_CODE_STORE;
  });

  it("persists reservation metadata and recovers secure pickup codes after remount", async () => {
    const screen = renderProbe();

    await waitFor(() =>
      expect(screen.getByTestId("reservation-loading")).toHaveTextContent("false")
    );

    fireEvent.press(screen.getByTestId("add-reservation"));

    await waitFor(() =>
      expect(screen.getByTestId("reservation-count")).toHaveTextContent("1")
    );
    expect(screen.getByTestId("reservation-title")).toHaveTextContent(
      "Morning Pastry Pack"
    );
    expect(JSON.stringify([...mockAsyncStorage.values()])).not.toContain(
      "LB-009-123456"
    );

    screen.unmount();

    const restoredScreen = renderProbe();

    await waitFor(() =>
      expect(restoredScreen.getByTestId("reservation-count")).toHaveTextContent(
        "1"
      )
    );
    expect(restoredScreen.getByTestId("reservation-code")).toHaveTextContent(
      "hidden"
    );

    fireEvent.press(restoredScreen.getByTestId("reveal-reservation"));

    await waitFor(() =>
      expect(restoredScreen.getByTestId("reservation-code")).toHaveTextContent(
        "LB-009-123456"
      )
    );
  });

  it("writes no plaintext pickup code when SecureStore fails and the escape hatch is off", async () => {
    // A pickup code is what a stranger needs to collect somebody else's bag.
    // Without EXPO_PUBLIC_LASTBITE_ALLOW_INSECURE_CODE_STORE the v1 store now
    // fails closed exactly like the v2 helper, the code lives in memory for
    // this session and nothing unencrypted is written or read.
    mockSecureStoreUnavailable = true;
    const screen = renderProbe();

    await waitFor(() =>
      expect(screen.getByTestId("reservation-loading")).toHaveTextContent("false")
    );

    fireEvent.press(screen.getByTestId("add-reservation"));

    await waitFor(() =>
      expect(screen.getByTestId("reservation-count")).toHaveTextContent("1")
    );
    const reservationId = screen.getByTestId("reservation-id").props.children;
    expect(mockSecureStore.size).toBe(0);
    expect(mockAsyncStorage.has(reservationCodeFallbackKey(reservationId))).toBe(
      false
    );

    screen.unmount();

    const restoredScreen = renderProbe();

    await waitFor(() =>
      expect(restoredScreen.getByTestId("reservation-count")).toHaveTextContent("1")
    );

    fireEvent.press(restoredScreen.getByTestId("reveal-reservation"));

    // The reservation survives, only the raw code does not. The probe renders
    // the literal "hidden" placeholder for an unrevealed code, and nothing
    // invents a code to cover the gap.
    await waitFor(() =>
      expect(restoredScreen.getByTestId("reservation-code")).toHaveTextContent(
        "hidden"
      )
    );
  });

  it("falls back to private storage when SecureStore is unavailable and the escape hatch is on", async () => {
    process.env.EXPO_PUBLIC_LASTBITE_ALLOW_INSECURE_CODE_STORE = "1";
    mockSecureStoreUnavailable = true;
    const screen = renderProbe();

    await waitFor(() =>
      expect(screen.getByTestId("reservation-loading")).toHaveTextContent("false")
    );

    fireEvent.press(screen.getByTestId("add-reservation"));

    await waitFor(() =>
      expect(screen.getByTestId("reservation-count")).toHaveTextContent("1")
    );
    const reservationId = screen.getByTestId("reservation-id").props.children;
    expect(mockSecureStore.size).toBe(0);
    expect(
      mockAsyncStorage.get(reservationCodeFallbackKey(reservationId))
    ).toBe("LB-009-123456");

    screen.unmount();

    const restoredScreen = renderProbe();

    await waitFor(() =>
      expect(restoredScreen.getByTestId("reservation-count")).toHaveTextContent(
        "1"
      )
    );

    fireEvent.press(restoredScreen.getByTestId("reveal-reservation"));

    await waitFor(() =>
      expect(restoredScreen.getByTestId("reservation-code")).toHaveTextContent(
        "LB-009-123456"
      )
    );
  });

  it("schedules one pickup reminder for a new reservation and persists its id", async () => {
    const screen = renderProbe();

    await waitFor(() =>
      expect(screen.getByTestId("reservation-loading")).toHaveTextContent("false")
    );

    fireEvent.press(screen.getByTestId("add-reservation"));

    await waitFor(() =>
      expect(screen.getByTestId("reservation-reminder-id")).toHaveTextContent(
        "notification-1"
      )
    );

    expect(mockSchedulePickupReminder).toHaveBeenCalledTimes(1);
    expect(mockSchedulePickupReminder).toHaveBeenCalledWith(
      expect.objectContaining({
        offerTitle: "Morning Pastry Pack",
        pickupWindow: "Pickup by 23:45",
      }),
      {
        body: "Morning Pastry Pack is waiting. Pickup by 23:45",
        title: "Pickup reminder",
      }
    );

    screen.unmount();

    const restoredScreen = renderProbe();

    await waitFor(() =>
      expect(restoredScreen.getByTestId("reservation-reminder-id")).toHaveTextContent(
        "notification-1"
      )
    );
    expect(mockSchedulePickupReminder).toHaveBeenCalledTimes(1);
  });

  it("cancels scheduled pickup reminders when reservations stop being active", async () => {
    const screen = renderProbe();

    await waitFor(() =>
      expect(screen.getByTestId("reservation-loading")).toHaveTextContent("false")
    );
    fireEvent.press(screen.getByTestId("add-reservation"));

    await waitFor(() =>
      expect(screen.getByTestId("reservation-reminder-id")).toHaveTextContent(
        "notification-1"
      )
    );

    fireEvent.press(screen.getByTestId("complete-reservation"));

    await waitFor(() =>
      expect(screen.getByTestId("reservation-reminder-status")).toHaveTextContent(
        "cancelled"
      )
    );
    expect(mockCancelPickupReminder).toHaveBeenCalledWith("notification-1");
  });

  it("marks synced seller pickup orders cancelled when buyers cancel locally", async () => {
    mockSyncPickupOrderStatus.mockResolvedValue({ synced: true });
    const screen = renderProbe();

    await waitFor(() =>
      expect(screen.getByTestId("reservation-loading")).toHaveTextContent("false")
    );
    fireEvent.press(screen.getByTestId("add-synced-seller-reservation"));

    await waitFor(() =>
      expect(screen.getByTestId("reservation-sync-status")).toHaveTextContent(
        "synced"
      )
    );

    fireEvent.press(screen.getByTestId("cancel-reservation"));

    await waitFor(() =>
      expect(mockSyncPickupOrderStatus).toHaveBeenCalledWith({
        pickupCode: "LB-ER1-123456",
        reservation: expect.objectContaining({
          offerId: "seller-offer-1",
          sellerId: "seller-1",
        }),
        status: "cancelled",
      })
    );
    expect(screen.getByTestId("reservation-sync-status")).toHaveTextContent(
      "synced"
    );
  });

  it("persists failed seller sync details and can retry with the secure pickup code", async () => {
    mockSyncPickupOrder.mockResolvedValue({ synced: true });
    const screen = renderProbe();

    await waitFor(() =>
      expect(screen.getByTestId("reservation-loading")).toHaveTextContent("false")
    );

    fireEvent.press(screen.getByTestId("add-failed-seller-reservation"));

    await waitFor(() =>
      expect(screen.getByTestId("reservation-sync-status")).toHaveTextContent(
        "failed"
      )
    );
    expect(screen.getByTestId("reservation-sync-error")).toHaveTextContent(
      "Network unavailable"
    );

    fireEvent.press(screen.getByTestId("retry-reservation-sync"));

    await waitFor(() =>
      expect(screen.getByTestId("reservation-sync-status")).toHaveTextContent(
        "synced"
      )
    );
    expect(mockSyncPickupOrder).toHaveBeenCalledWith({
      customer_name: "Mobile customer",
      offer_id: "seller-offer-1",
      pickup_window: "Pickup by 23:45",
      reservation_code: "LB-ER1-123456",
      seller_id: "seller-1",
      total: 5.6,
    });
  });
});

describe("reservationCodeKey", () => {
  it("generates SecureStore-safe keys", () => {
    expect(reservationCodeKey("offer:with/slashes")).toBe(
      "lastbite-reservation-code-offer_with_slashes"
    );
    expect(reservationCodeFallbackKey("offer:with/slashes")).toBe(
      "lastbite-reservation-code-fallback-offer_with_slashes"
    );
  });
});

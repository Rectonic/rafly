import { PermissionStatus } from "expo-modules-core";
import * as Notifications from "expo-notifications";

import {
  cancelPickupReminder,
  getPickupReminderTriggerDate,
  schedulePickupReminder,
  shouldSchedulePickupReminder,
} from "@/lib/pickup-reminders";
import type { BuyerReservation } from "@/types/reservation";

jest.mock("expo-notifications", () => ({
  AndroidImportance: {
    DEFAULT: 5,
  },
  SchedulableTriggerInputTypes: {
    DATE: "date",
  },
  cancelScheduledNotificationAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
}));

const activeReservation: BuyerReservation = {
  codeHint: "3456",
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

describe("pickup reminder helpers", () => {
  const originalMockReminderMode =
    process.env.EXPO_PUBLIC_LASTBITE_E2E_PICKUP_REMINDERS;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_LASTBITE_E2E_PICKUP_REMINDERS =
      originalMockReminderMode;
    jest.mocked(Notifications.cancelScheduledNotificationAsync).mockReset();
    jest.mocked(Notifications.getPermissionsAsync).mockReset();
    jest.mocked(Notifications.requestPermissionsAsync).mockReset();
    jest.mocked(Notifications.scheduleNotificationAsync).mockReset();
    jest.mocked(Notifications.setNotificationChannelAsync).mockReset();
    jest.mocked(Notifications.setNotificationHandler).mockReset();
  });

  it("schedules reminders before the pickup window expires", () => {
    expect(
      getPickupReminderTriggerDate(
        activeReservation,
        new Date("2026-05-28T12:30:00.000Z")
      )?.toISOString()
    ).toBe("2026-05-28T18:15:00.000Z");
  });

  it("skips reminders when the pickup window is too close or expired", () => {
    expect(
      getPickupReminderTriggerDate(
        activeReservation,
        new Date("2026-05-28T18:20:00.000Z")
      )
    ).toBeNull();
    expect(
      shouldSchedulePickupReminder({
        ...activeReservation,
        status: "expired",
      })
    ).toBe(false);
  });

  it("does not remind buyers about seller-backed reservations that failed to sync", () => {
    expect(
      shouldSchedulePickupReminder({
        ...activeReservation,
        sellerId: "seller-1",
        syncStatus: "failed",
      })
    ).toBe(false);
  });

  it("requests permission and schedules one local reminder notification", async () => {
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({
      canAskAgain: true,
      expires: "never",
      granted: false,
      status: PermissionStatus.UNDETERMINED,
    });
    jest.mocked(Notifications.requestPermissionsAsync).mockResolvedValue({
      canAskAgain: true,
      expires: "never",
      granted: true,
      status: PermissionStatus.GRANTED,
    });
    jest
      .mocked(Notifications.scheduleNotificationAsync)
      .mockResolvedValue("notification-1");

    await expect(
      schedulePickupReminder(
        activeReservation,
        {
          body: "Morning Pastry Pack is waiting. Pickup by 18:45",
          title: "Pickup reminder",
        },
        new Date("2026-05-28T12:30:00.000Z")
      )
    ).resolves.toEqual({
      reminderNotificationId: "notification-1",
      reminderScheduledFor: "2026-05-28T18:15:00.000Z",
      reminderStatus: "scheduled",
    });

    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          body: "Morning Pastry Pack is waiting. Pickup by 18:45",
          title: "Pickup reminder",
        }),
        trigger: expect.objectContaining({
          date: new Date("2026-05-28T18:15:00.000Z"),
          type: "date",
        }),
      })
    );
  });

  it("uses a time-stable mock reminder in native e2e mode", async () => {
    process.env.EXPO_PUBLIC_LASTBITE_E2E_PICKUP_REMINDERS = "mock";

    await expect(
      schedulePickupReminder(
        activeReservation,
        {
          body: "Morning Pastry Pack is waiting. Pickup by 18:45",
          title: "Pickup reminder",
        },
        new Date("2026-05-28T18:20:00.000Z")
      )
    ).resolves.toEqual({
      reminderNotificationId: "mock-pickup-reminder-reservation-1",
      reminderScheduledFor: "2026-05-28T18:50:00.000Z",
      reminderStatus: "scheduled",
    });
    expect(Notifications.getPermissionsAsync).not.toHaveBeenCalled();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("records denied permission without scheduling and cancels by notification id", async () => {
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({
      canAskAgain: false,
      expires: "never",
      granted: false,
      status: PermissionStatus.DENIED,
    });

    await expect(
      schedulePickupReminder(
        activeReservation,
        {
          body: "Morning Pastry Pack is waiting. Pickup by 18:45",
          title: "Pickup reminder",
        },
        new Date("2026-05-28T12:30:00.000Z")
      )
    ).resolves.toEqual({
      reminderStatus: "permission-denied",
    });
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();

    await cancelPickupReminder("notification-1");

    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      "notification-1"
    );
  });
});

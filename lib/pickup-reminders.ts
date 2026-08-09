import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

import type { BuyerReservation } from "@/types/reservation";

export const PICKUP_REMINDER_CHANNEL_ID = "pickup-reminders";
export const PICKUP_REMINDER_LEAD_TIME_MS = 30 * 60 * 1000;
const MINIMUM_SCHEDULING_DELAY_MS = 60 * 1000;

export type PickupReminderCopy = {
  body: string;
  title: string;
};

export type PickupReminderScheduleResult = {
  reminderError?: string;
  reminderNotificationId?: string;
  reminderScheduledFor?: string;
  reminderStatus:
    | "scheduled"
    | "permission-denied"
    | "skipped"
    | "failed";
};

let isConfigured = false;

export function configurePickupReminderNotifications() {
  if (isConfigured) {
    return;
  }

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  isConfigured = true;
}

async function ensurePickupReminderChannel() {
  if (Platform.OS !== "android") {
    return;
  }

  await Notifications.setNotificationChannelAsync(PICKUP_REMINDER_CHANNEL_ID, {
    importance: Notifications.AndroidImportance.DEFAULT,
    name: "Pickup reminders",
  });
}

export function getPickupReminderTriggerDate(
  reservation: BuyerReservation,
  now = new Date()
) {
  const triggerDate = new Date(
    new Date(reservation.expiresAt).getTime() - PICKUP_REMINDER_LEAD_TIME_MS
  );

  if (
    Number.isNaN(triggerDate.getTime()) ||
    triggerDate.getTime() - now.getTime() < MINIMUM_SCHEDULING_DELAY_MS
  ) {
    return null;
  }

  return triggerDate;
}

export function shouldSchedulePickupReminder(
  reservation: BuyerReservation,
  now = new Date()
) {
  if (reservation.status !== "active") {
    return false;
  }

  if (reservation.sellerId && reservation.syncStatus === "failed") {
    return false;
  }

  return Boolean(getPickupReminderTriggerDate(reservation, now));
}

async function ensurePickupReminderPermission() {
  const currentPermission = await Notifications.getPermissionsAsync();

  if (currentPermission.granted || currentPermission.status === "granted") {
    return true;
  }

  if (currentPermission.canAskAgain === false) {
    return false;
  }

  const requestedPermission = await Notifications.requestPermissionsAsync();
  return (
    requestedPermission.granted || requestedPermission.status === "granted"
  );
}

export async function schedulePickupReminder(
  reservation: BuyerReservation,
  copy: PickupReminderCopy,
  now = new Date()
): Promise<PickupReminderScheduleResult> {
  const triggerDate = getPickupReminderTriggerDate(reservation, now);

  if (process.env.EXPO_PUBLIC_LASTBITE_E2E_PICKUP_REMINDERS === "mock") {
    if (
      reservation.status !== "active" ||
      (reservation.sellerId && reservation.syncStatus === "failed")
    ) {
      return {
        reminderStatus: "skipped",
      };
    }

    const mockTriggerDate =
      triggerDate ?? new Date(now.getTime() + PICKUP_REMINDER_LEAD_TIME_MS);

    return {
      reminderNotificationId: `mock-pickup-reminder-${reservation.id}`,
      reminderScheduledFor: mockTriggerDate.toISOString(),
      reminderStatus: "scheduled",
    };
  }

  if (!shouldSchedulePickupReminder(reservation, now) || !triggerDate) {
    return {
      reminderStatus: "skipped",
    };
  }

  try {
    configurePickupReminderNotifications();
    await ensurePickupReminderChannel();

    const hasPermission = await ensurePickupReminderPermission();
    if (!hasPermission) {
      return {
        reminderStatus: "permission-denied",
      };
    }

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        body: copy.body,
        data: {
          offerId: reservation.offerId,
          reservationId: reservation.id,
          url: "/reservations",
        },
        title: copy.title,
      },
      trigger: {
        channelId: PICKUP_REMINDER_CHANNEL_ID,
        date: triggerDate,
        type: Notifications.SchedulableTriggerInputTypes.DATE,
      },
    });

    return {
      reminderNotificationId: notificationId,
      reminderScheduledFor: triggerDate.toISOString(),
      reminderStatus: "scheduled",
    };
  } catch (error) {
    return {
      reminderError:
        error instanceof Error ? error.message : "Unable to schedule reminder.",
      reminderStatus: "failed",
    };
  }
}

export async function cancelPickupReminder(notificationId?: string | null) {
  if (!notificationId) {
    return;
  }

  if (notificationId.startsWith("mock-pickup-reminder-")) {
    return;
  }

  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // A missing OS notification should not block reservation status changes.
  }
}

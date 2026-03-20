import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'lastbite-notification-ids';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function loadNotificationIds(): Promise<Record<string, string>> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

async function saveNotificationIds(ids: Record<string, string>): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

/**
 * Request notification permission.
 * Returns true if granted, false otherwise.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * Schedule a local notification 30 minutes before endTime for an offer.
 * Cancels any existing notification for the same offer first.
 *
 * @param offerId - Unique offer ID (used to cancel later)
 * @param restaurant - Restaurant name (shown in notification body)
 * @param endTime - Pickup end time in "HH:MM" format
 * @param body - Localized notification body string
 * @param title - Localized notification title
 */
export async function schedulePickupReminder(
  offerId: string,
  restaurant: string,
  endTime: string,
  body: string,
  title: string,
): Promise<void> {
  // Cancel existing notification for this offer
  await cancelPickupReminder(offerId);

  const [h, m] = endTime.split(':').map(Number);
  const triggerDate = new Date();
  triggerDate.setHours(h, m, 0, 0);
  triggerDate.setTime(triggerDate.getTime() - 30 * 60 * 1000); // 30 min before

  // If trigger time is in the past, don't schedule
  if (triggerDate.getTime() <= Date.now()) return;

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
    },
  });

  const ids = await loadNotificationIds();
  ids[offerId] = notificationId;
  await saveNotificationIds(ids);
}

/**
 * Cancel the scheduled notification for a specific offer.
 */
export async function cancelPickupReminder(offerId: string): Promise<void> {
  const ids = await loadNotificationIds();
  if (ids[offerId]) {
    await Notifications.cancelScheduledNotificationAsync(ids[offerId]);
    delete ids[offerId];
    await saveNotificationIds(ids);
  }
}

/**
 * On app launch: remove stale notification ID references.
 * Notifications that already fired won't be in the scheduled list.
 */
export async function cleanupExpiredNotifications(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const scheduledIds = new Set(scheduled.map((n) => n.identifier));
  const ids = await loadNotificationIds();
  const cleaned: Record<string, string> = {};
  for (const [offerId, notifId] of Object.entries(ids)) {
    if (scheduledIds.has(notifId)) cleaned[offerId] = notifId;
  }
  await saveNotificationIds(cleaned);
}

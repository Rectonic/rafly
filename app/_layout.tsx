import { Stack, useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { configurePickupReminderNotifications } from "@/lib/pickup-reminders";
import { AppProviders } from "@/lib/providers";

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    configurePickupReminderNotifications();

    const subscription = Notifications.addNotificationResponseReceivedListener(
      () => {
        router.push("/reservations");
      }
    );

    return () => {
      subscription.remove();
    };
  }, [router]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProviders>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false }} />
        </AppProviders>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

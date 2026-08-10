import { Stack, useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ApiProvider } from "@/lib/api";
import { makeAppRuntime } from "@/lib/api/app-runtime";
import { FeatureFlagsProvider } from "@/lib/feature-flags";
import { configurePickupReminderNotifications } from "@/lib/pickup-reminders";
import { AppProviders } from "@/lib/providers";

export default function RootLayout() {
  const router = useRouter();
  // Built once. FeatureFlagsProvider re-reads whenever the source identity
  // changes, so a runtime rebuilt on every render would refetch the flag on
  // every render too.
  const runtime = useMemo(() => makeAppRuntime(), []);

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
        <FeatureFlagsProvider source={runtime.flagSource}>
          <ApiProvider
            buyerApi={runtime.buyerApi}
            sellerApi={runtime.sellerApi}
          >
            <AppProviders>
              <StatusBar style="auto" />
              <Stack screenOptions={{ headerShown: false }} />
            </AppProviders>
          </ApiProvider>
        </FeatureFlagsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

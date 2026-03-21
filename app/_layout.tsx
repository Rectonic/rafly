import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { LocaleProvider } from '@/i18n';
import { FavoritesProvider } from '@/lib/favorites-store';
import { SearchProvider } from '@/lib/search-store';
import { cleanupExpiredNotifications } from '@/lib/notifications';

export default function RootLayout() {
  const scheme = useColorScheme();

  useEffect(() => {
    // Clean up stale notification references on every app launch
    cleanupExpiredNotifications();
  }, []);

  return (
    <LocaleProvider>
      <FavoritesProvider>
        <SearchProvider>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="offer/[id]"
              options={{
                presentation: 'modal',
                headerShown: false,
              }}
            />
          </Stack>
        </SearchProvider>
      </FavoritesProvider>
    </LocaleProvider>
  );
}

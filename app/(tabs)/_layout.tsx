import { Tabs } from 'expo-router';
import { Utensils, Heart, Settings } from 'lucide-react-native';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/i18n';

export default function TabLayout() {
  const colors = useColors();
  const t = useT();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t.mobile.tabFeed,
          tabBarIcon: ({ color, size }) => (
            <Utensils stroke={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: t.mobile.tabFavorites,
          tabBarIcon: ({ color, size }) => (
            <Heart stroke={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t.mobile.tabSettings,
          tabBarIcon: ({ color, size }) => (
            <Settings stroke={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}

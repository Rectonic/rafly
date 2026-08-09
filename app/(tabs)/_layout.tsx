import { Tabs } from "expo-router";

import { TabBarIcon, type TabBarIconName } from "@/components/TabBarIcon";
import { useT } from "@/i18n";

function tabIcon(name: TabBarIconName, focusedName?: TabBarIconName) {
  return function TabIconRenderer({
    color,
    focused,
    size,
  }: {
    color: string;
    focused: boolean;
    size: number;
  }) {
    return (
      <TabBarIcon
        color={color}
        focused={focused}
        focusedName={focusedName}
        name={name}
        size={size}
      />
    );
  };
}

export default function BuyerTabsLayout() {
  const t = useT();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#16C79A",
        tabBarInactiveTintColor: "#8A8F98",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarButtonTestID: "tab-feed",
          tabBarIcon: tabIcon("map-outline", "map"),
          title: t.nav.feed,
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          tabBarButtonTestID: "tab-favorites",
          tabBarIcon: tabIcon("heart-outline", "heart"),
          title: t.nav.favorites,
        }}
      />
      <Tabs.Screen
        name="reservations"
        options={{
          tabBarButtonTestID: "tab-reservations",
          tabBarIcon: tabIcon("receipt-outline", "receipt"),
          title: t.nav.reservations,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarButtonTestID: "tab-settings",
          tabBarIcon: tabIcon("settings-outline", "settings"),
          title: t.nav.settings,
        }}
      />
    </Tabs>
  );
}

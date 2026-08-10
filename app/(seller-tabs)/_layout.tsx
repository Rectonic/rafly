import { ActivityIndicator, View } from "react-native";
import { Redirect, Tabs } from "expo-router";

import { TabBarIcon, type TabBarIconName } from "@/components/TabBarIcon";
import { useT } from "@/i18n";
import { useAuth } from "@/lib/seller/auth-store";
import { getSellerTabVisibility } from "@/lib/seller/tab-visibility";

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

export default function SellerTabsLayout() {
  const { isLoading, sellerProfile, session } = useAuth();
  const t = useT();

  if (isLoading) {
    return (
      <View style={{ alignItems: "center", flex: 1, justifyContent: "center" }}>
        <ActivityIndicator color="#16C79A" />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/auth/login" />;
  }

  if (!sellerProfile) {
    return <Redirect href="/auth/business-type" />;
  }

  const visibleTabs = getSellerTabVisibility(sellerProfile.businessType);

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
          tabBarButtonTestID: "seller-tab-home",
          tabBarIcon: tabIcon("storefront-outline", "storefront"),
          title: t.seller.nav.home,
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          href: visibleTabs.create ? undefined : null,
          tabBarButtonTestID: "seller-tab-create",
          tabBarIcon: tabIcon("add-circle-outline", "add-circle"),
          title: t.seller.nav.create,
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          href: visibleTabs.inventory ? undefined : null,
          tabBarButtonTestID: "seller-tab-inventory",
          tabBarIcon: tabIcon("barcode-outline", "barcode"),
          title: t.seller.nav.inventory,
        }}
      />
      <Tabs.Screen
        name="inventory-v2"
        options={{
          href: null,
          title: t.sellerV2.inventory.title,
        }}
      />
      <Tabs.Screen
        name="count-session-v2"
        options={{
          href: null,
          title: t.sellerV2.count.title,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          tabBarButtonTestID: "seller-tab-orders",
          tabBarIcon: tabIcon("receipt-outline", "receipt"),
          title: t.seller.nav.orders,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarButtonTestID: "seller-tab-profile",
          tabBarIcon: tabIcon("person-circle-outline", "person-circle"),
          title: t.seller.nav.profile,
        }}
      />
    </Tabs>
  );
}

import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useT } from "@/i18n";
import { useStoreMembershipV2 } from "@/lib/seller/store-context-v2";

/**
 * Dashboard entry point into the Shop Seller beta. Renders nothing unless
 * useStoreMembershipV2 reports "granted", which already folds together
 * membership, the store flag, and a known role, so this component never
 * has to re decide the gating rule. Every other access value, including no
 * ApiProvider mounted, an unresolved fetch, a disabled store flag, or no
 * membership at all, falls back to the plain v1 dashboard exactly as it
 * renders today.
 */
export function ShopSellerBetaEntryV2() {
  const access = useStoreMembershipV2();
  const router = useRouter();
  const t = useT();

  if (access.access !== "granted") {
    return null;
  }

  return (
    <Pressable
      accessibilityLabel={t.sellerV2.nav.bannerOpen}
      accessibilityRole="button"
      onPress={() => router.push("/(seller-tabs)/inventory-v2")}
      style={styles.banner}
      testID="seller-dashboard-beta-banner"
    >
      <View style={styles.copy}>
        <Text style={styles.title}>{t.sellerV2.nav.bannerTitle}</Text>
        <Text style={styles.subtitle}>{t.sellerV2.nav.bannerSubtitle}</Text>
      </View>
      <Text style={styles.action}>{t.sellerV2.nav.bannerOpen}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  action: {
    color: "#047857",
    fontSize: 13,
    fontWeight: "800",
  },
  banner: {
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderColor: "#16C79A",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    marginTop: 16,
    padding: 14,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  subtitle: {
    color: "#047857",
    fontSize: 12,
    lineHeight: 16,
  },
  title: {
    color: "#065F46",
    fontSize: 15,
    fontWeight: "800",
  },
});

import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { useT } from "@/i18n";
import type { StoreMembershipStateV2 } from "@/lib/seller/store-context-v2";

type AccessGateV2Props = {
  access: StoreMembershipStateV2;
  children: ReactNode;
  screenTestId: string;
};

/**
 * Shared entry gate for every Shop Seller beta v2 screen. Every screen that
 * consumes useStoreMembershipV2 renders this before its own content so the
 * unavailable, loading, error, no-membership, and disabled states look and
 * behave the same everywhere, and children only ever mount once access is
 * "granted".
 */
export function AccessGateV2({ access, children, screenTestId }: AccessGateV2Props) {
  const t = useT();

  if (access.access === "unavailable") {
    return (
      <View style={styles.panel} testID={`${screenTestId}-access-unavailable`}>
        <Text style={styles.message}>{t.sellerV2.access.unavailable}</Text>
      </View>
    );
  }

  if (access.access === "loading") {
    return (
      <View style={styles.panel} testID={`${screenTestId}-access-loading`}>
        <ActivityIndicator color="#16C79A" />
        <Text style={styles.message}>{t.sellerV2.access.loading}</Text>
      </View>
    );
  }

  if (access.access === "error") {
    return (
      <View style={styles.panel} testID={`${screenTestId}-access-error`}>
        <Text style={styles.errorTitle}>{t.sellerV2.access.errorTitle}</Text>
        {access.error ? <Text style={styles.message}>{access.error.message}</Text> : null}
        <Pressable
          accessibilityLabel={t.sellerV2.access.retry}
          accessibilityRole="button"
          onPress={() => void access.refresh()}
          style={styles.retryButton}
          testID={`${screenTestId}-access-retry-button`}
        >
          <Text style={styles.retryText}>{t.sellerV2.access.retry}</Text>
        </Pressable>
      </View>
    );
  }

  if (access.access === "no-membership") {
    return (
      <View style={styles.panel} testID={`${screenTestId}-no-membership`}>
        <Text style={styles.message}>{t.sellerV2.access.noMembership}</Text>
      </View>
    );
  }

  if (access.access === "disabled") {
    return (
      <View style={styles.panel} testID={`${screenTestId}-beta-disabled`}>
        <Text style={styles.message}>{t.sellerV2.access.disabled}</Text>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  errorTitle: {
    color: "#B91C1C",
    fontSize: 15,
    fontWeight: "700",
  },
  message: {
    color: "#6B7280",
    fontSize: 14,
    textAlign: "center",
  },
  panel: {
    alignItems: "center",
    gap: 8,
    padding: 24,
  },
  retryButton: {
    borderColor: "#B91C1C",
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  retryText: {
    color: "#B91C1C",
    fontWeight: "700",
  },
});

import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { AccessGateV2 } from "@/components/seller/AccessGateV2";
import { ExceptionsPanelV2 } from "@/components/seller/ExceptionsPanelV2";
import { InventoryRowV2 } from "@/components/seller/InventoryRowV2";
import { useT } from "@/i18n";
import { useStoreInventoryV2 } from "@/lib/seller/inventory-v2-store";
import { useStoreMembershipV2 } from "@/lib/seller/store-context-v2";

export default function InventoryV2Screen() {
  const access = useStoreMembershipV2();
  const storeId = access.activeMembership?.storeId ?? null;
  const inventory = useStoreInventoryV2(storeId);
  const router = useRouter();
  const t = useT();

  const exceptionCount = inventory.items.filter((item) => item.hasOpenExceptions).length;

  const goToCountSession = (storeProductId?: string) => {
    router.push({
      params: storeProductId ? { storeProductId } : undefined,
      pathname: "/(seller-tabs)/count-session-v2",
    });
  };

  const goToPublish = () => {
    router.push("/(seller-tabs)/publish-v2");
  };

  const goToOffers = () => {
    router.push("/(seller-tabs)/offers-v2");
  };

  const goToPickups = () => {
    router.push("/(seller-tabs)/orders");
  };

  const goToImport = () => {
    router.push("/(seller-tabs)/import-v2");
  };

  return (
    <AccessGateV2 access={access} screenTestId="inventory-v2">
      <ScreenScrollView contentContainerStyle={styles.container} testID="inventory-v2-screen">
        <Text style={styles.title}>{t.sellerV2.inventory.title}</Text>

        <View style={styles.actionsRow}>
          {access.canRecordCount ? (
            <Pressable
              accessibilityLabel={t.sellerV2.inventory.recordCountButton}
              accessibilityRole="button"
              onPress={() => goToCountSession()}
              style={styles.primaryButton}
              testID="inventory-v2-record-count-button"
            >
              <Text style={styles.primaryButtonText}>
                {t.sellerV2.inventory.recordCountButton}
              </Text>
            </Pressable>
          ) : null}
          {access.canApproveAndPublish ? (
            <Pressable
              accessibilityLabel={t.sellerV2.inventory.publishButton}
              accessibilityRole="button"
              onPress={goToPublish}
              style={styles.secondaryButton}
              testID="inventory-v2-publish-button"
            >
              <Text style={styles.secondaryButtonText}>
                {t.sellerV2.inventory.publishButton}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityLabel={t.sellerV2.inventory.offersButton}
            accessibilityRole="button"
            onPress={goToOffers}
            style={styles.secondaryButton}
            testID="inventory-v2-offers-button"
          >
            <Text style={styles.secondaryButtonText}>{t.sellerV2.inventory.offersButton}</Text>
          </Pressable>
          <Pressable
            accessibilityLabel={t.sellerV2.inventory.importButton}
            accessibilityRole="button"
            onPress={goToImport}
            style={styles.secondaryButton}
            testID="inventory-v2-import-button"
          >
            <Text style={styles.secondaryButtonText}>{t.sellerV2.inventory.importButton}</Text>
          </Pressable>
          <Pressable
            accessibilityLabel={t.sellerV2.inventory.pickupsButton}
            accessibilityRole="button"
            onPress={goToPickups}
            style={styles.secondaryButton}
            testID="inventory-v2-pickups-button"
          >
            <Text style={styles.secondaryButtonText}>
              {t.sellerV2.inventory.pickupsButton}
            </Text>
          </Pressable>
        </View>

        {inventory.status === "loading" || inventory.status === "idle" ? (
          <View style={styles.panel} testID="inventory-v2-loading-state">
            <ActivityIndicator color="#16C79A" />
            <Text style={styles.meta}>{t.sellerV2.inventory.loadingItems}</Text>
          </View>
        ) : null}

        {inventory.status === "error" ? (
          <View style={styles.errorPanel} testID="inventory-v2-error-state">
            <Text style={styles.errorText}>
              {inventory.error?.message ?? t.sellerV2.inventory.errorTitle}
            </Text>
            <Pressable
              accessibilityLabel={t.sellerV2.inventory.retry}
              accessibilityRole="button"
              onPress={() => void inventory.refresh()}
              style={styles.errorRetryButton}
              testID="inventory-v2-retry-button"
            >
              <Text style={styles.errorRetryText}>{t.sellerV2.inventory.retry}</Text>
            </Pressable>
          </View>
        ) : null}

        {inventory.status === "ready" ? (
          <>
            <Text style={styles.meta} testID="inventory-v2-item-summary">
              {t.sellerV2.inventory.itemCount(inventory.items.length)}
            </Text>
            <Text style={styles.exceptionsSummary} testID="inventory-v2-exceptions-summary">
              {t.sellerV2.inventory.exceptionsSummary(exceptionCount)}
            </Text>

            {storeId ? (
              <ExceptionsPanelV2
                canResolve={access.canApproveAndPublish}
                onResolved={inventory.refresh}
                storeId={storeId}
              />
            ) : null}

            {inventory.items.length === 0 ? (
              <View style={styles.panel} testID="inventory-v2-empty-state">
                <Text style={styles.title}>{t.sellerV2.inventory.emptyTitle}</Text>
                <Text style={styles.meta}>{t.sellerV2.inventory.emptyHint}</Text>
              </View>
            ) : (
              inventory.items.map((item) => (
                <InventoryRowV2
                  canRecordCount={access.canRecordCount}
                  item={item}
                  key={item.storeProductId}
                  onRecount={goToCountSession}
                />
              ))
            )}
          </>
        ) : null}
      </ScreenScrollView>
    </AccessGateV2>
  );
}

const styles = StyleSheet.create({
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  container: {
    backgroundColor: "#F8F9FA",
    minHeight: "100%",
    padding: 16,
  },
  errorPanel: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    marginBottom: 12,
    padding: 12,
  },
  errorRetryButton: {
    alignSelf: "flex-start",
    borderColor: "#B91C1C",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  errorRetryText: {
    color: "#B91C1C",
    fontWeight: "700",
  },
  errorText: {
    color: "#B91C1C",
  },
  exceptionsSummary: {
    color: "#92400E",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 12,
  },
  meta: {
    color: "#6B7280",
    marginBottom: 8,
  },
  panel: {
    alignItems: "center",
    gap: 6,
    paddingVertical: 24,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#16C79A",
    borderRadius: 12,
    flex: 1,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: "#16C79A",
    borderRadius: 12,
    borderWidth: 1,
    flexBasis: "46%",
    flexGrow: 1,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: "#047857",
    fontWeight: "700",
  },
  title: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 12,
  },
});

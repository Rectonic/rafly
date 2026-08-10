import { Pressable, StyleSheet, Text, View } from "react-native";

import { useT } from "@/i18n";
import type { InventorySummaryV2, StockConfidenceV2 } from "@/lib/contracts";
import { formatIsoTimestampV2 } from "@/lib/seller/format-v2";

type InventoryRowV2Props = {
  canRecordCount: boolean;
  item: InventorySummaryV2;
  onRecount: (storeProductId: string) => void;
};

const CONFIDENCE_STYLE: Record<StockConfidenceV2, { backgroundColor: string; color: string }> = {
  high: { backgroundColor: "#DCFCE7", color: "#166534" },
  low: { backgroundColor: "#FEE2E2", color: "#B91C1C" },
  medium: { backgroundColor: "#FEF3C7", color: "#92400E" },
};

/**
 * Read only inventory row. There is no quantity input here on purpose,
 * onHandQuantity is display only text, the only path to changing it is an
 * approved stock adjustment from a count session (sequence 3).
 */
export function InventoryRowV2({ canRecordCount, item, onRecount }: InventoryRowV2Props) {
  const t = useT();
  const confidenceLabel =
    item.confidence === "high"
      ? t.sellerV2.inventory.confidenceHigh
      : item.confidence === "medium"
        ? t.sellerV2.inventory.confidenceMedium
        : t.sellerV2.inventory.confidenceLow;

  return (
    <View style={styles.card} testID={`inventory-v2-row-${item.storeProductId}`}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{item.productName}</Text>
        <View style={[styles.badge, CONFIDENCE_STYLE[item.confidence]]}>
          <Text
            style={[styles.badgeText, { color: CONFIDENCE_STYLE[item.confidence].color }]}
            testID={`inventory-v2-confidence-${item.storeProductId}`}
          >
            {confidenceLabel}
          </Text>
        </View>
      </View>

      <Text style={styles.meta} testID={`inventory-v2-last-verified-${item.storeProductId}`}>
        {item.lastVerifiedAt
          ? t.sellerV2.inventory.lastVerified(formatIsoTimestampV2(item.lastVerifiedAt))
          : t.sellerV2.inventory.neverVerified}
      </Text>

      <Text style={styles.meta}>{t.sellerV2.inventory.onHandLabel(item.onHandQuantity)}</Text>
      <Text style={styles.meta} testID={`inventory-v2-max-offerable-${item.storeProductId}`}>
        {t.sellerV2.inventory.maxOfferableLabel(item.maxOfferableQuantity)}
      </Text>

      {item.barcode ? (
        <Text style={styles.meta} testID={`inventory-v2-barcode-${item.storeProductId}`}>
          {t.sellerV2.inventory.barcodeLabel(item.barcode)}
        </Text>
      ) : null}
      {item.expiryDate ? (
        <Text style={styles.meta} testID={`inventory-v2-expiry-${item.storeProductId}`}>
          {t.sellerV2.inventory.expiryLabel(item.expiryDate)}
        </Text>
      ) : null}

      {item.hasOpenExceptions && canRecordCount ? (
        <Pressable
          accessibilityLabel={t.sellerV2.inventory.exceptionActionButton}
          accessibilityRole="button"
          onPress={() => onRecount(item.storeProductId)}
          style={styles.exceptionButton}
          testID={`inventory-v2-exception-action-${item.storeProductId}`}
        >
          <Text style={styles.exceptionButtonText}>
            {t.sellerV2.inventory.exceptionActionButton}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D1D5DB",
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
    marginBottom: 12,
    padding: 16,
  },
  exceptionButton: {
    alignSelf: "flex-start",
    borderColor: "#B91C1C",
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  exceptionButtonText: {
    color: "#B91C1C",
    fontSize: 12,
    fontWeight: "700",
  },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
  },
  meta: {
    color: "#6B7280",
    fontSize: 13,
  },
  title: {
    color: "#111827",
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
  },
});

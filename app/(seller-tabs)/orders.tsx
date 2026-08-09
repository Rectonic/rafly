import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useMemo, useState } from "react";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { OrderCard } from "@/components/seller/OrderCard";
import { Scanner } from "@/components/seller/Scanner";
import { useT } from "@/i18n";
import { useLocale } from "@/lib/locale-store";
import { useOrders } from "@/lib/seller/orders-store";

function formatRefreshTime(isoTime: string, locale: "en" | "ru") {
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoTime));
}

export default function OrdersScreen() {
  const t = useT();
  const locale = useLocale();
  const {
    error,
    isLoading,
    lastLoadedAt,
    orders,
    refreshOrders,
    verifyingOrderId,
    verifyPickup,
  } = useOrders();
  const [activeSegment, setActiveSegment] = useState<
    "pending" | "collected" | "cancelled"
  >("pending");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [manualCode, setManualCode] = useState("");

  const visibleOrders = useMemo(
    () => orders.filter((order) => order.status === activeSegment),
    [activeSegment, orders]
  );

  const verifyByCode = async (code: string) => {
    if (verifyingOrderId) {
      return;
    }

    const normalizedCode = code.trim().toUpperCase();
    const targetOrder = orders.find(
      (order) =>
        order.status === "pending" &&
        order.reservationCode.trim().toUpperCase() === normalizedCode
    );

    if (!targetOrder) {
      Alert.alert(
        t.seller.orderHistory.codeNotFoundTitle,
        t.seller.orderHistory.codeNotFoundMessage
      );
      return;
    }

    try {
      await verifyPickup(targetOrder.id);
      setManualCode("");
      Alert.alert(
        t.seller.orderHistory.pickupVerifiedTitle,
        t.seller.orderHistory.pickupVerifiedMessage(targetOrder.customerName)
      );
    } catch (verifyError) {
      Alert.alert(
        t.seller.orderHistory.verificationFailedTitle,
        verifyError instanceof Error
          ? verifyError.message
          : t.seller.orderHistory.verificationFailedFallback
      );
    }
  };

  return (
    <ScreenScrollView
      contentContainerStyle={styles.container}
      testID="seller-orders-screen"
    >
      <Text style={styles.title}>{t.seller.orderHistory.screenTitle}</Text>
      <Pressable
        accessibilityLabel={t.seller.orderHistory.refreshOrders}
        accessibilityRole="button"
        onPress={() => void refreshOrders()}
        style={styles.refreshButton}
        testID="orders-refresh-button"
      >
        <Text style={styles.refreshText}>{t.seller.orderHistory.refreshOrders}</Text>
      </Pressable>
      {lastLoadedAt ? (
        <Text style={styles.meta} testID="orders-last-updated">
          {t.seller.orderHistory.lastUpdated(
            formatRefreshTime(lastLoadedAt, locale)
          )}
        </Text>
      ) : null}
      {isLoading ? (
        <View style={styles.loadingPanel} testID="orders-loading-state">
          <Text style={styles.meta}>{t.seller.orderHistory.loadingOrders}</Text>
        </View>
      ) : null}
      {error ? (
        <View style={styles.errorPanel} testID="orders-error-state">
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            accessibilityLabel={t.seller.orderHistory.refreshOrders}
            accessibilityRole="button"
            onPress={() => void refreshOrders()}
            style={styles.errorRetryButton}
            testID="orders-error-retry-button"
          >
            <Text style={styles.errorRetryText}>
              {t.seller.orderHistory.refreshOrders}
            </Text>
          </Pressable>
        </View>
      ) : null}
      <View style={stylesRow.row}>
        <Pressable
          accessibilityLabel={t.seller.orderHistory.showPendingOrders}
          accessibilityRole="button"
          accessibilityState={{ selected: activeSegment === "pending" }}
          onPress={() => setActiveSegment("pending")}
          style={[styles.segment, activeSegment === "pending" ? styles.segmentActive : null]}
          testID="orders-segment-pending"
        >
          <Text
            style={[
              styles.segmentText,
              activeSegment === "pending" ? styles.segmentTextActive : null,
            ]}
          >
            {t.seller.orderHistory.pending}
          </Text>
        </Pressable>
        <Pressable
          accessibilityLabel={t.seller.orderHistory.showCollectedOrders}
          accessibilityRole="button"
          accessibilityState={{ selected: activeSegment === "collected" }}
          onPress={() => setActiveSegment("collected")}
          style={[styles.segment, activeSegment === "collected" ? styles.segmentActive : null]}
          testID="orders-segment-collected"
        >
          <Text
            style={[
              styles.segmentText,
              activeSegment === "collected" ? styles.segmentTextActive : null,
            ]}
          >
            {t.seller.orderHistory.collected}
          </Text>
        </Pressable>
        <Pressable
          accessibilityLabel={t.seller.orderHistory.showCancelledOrders}
          accessibilityRole="button"
          accessibilityState={{ selected: activeSegment === "cancelled" }}
          onPress={() => setActiveSegment("cancelled")}
          style={[
            styles.segment,
            activeSegment === "cancelled" ? styles.segmentActive : null,
          ]}
          testID="orders-segment-cancelled"
        >
          <Text
            style={[
              styles.segmentText,
              activeSegment === "cancelled" ? styles.segmentTextActive : null,
            ]}
          >
            {t.seller.orderHistory.cancelled}
          </Text>
        </Pressable>
      </View>

      <Pressable
        accessibilityLabel={t.seller.orderHistory.scanReservationCode}
        accessibilityRole="button"
        disabled={Boolean(verifyingOrderId)}
        onPress={() => setScannerOpen(true)}
        style={[styles.button, verifyingOrderId ? styles.disabledButton : null]}
        testID="orders-scan-code-button"
      >
        <Text style={styles.buttonText}>
          {t.seller.orderHistory.scanReservationCode}
        </Text>
      </Pressable>

      <TextInput
        accessibilityLabel={t.seller.orderHistory.manualCodePlaceholder}
        onChangeText={setManualCode}
        placeholder={t.seller.orderHistory.manualCodePlaceholder}
        style={styles.input}
        testID="orders-manual-code-input"
        value={manualCode}
      />
      <Pressable
        accessibilityLabel={t.seller.orderHistory.verifyCode}
        accessibilityRole="button"
        disabled={Boolean(verifyingOrderId)}
        onPress={() => void verifyByCode(manualCode)}
        style={[
          styles.secondaryButton,
          verifyingOrderId ? styles.disabledButton : null,
        ]}
        testID="orders-verify-code-button"
      >
        <Text style={styles.secondaryButtonText}>
          {t.seller.orderHistory.verifyCode}
        </Text>
      </Pressable>

      {visibleOrders.map((order) => (
        <OrderCard
          key={order.id}
          onVerify={
            order.status === "pending" ? () => void verifyByCode(order.reservationCode) : undefined
          }
          isVerifying={verifyingOrderId === order.id}
          order={order}
        />
      ))}
      {!isLoading && !error && visibleOrders.length === 0 ? (
        <Text style={styles.meta}>
          {activeSegment === "pending"
            ? t.seller.orderHistory.noPendingOrders
            : activeSegment === "collected"
              ? t.seller.orderHistory.noCollectedOrders
              : t.seller.orderHistory.noCancelledOrders}
        </Text>
      ) : null}

      <Scanner
        mode="barcode"
        onClose={() => setScannerOpen(false)}
        onScan={(value) => {
          if (typeof value === "string") {
            void verifyByCode(value);
          }
        }}
        visible={scannerOpen}
      />
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: "#16C79A",
    borderRadius: 12,
    marginBottom: 12,
    paddingVertical: 14,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  container: {
    backgroundColor: "#F8F9FA",
    minHeight: "100%",
    padding: 16,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D1D5DB",
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errorText: {
    color: "#B91C1C",
  },
  disabledButton: {
    opacity: 0.6,
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
  loadingPanel: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 12,
  },
  meta: {
    color: "#6B7280",
    marginBottom: 12,
  },
  refreshButton: {
    alignItems: "center",
    borderColor: "#D1D5DB",
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    paddingVertical: 12,
  },
  refreshText: {
    color: "#111827",
    fontWeight: "600",
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: "#D1D5DB",
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
    paddingVertical: 14,
  },
  secondaryButtonText: {
    color: "#111827",
    fontWeight: "600",
  },
  segment: {
    backgroundColor: "#F3F4F6",
    borderRadius: 999,
    flex: 1,
    paddingVertical: 10,
  },
  segmentActive: {
    backgroundColor: "#16C79A",
  },
  segmentText: {
    color: "#111827",
    fontWeight: "600",
    textAlign: "center",
  },
  segmentTextActive: {
    color: "#FFFFFF",
  },
  title: {
    color: "#111827",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 16,
  },
});

const stylesRow = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
});

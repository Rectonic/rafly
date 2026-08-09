import { Pressable, StyleSheet, Text, View } from "react-native";

import { useT } from "@/i18n";
import type { PickupOrder } from "@/types/seller";

type OrderCardProps = {
  isVerifying?: boolean;
  order: PickupOrder;
  onVerify?: () => void;
};

export function OrderCard({
  isVerifying = false,
  order,
  onVerify,
}: OrderCardProps) {
  const t = useT();
  const statusLabel =
    order.status === "collected"
      ? t.seller.orderHistory.statusCollected
      : order.status === "cancelled"
        ? t.seller.orderHistory.statusCancelled
        : t.seller.orderHistory.statusPending;
  const statusStyle =
    order.status === "collected"
      ? styles.statusCollected
      : order.status === "cancelled"
        ? styles.statusCancelled
        : styles.statusPending;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{order.offerTitle}</Text>
      <Text style={styles.meta}>{order.customerName}</Text>
      <Text style={styles.meta}>{order.pickupWindow}</Text>
      <Text style={styles.meta}>{order.reservationCode}</Text>
      <View style={styles.row}>
        <Text
          accessibilityLabel={statusLabel}
          style={[styles.status, statusStyle]}
          testID={`order-status-${order.id}`}
        >
          {statusLabel}
        </Text>
        <Text style={styles.total}>${order.total.toFixed(2)}</Text>
      </View>
      <View
        style={styles.lifecycle}
        testID={`order-lifecycle-${order.id}`}
      >
        <Text style={[styles.lifecycleStep, styles.lifecycleStepDone]}>
          {t.seller.orderHistory.lifecycleReserved}
        </Text>
        <Text style={[styles.lifecycleStep, styles.lifecycleStepDone]}>
          {t.seller.orderHistory.lifecyclePickupWindow}
        </Text>
        <Text
          style={[
            styles.lifecycleStep,
            order.status === "collected" ? styles.lifecycleStepDone : null,
            order.status === "cancelled" ? styles.lifecycleStepCancelled : null,
          ]}
        >
          {order.status === "cancelled"
            ? t.seller.orderHistory.lifecycleCancelled
            : t.seller.orderHistory.lifecycleCollected}
        </Text>
      </View>
      {onVerify ? (
        <Pressable
          accessibilityLabel={t.seller.orderHistory.verifyPickup}
          accessibilityRole="button"
          disabled={isVerifying}
          onPress={onVerify}
          style={[styles.verifyButton, isVerifying ? styles.disabledButton : null]}
          testID={`order-verify-button-${order.id}`}
        >
          <Text style={styles.verifyText}>{t.seller.orderHistory.verifyPickup}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D1D5DB",
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
    marginBottom: 12,
    padding: 16,
  },
  disabledButton: {
    opacity: 0.6,
  },
  meta: {
    color: "#6B7280",
    fontSize: 13,
  },
  lifecycle: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 2,
  },
  lifecycleStep: {
    backgroundColor: "#F3F4F6",
    borderRadius: 999,
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  lifecycleStepCancelled: {
    backgroundColor: "#FEF2F2",
    color: "#B91C1C",
  },
  lifecycleStepDone: {
    backgroundColor: "#EAFBF5",
    color: "#047857",
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  status: {
    borderRadius: 999,
    fontSize: 13,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusCancelled: {
    backgroundColor: "#FEF2F2",
    color: "#B91C1C",
  },
  statusCollected: {
    backgroundColor: "#EAFBF5",
    color: "#047857",
  },
  statusPending: {
    backgroundColor: "#EFF6FF",
    color: "#1D4ED8",
  },
  title: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "600",
  },
  total: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "700",
  },
  verifyButton: {
    alignSelf: "flex-start",
    backgroundColor: "#16C79A",
    borderRadius: 12,
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  verifyText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
});

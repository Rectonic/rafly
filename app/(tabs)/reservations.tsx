import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { useT } from "@/i18n";
import { formatPrice } from "@/lib/format-price";
import { useLocale } from "@/lib/locale-store";
import { useReservationHistory } from "@/lib/reservations-store";
import type {
  BuyerReservation,
  BuyerReservationStatus,
} from "@/types/reservation";

const STATUS_FILTERS: BuyerReservationStatus[] = [
  "active",
  "completed",
  "cancelled",
  "expired",
];

function formatReminderTime(value: string | undefined, locale: string) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
  }).format(new Date(value));
}

function getReminderStatusLabel(
  reservation: BuyerReservation,
  t: ReturnType<typeof useT>,
  locale: string
) {
  if (!reservation.reminderStatus) {
    return null;
  }

  const reminderCopy =
    t.buyerReservations.reminderStatus[reservation.reminderStatus];

  if (typeof reminderCopy === "function") {
    return reminderCopy(
      formatReminderTime(reservation.reminderScheduledFor, locale)
    );
  }

  return reminderCopy;
}

export default function ReservationsScreen() {
  const t = useT();
  const locale = useLocale();
  const {
    cancelReservation,
    completeReservation,
    error,
    isLoading,
    refreshReservations,
    reservations,
    revealedCodes,
    revealPickupCode,
  } = useReservationHistory();
  const [activeStatus, setActiveStatus] =
    useState<BuyerReservationStatus>("active");

  const visibleReservations = useMemo(
    () =>
      reservations.filter(
        (reservation) => reservation.status === activeStatus
      ),
    [activeStatus, reservations]
  );

  return (
    <ScreenScrollView
      bottomInsetPadding={40}
      contentContainerStyle={styles.container}
      testID="reservations-screen"
    >
      <Text style={styles.title}>{t.buyerReservations.title}</Text>
      <View style={styles.segmentRow}>
        {STATUS_FILTERS.map((status) => (
          <Pressable
            accessibilityLabel={t.buyerReservations.statusFilter(status)}
            accessibilityRole="button"
            key={status}
            onPress={() => setActiveStatus(status)}
            style={[
              styles.segment,
              activeStatus === status ? styles.segmentActive : null,
            ]}
            testID={`reservation-status-${status}`}
          >
            <Text
              style={[
                styles.segmentText,
                activeStatus === status ? styles.segmentTextActive : null,
              ]}
            >
              {t.buyerReservations.statusLabel[status]}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <Text style={styles.meta}>{t.buyerReservations.loading}</Text>
      ) : null}
      {error ? (
        <View style={styles.errorPanel}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            accessibilityLabel={t.buyerReservations.retry}
            accessibilityRole="button"
            onPress={() => void refreshReservations()}
            style={styles.retryButton}
          >
            <Text style={styles.retryText}>{t.buyerReservations.retry}</Text>
          </Pressable>
        </View>
      ) : null}

      {visibleReservations.map((reservation) => {
        const revealedCode = revealedCodes[reservation.id];
        const isActive = reservation.status === "active";
        const reminderStatusLabel = getReminderStatusLabel(
          reservation,
          t,
          locale
        );

        return (
          <View
            key={reservation.id}
            style={styles.card}
            testID={`reservation-card-${reservation.id}`}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{reservation.offerTitle}</Text>
              <Text style={styles.statusPill}>
                {t.buyerReservations.statusLabel[reservation.status]}
              </Text>
            </View>
            <Text style={styles.meta}>{reservation.restaurant}</Text>
            <Text style={styles.meta}>{reservation.pickupWindow}</Text>
            <Text style={styles.meta}>
              {formatPrice(reservation.total, locale)}
            </Text>
            <Text style={styles.syncText}>
              {t.buyerReservations.syncStatus[reservation.syncStatus]}
            </Text>
            {reminderStatusLabel ? (
              <Text
                style={styles.reminderText}
                testID={`reservation-reminder-status-${reservation.id}`}
              >
                {reminderStatusLabel}
              </Text>
            ) : null}

            {revealedCode ? (
              <Text
                style={styles.code}
                testID={`reservation-code-${reservation.id}`}
              >
                {revealedCode}
              </Text>
            ) : (
              <Text style={styles.codeHint}>
                {t.buyerReservations.codeEnding(reservation.codeHint)}
              </Text>
            )}

            <Pressable
              accessibilityLabel={t.buyerReservations.showPickupCode}
              accessibilityRole="button"
              onPress={() => void revealPickupCode(reservation.id)}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>
                {t.buyerReservations.showPickupCode}
              </Text>
            </Pressable>

            {isActive ? (
              <View style={styles.actionRow}>
                <Pressable
                  accessibilityLabel={t.buyerReservations.markPickedUp}
                  accessibilityRole="button"
                  onPress={() => void completeReservation(reservation.id)}
                  style={styles.primaryButton}
                >
                  <Text style={styles.primaryButtonText}>
                    {t.buyerReservations.markPickedUp}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityLabel={t.buyerReservations.cancelReservation}
                  accessibilityRole="button"
                  onPress={() => void cancelReservation(reservation.id)}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>
                    {t.buyerReservations.cancelReservation}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        );
      })}

      {!isLoading && visibleReservations.length === 0 ? (
        <Text style={styles.empty} testID="reservations-empty-state">
          {t.buyerReservations.emptyState[activeStatus]}
        </Text>
      ) : null}
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    gap: 8,
    marginTop: 8,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D1D5DB",
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    marginTop: 12,
    padding: 16,
  },
  cardHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
  },
  cardTitle: {
    color: "#111827",
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
  },
  code: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 0,
  },
  codeHint: {
    color: "#4B5563",
    fontSize: 14,
    fontWeight: "600",
  },
  container: {
    backgroundColor: "#F8F9FA",
    minHeight: "100%",
    padding: 16,
  },
  empty: {
    color: "#6B7280",
    marginTop: 16,
  },
  errorPanel: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    marginTop: 12,
    padding: 12,
  },
  errorText: {
    color: "#B91C1C",
  },
  meta: {
    color: "#4B5563",
    fontSize: 14,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#16C79A",
    borderRadius: 8,
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    textAlign: "center",
  },
  reminderText: {
    color: "#2563EB",
    fontSize: 13,
    fontWeight: "600",
  },
  retryButton: {
    alignSelf: "flex-start",
    borderColor: "#B91C1C",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  retryText: {
    color: "#B91C1C",
    fontWeight: "700",
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: "#D1D5DB",
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: "#111827",
    fontWeight: "600",
    textAlign: "center",
  },
  segment: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#D1D5DB",
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 40,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  segmentActive: {
    backgroundColor: "#16C79A",
    borderColor: "#16C79A",
  },
  segmentRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 16,
  },
  segmentText: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "700",
  },
  segmentTextActive: {
    color: "#FFFFFF",
  },
  statusPill: {
    backgroundColor: "#ECFDF5",
    borderRadius: 8,
    color: "#047857",
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  syncText: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "600",
  },
  title: {
    color: "#111827",
    fontSize: 28,
    fontWeight: "700",
  },
});

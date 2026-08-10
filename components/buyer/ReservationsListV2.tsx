import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { useT } from "@/i18n";

import { useInstallationId } from "@/lib/buyer/installation-id";
import { useBuyerReservationsV2 } from "@/lib/buyer/reservations-v2-store";
import { loadPickupCodeV2 } from "@/lib/buyer/secure-pickup-code";

/**
 * Pilot mode reservations list, the buyer facing recovery surface for every
 * reservation the server has on file for this installation. Cancellation
 * itself lives on the offer detail screen, this list is read plus pickup
 * code recovery only, each card links back to the offer for actions.
 */
export function ReservationsListV2() {
  const t = useT();
  const router = useRouter();
  const installationId = useInstallationId();
  const { reservations, isLoading, error, refresh } = useBuyerReservationsV2(installationId);
  const [revealedCodes, setRevealedCodes] = useState<Record<string, string>>({});
  const [revealingId, setRevealingId] = useState<string | null>(null);

  const handleReveal = async (reservationId: string) => {
    setRevealingId(reservationId);
    const code = await loadPickupCodeV2(reservationId);
    if (code) {
      setRevealedCodes((current) => ({ ...current, [reservationId]: code }));
    }
    setRevealingId(null);
  };

  return (
    <ScreenScrollView
      bottomInsetPadding={40}
      contentContainerStyle={styles.container}
      testID="reservations-v2-screen"
    >
      <Text style={styles.title}>{t.buyerV2.reservationsList.title}</Text>

      {isLoading ? (
        <Text style={styles.meta} testID="reservations-v2-loading">
          {t.buyerV2.reservationsList.loading}
        </Text>
      ) : null}

      {error ? (
        <View style={styles.errorPanel} testID="reservations-v2-error">
          <Text style={styles.errorTitle}>{t.buyerV2.reservationsList.errorTitle}</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void refresh()}
            style={styles.retryButton}
            testID="reservations-v2-retry"
          >
            <Text style={styles.retryText}>{t.buyerV2.reservationsList.retry}</Text>
          </Pressable>
        </View>
      ) : null}

      {!isLoading && !error && reservations.length === 0 ? (
        <Text style={styles.empty} testID="reservations-v2-empty">
          {t.buyerV2.reservationsList.empty}
        </Text>
      ) : null}

      {reservations.map((reservation) => {
        const revealedCode = revealedCodes[reservation.id];
        return (
          <View
            key={reservation.id}
            style={styles.card}
            testID={`reservation-v2-card-${reservation.id}`}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{reservation.offerSnapshot.title}</Text>
              <Text style={styles.statusPill}>
                {t.buyerV2.reservation.statusLabel[reservation.status]}
              </Text>
            </View>
            <Text style={styles.meta}>
              {t.buyerV2.reservation.statusDescription[reservation.status]}
            </Text>

            {revealedCode ? (
              <Text
                style={styles.code}
                testID={`reservation-v2-code-${reservation.id}`}
              >
                {revealedCode}
              </Text>
            ) : (
              <Text style={styles.codeHint}>
                {t.buyerV2.reservation.pickupCodeHint(reservation.pickupCodeHint)}
              </Text>
            )}

            {!revealedCode ? (
              <Pressable
                accessibilityRole="button"
                disabled={revealingId === reservation.id}
                onPress={() => void handleReveal(reservation.id)}
                style={styles.secondaryButton}
                testID={`reservation-v2-reveal-${reservation.id}`}
              >
                <Text style={styles.secondaryButtonText}>
                  {t.buyerV2.reservation.showPickupCode}
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/offer/${reservation.offerId}`)}
              style={styles.primaryButton}
              testID={`reservation-v2-view-${reservation.id}`}
            >
              <Text style={styles.primaryButtonText}>
                {t.buyerV2.offerDetail.viewReservation}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
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
  errorTitle: {
    color: "#111827",
    fontWeight: "700",
  },
  meta: {
    color: "#4B5563",
    fontSize: 14,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 8,
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    textAlign: "center",
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
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: "#111827",
    fontWeight: "600",
    textAlign: "center",
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
  title: {
    color: "#111827",
    fontSize: 28,
    fontWeight: "700",
  },
});

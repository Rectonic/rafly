import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { useT } from "@/i18n";
import { useFavorites, useToggleFavorite } from "@/lib/favorites-store";
import { useLocale } from "@/lib/locale-store";
import type { CommandErrorCode, MarketplaceOfferV2 } from "@/lib/contracts";

import { useInstallationId } from "@/lib/buyer/installation-id";
import {
  formatFullPickupWindow,
  formatFullTimestamp,
  formatUzs,
} from "@/lib/buyer/formatting";
import { useBuyerMarketplaceOfferV2 } from "@/lib/buyer/marketplace-v2-store";
import {
  useBuyerReservationsV2,
  useCancelReservationV2,
  useReserveOfferV2,
} from "@/lib/buyer/reservations-v2-store";
import { loadPickupCodeV2 } from "@/lib/buyer/secure-pickup-code";

type OfferDetailV2Props = {
  offerId: string | undefined;
};

/**
 * Pilot mode offer detail. Reads only the public MarketplaceOfferV2 contract
 * and the buyer's own reservations, no seed data and no v1 stores are
 * touched here. Every hook below runs on every render regardless of what
 * the offer fetch has returned so far, only the JSX branches, an offer
 * arriving after a loading render must never change how many hooks this
 * component calls.
 */
export function OfferDetailV2({ offerId }: OfferDetailV2Props) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const favorites = useFavorites();
  const toggleFavorite = useToggleFavorite();
  const installationId = useInstallationId();
  const { offer, isLoading, error, refresh } = useBuyerMarketplaceOfferV2(offerId);
  const {
    reservations,
    refresh: refreshReservations,
  } = useBuyerReservationsV2(installationId);
  const reserveHook = useReserveOfferV2(installationId, {
    onOfferChanged: () => void refresh(),
  });
  const cancelHook = useCancelReservationV2(installationId);
  const [revealedCodes, setRevealedCodes] = useState<Record<string, string>>({});
  const [isRevealing, setIsRevealing] = useState(false);

  if (!offer && isLoading) {
    return (
      <View style={styles.center} testID="offer-detail-v2-loading-state">
        <Text style={styles.meta}>{t.buyerV2.offerDetail.loading}</Text>
      </View>
    );
  }

  if (!offer && error?.code === "not_found") {
    return (
      <View style={styles.center} testID="offer-detail-v2-not-found">
        <Text style={styles.meta}>{t.buyerV2.offerDetail.notFound}</Text>
      </View>
    );
  }

  if (!offer && error) {
    return (
      <View style={styles.errorPanel} testID="offer-detail-v2-error-state">
        <Text style={styles.errorTitle}>{t.buyerV2.offerDetail.errorTitle}</Text>
        <Text style={styles.errorText}>{error.message}</Text>
        <Text style={styles.errorHint}>{t.buyerV2.offerDetail.errorHint}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => void refresh()}
          style={styles.retryButton}
          testID="offer-detail-v2-retry-button"
        >
          <Text style={styles.retryText}>{t.buyerV2.offerDetail.retry}</Text>
        </Pressable>
      </View>
    );
  }

  if (!offer) {
    return (
      <View style={styles.center} testID="offer-detail-v2-not-found">
        <Text style={styles.meta}>{t.buyerV2.offerDetail.notFound}</Text>
      </View>
    );
  }

  const hasDiscount =
    typeof offer.referencePriceUzs === "number" &&
    offer.referencePriceUzs > 0 &&
    typeof offer.discountPercent === "number";
  const isFavorite = favorites.includes(offer.id);
  const availability = describeAvailability(offer, t.buyerV2.offerDetail);
  const canReserve = offer.status === "live" && offer.quantityAvailable > 0;

  // The action panel (reserve button, or the held reservation panel) binds
  // only to a reservation that is actually held. A cancelled, fulfilled, or
  // otherwise terminal reservation for this offer must never hide the
  // reserve button while the offer itself is still live and in stock, that
  // is exactly the bug where the button disappeared forever after one
  // cancellation. reserveHook.reservation is always held when set, it is
  // only ever populated from a successful reserveOfferV2 response.
  const reservationsForOffer = reservations.filter(
    (candidate) => candidate.offerId === offer.id
  );
  const heldReservation =
    reserveHook.reservation ??
    reservationsForOffer.find((candidate) => candidate.status === "held") ??
    null;
  const terminalReservations = reservationsForOffer.filter(
    (candidate) => candidate.status !== "held"
  );
  const displayPickupCode = heldReservation
    ? (reserveHook.pickupCode ?? revealedCodes[heldReservation.id] ?? null)
    : null;
  const reserveErrorMessage = reserveHook.error
    ? describeReserveError(reserveHook.error.code, t.buyerV2.reservation)
    : null;
  const isCancelling =
    heldReservation != null &&
    cancelHook.statusFor(heldReservation.id) === "in-flight";
  const cancelError = heldReservation
    ? cancelHook.errorFor(heldReservation.id)
    : null;
  const cancelErrorMessage = cancelError
    ? describeCancelError(cancelError.code, t.buyerV2.reservation)
    : null;

  const handleReveal = async () => {
    if (!heldReservation || isRevealing) {
      return;
    }
    setIsRevealing(true);
    const code = await loadPickupCodeV2(heldReservation.id);
    if (code) {
      setRevealedCodes((current) => ({ ...current, [heldReservation.id]: code }));
    }
    setIsRevealing(false);
  };

  const handleCancelPress = () => {
    if (!heldReservation) {
      return;
    }
    const reservationId = heldReservation.id;
    Alert.alert(
      t.buyerV2.reservation.cancelConfirmTitle,
      t.buyerV2.reservation.cancelConfirmMessage,
      [
        { style: "cancel", text: t.buyerV2.reservation.cancelConfirmDismiss },
        {
          onPress: () => {
            // heldReservation prefers reserveHook.reservation, the object
            // captured at reserve time. Cancelling updates the server and
            // cancelHook's own per-id status map, but never touches that
            // captured object, so without abandon() the panel would keep
            // treating this reservation as held forever after a successful
            // cancel. Abandoning falls back to the reservations list, which
            // the refetch below brings up to date with the real terminal
            // status, and the offer detail refetch below picks up the
            // released unit.
            void cancelHook.cancel(reservationId).then((result) => {
              if (result?.ok) {
                reserveHook.abandon(offer.id);
                void refreshReservations();
                void refresh();
              }
            });
          },
          style: "destructive",
          text: t.buyerV2.reservation.cancelConfirmConfirm,
        },
      ]
    );
  };

  return (
    <ScreenScrollView
      bottomInsetPadding={20}
      contentContainerStyle={styles.container}
      testID="offer-detail-v2-screen"
      topInsetPadding={20}
    >
      <View style={styles.headerRow}>
        <Text style={styles.restaurant}>{offer.storeName}</Text>
        <Pressable
          accessibilityLabel={t.buyerV2.offerDetail.close}
          accessibilityRole="button"
          hitSlop={10}
          onPress={() => router.back()}
          style={styles.closeButton}
          testID="offer-detail-v2-close-button"
        >
          <Ionicons color="#111827" name="close" size={24} />
        </Pressable>
      </View>

      <Text style={styles.title}>{offer.title}</Text>
      <Text style={styles.meta}>{offer.storeAddress}</Text>

      <View style={styles.priceRow}>
        <Text style={styles.price}>{formatUzs(offer.offerPriceUzs, locale)}</Text>
        {hasDiscount ? (
          <>
            <Text style={styles.oldPrice}>
              {formatUzs(offer.referencePriceUzs as number, locale)}
            </Text>
            <View style={styles.discountBadge} testID="offer-detail-v2-discount-badge">
              <Text style={styles.discountBadgeText}>
                {t.buyerV2.offerDetail.discountBadge(offer.discountPercent as number)}
              </Text>
            </View>
          </>
        ) : null}
      </View>

      <Text style={styles.meta} testID="offer-detail-v2-pickup-window">
        {t.buyerV2.offerDetail.pickupWindow(
          formatFullPickupWindow(offer.pickupStart, offer.pickupEnd, locale, offer.timezone)
        )}
      </Text>
      <Text style={styles.metaSubtle} testID="offer-detail-v2-last-verified">
        {t.buyerV2.offerDetail.lastVerified(
          formatFullTimestamp(offer.lastVerifiedAt, locale, offer.timezone)
        )}
      </Text>
      <Text
        style={availability.tone === "warning" ? styles.availabilityWarning : styles.meta}
        testID="offer-detail-v2-availability"
      >
        {availability.label}
      </Text>

      {offer.contents.length ? (
        <InfoSection
          body={offer.contents.join(", ")}
          testID="offer-detail-v2-contents-section"
          title={t.buyerV2.offerDetail.whatYouMightGet}
        />
      ) : null}
      {offer.pickupInstructions ? (
        <InfoSection
          body={offer.pickupInstructions}
          testID="offer-detail-v2-pickup-instructions-section"
          title={t.buyerV2.offerDetail.pickupInstructionsTitle}
        />
      ) : null}
      {offer.dietaryBadges.length ? (
        <BadgeSection
          badges={offer.dietaryBadges}
          testID="offer-detail-v2-dietary-section"
          title={t.buyerV2.offerDetail.dietaryTitle}
        />
      ) : null}
      {offer.allergens.length ? (
        <BadgeSection
          badges={offer.allergens}
          testID="offer-detail-v2-allergens-section"
          title={t.buyerV2.offerDetail.allergensTitle}
          tone="warning"
        />
      ) : null}
      {offer.cancellationPolicy ? (
        <InfoSection
          body={offer.cancellationPolicy}
          testID="offer-detail-v2-cancellation-policy-section"
          title={t.buyerV2.offerDetail.cancellationPolicyTitle}
        />
      ) : null}

      <Pressable
        onPress={() => void toggleFavorite(offer.id)}
        style={styles.secondaryButton}
        testID="offer-detail-v2-favorite-button"
      >
        <Text style={styles.secondaryText}>
          {isFavorite
            ? t.buyerV2.offerDetail.removeFromFavorites
            : t.buyerV2.offerDetail.addToFavorites}
        </Text>
      </Pressable>

      {terminalReservations.length ? (
        <View style={styles.reservationPanel} testID="offer-detail-v2-reservation-history">
          <Text style={styles.reservationLabel}>{t.buyerV2.reservation.historyTitle}</Text>
          {terminalReservations.map((reservation) => (
            <View
              key={reservation.id}
              style={styles.historyItem}
              testID={`offer-detail-v2-history-item-${reservation.id}`}
            >
              <Text
                style={styles.reservationStatusLabel}
                testID={`offer-detail-v2-history-status-${reservation.id}`}
              >
                {t.buyerV2.reservation.statusLabel[reservation.status]}
              </Text>
              <Text style={styles.meta}>
                {t.buyerV2.reservation.statusDescription[reservation.status]}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {heldReservation ? (
        <View style={styles.reservationPanel} testID="offer-detail-v2-reservation-panel">
          <Text
            style={styles.reservationStatusLabel}
            testID="offer-detail-v2-reservation-status"
          >
            {t.buyerV2.reservation.statusLabel[heldReservation.status]}
          </Text>
          <Text style={styles.meta}>
            {t.buyerV2.reservation.statusDescription[heldReservation.status]}
          </Text>

          <Text style={styles.reservationLabel}>{t.buyerV2.reservation.pickupCode}</Text>
          {displayPickupCode ? (
            <Text
              style={styles.pickupCode}
              testID="offer-detail-v2-pickup-code"
            >
              {displayPickupCode}
            </Text>
          ) : (
            <Text
              style={styles.pickupCodeHint}
              testID="offer-detail-v2-pickup-code-hint"
            >
              {t.buyerV2.reservation.pickupCodeHint(heldReservation.pickupCodeHint)}
            </Text>
          )}
          {!displayPickupCode ? (
            <Pressable
              accessibilityRole="button"
              disabled={isRevealing}
              onPress={() => void handleReveal()}
              style={styles.secondaryButton}
              testID="offer-detail-v2-reveal-code-button"
            >
              <Text style={styles.secondaryText}>
                {t.buyerV2.reservation.showPickupCode}
              </Text>
            </Pressable>
          ) : null}
          {/*
            Exactly one of these two ever renders. The secure recovery line is
            a promise about what happens after a restart, so it is only
            honest when the write actually reached secure storage. When it did
            not, the degraded notice takes its place and says so plainly.
          */}
          {reserveHook.storageDegraded ? (
            <Text
              style={styles.errorText}
              testID="offer-detail-v2-storage-degraded-notice"
            >
              {t.buyerV2.reservation.storageDegradedNote}
            </Text>
          ) : (
            <Text
              style={styles.metaSubtle}
              testID="offer-detail-v2-secure-recovery-note"
            >
              {t.buyerV2.reservation.secureRecoveryNote}
            </Text>
          )}

          <Text style={styles.meta} testID="offer-detail-v2-hold-expires">
            {t.buyerV2.reservation.holdExpiresAt(
              formatFullTimestamp(heldReservation.holdExpiresAt, locale, offer.timezone)
            )}
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={isCancelling}
            onPress={handleCancelPress}
            style={[styles.secondaryButton, isCancelling ? styles.disabledButton : null]}
            testID="offer-detail-v2-cancel-button"
          >
            <Text style={styles.secondaryText}>
              {isCancelling
                ? t.buyerV2.reservation.cancelling
                : t.buyerV2.reservation.cancel}
            </Text>
          </Pressable>
          {cancelErrorMessage ? (
            <Text style={styles.errorText} testID="offer-detail-v2-cancel-error">
              {cancelErrorMessage}
            </Text>
          ) : null}
        </View>
      ) : (
        <>
          <Pressable
            accessibilityRole="button"
            disabled={!canReserve || reserveHook.status === "in-flight"}
            onPress={() => void reserveHook.reserve(offer)}
            style={[
              styles.primaryButton,
              !canReserve || reserveHook.status === "in-flight"
                ? styles.disabledButton
                : null,
            ]}
            testID="offer-detail-v2-reserve-button"
          >
            <Text style={styles.primaryText}>
              {reserveHook.status === "in-flight"
                ? t.buyerV2.offerDetail.reserving
                : t.buyerV2.offerDetail.reserveNow}
            </Text>
          </Pressable>
          {reserveErrorMessage ? (
            <Text style={styles.errorText} testID="offer-detail-v2-reserve-error">
              {reserveErrorMessage}
            </Text>
          ) : null}
        </>
      )}
    </ScreenScrollView>
  );
}

function describeAvailability(
  offer: MarketplaceOfferV2,
  copy: {
    soldOut: string;
    expired: string;
    paused: string;
    withdrawn: string;
    quantityAvailable: (n: number) => string;
  }
): { label: string; tone: "default" | "warning" } {
  switch (offer.status) {
    case "sold_out":
      return { label: copy.soldOut, tone: "warning" };
    case "expired":
      return { label: copy.expired, tone: "warning" };
    case "paused":
      return { label: copy.paused, tone: "warning" };
    case "withdrawn":
      return { label: copy.withdrawn, tone: "warning" };
    default:
      return { label: copy.quantityAvailable(offer.quantityAvailable), tone: "default" };
  }
}

function describeReserveError(
  code: CommandErrorCode,
  copy: {
    soldOutMessage: string;
    offerNotLiveMessage: string;
    staleVersionMessage: string;
    networkErrorMessage: string;
    genericErrorMessage: string;
  }
): string {
  switch (code) {
    case "sold_out":
      return copy.soldOutMessage;
    case "offer_not_live":
      return copy.offerNotLiveMessage;
    case "version_conflict":
      return copy.staleVersionMessage;
    case "network_error":
      return copy.networkErrorMessage;
    default:
      return copy.genericErrorMessage;
  }
}

function describeCancelError(
  code: CommandErrorCode,
  copy: {
    cancelNetworkErrorMessage: string;
    cancelGenericErrorMessage: string;
  }
): string {
  return code === "network_error" ? copy.cancelNetworkErrorMessage : copy.cancelGenericErrorMessage;
}

function InfoSection({
  body,
  testID,
  title,
}: {
  body: string;
  testID: string;
  title: string;
}) {
  return (
    <View style={styles.infoSection} testID={testID}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionBody}>{body}</Text>
    </View>
  );
}

function BadgeSection({
  badges,
  testID,
  title,
  tone = "default",
}: {
  badges: string[];
  testID: string;
  title: string;
  tone?: "default" | "warning";
}) {
  return (
    <View style={styles.infoSection} testID={testID}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.badgeRow}>
        {badges.map((badge) => (
          <View
            key={badge}
            style={[styles.badge, tone === "warning" ? styles.warningBadge : null]}
          >
            <Text
              style={[styles.badgeText, tone === "warning" ? styles.warningBadgeText : null]}
            >
              {badge}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  availabilityWarning: {
    color: "#9A3412",
    fontSize: 15,
    fontWeight: "700",
  },
  badge: {
    backgroundColor: "#EAFBF5",
    borderColor: "#B8EAD9",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  badgeText: {
    color: "#047857",
    fontSize: 13,
    fontWeight: "700",
  },
  center: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  closeButton: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#D1D5DB",
    borderRadius: 20,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  container: {
    backgroundColor: "#F8F9FA",
    gap: 10,
    minHeight: "100%",
    padding: 20,
  },
  disabledButton: {
    opacity: 0.5,
  },
  discountBadge: {
    backgroundColor: "#FFF1E8",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  discountBadgeText: {
    color: "#C2410C",
    fontSize: 13,
    fontWeight: "700",
  },
  errorHint: {
    color: "#6B7280",
    fontSize: 12,
    lineHeight: 17,
  },
  errorPanel: {
    backgroundColor: "#FFF7ED",
    borderColor: "#FDBA74",
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    margin: 16,
    padding: 12,
  },
  errorText: {
    color: "#9A3412",
    fontSize: 13,
    lineHeight: 18,
  },
  errorTitle: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "700",
  },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  historyItem: {
    borderTopColor: "#E5E7EB",
    borderTopWidth: 1,
    gap: 4,
    paddingTop: 8,
  },
  infoSection: {
    gap: 8,
    marginTop: 10,
  },
  meta: {
    color: "#4B5563",
    fontSize: 15,
  },
  metaSubtle: {
    color: "#9CA3AF",
    fontSize: 12,
  },
  oldPrice: {
    color: "#9CA3AF",
    fontSize: 15,
    textDecorationLine: "line-through",
  },
  pickupCode: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "800",
  },
  pickupCodeHint: {
    color: "#4B5563",
    fontSize: 14,
    fontWeight: "600",
  },
  price: {
    color: "#16C79A",
    fontSize: 20,
    fontWeight: "800",
  },
  priceRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#16C79A",
    borderRadius: 12,
    marginTop: 20,
    paddingVertical: 14,
  },
  primaryText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  reservationLabel: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
    textTransform: "uppercase",
  },
  reservationPanel: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D1D5DB",
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
    marginTop: 12,
    padding: 16,
  },
  reservationStatusLabel: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "800",
  },
  restaurant: {
    color: "#6B7280",
    fontSize: 12,
    textTransform: "uppercase",
  },
  retryButton: {
    alignSelf: "flex-start",
    borderColor: "#EA580C",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  retryText: {
    color: "#9A3412",
    fontWeight: "700",
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: "#D1D5DB",
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 10,
    paddingVertical: 14,
  },
  secondaryText: {
    color: "#111827",
    fontWeight: "600",
  },
  sectionBody: {
    color: "#374151",
    fontSize: 15,
    lineHeight: 21,
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "800",
  },
  title: {
    color: "#111827",
    fontSize: 28,
    fontWeight: "700",
  },
  warningBadge: {
    backgroundColor: "#FFF7ED",
    borderColor: "#FDBA74",
  },
  warningBadgeText: {
    color: "#9A3412",
  },
});

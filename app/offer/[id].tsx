import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { OFFERS } from "@/data/offers";
import { useT } from "@/i18n";
import { useFavorites, useToggleFavorite } from "@/lib/favorites-store";
import { formatPrice } from "@/lib/format-price";
import { useLocale } from "@/lib/locale-store";
import { localizeOffers } from "@/lib/localized-offers";
import { usePublishedSellerOffers } from "@/lib/marketplace-store";
import { createPickupReservation } from "@/lib/reservations";
import {
  useAddReservation,
  useReservationForOffer,
  useRetryReservationSync,
} from "@/lib/reservations-store";
import type { BuyerReservation } from "@/types/reservation";
import { OfferDetailV2 } from "@/components/buyer/OfferDetailV2";
import { useIsPilotMode } from "@/lib/buyer/optional-context";

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

export default function OfferDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const t = useT();
  const favorites = useFavorites();
  const toggleFavorite = useToggleFavorite();
  const locale = useLocale();
  const publishedOffers = usePublishedSellerOffers();
  const [isReserved, setIsReserved] = useState(false);
  const [isReserving, setIsReserving] = useState(false);
  const [reservationCode, setReservationCode] = useState<string | null>(null);
  const [reservationSynced, setReservationSynced] = useState(false);
  const [isRetryingSync, setIsRetryingSync] = useState(false);
  const [createdReservation, setCreatedReservation] =
    useState<BuyerReservation | null>(null);
  const reservationInFlightRef = useRef(false);
  const addReservation = useAddReservation();
  const retryReservationSync = useRetryReservationSync();
  const existingReservation = useReservationForOffer(params.id);
  // Every hook above runs on every render regardless of mode, only the
  // returned JSX branches on isPilot. Skipping any of the v1 hooks above
  // when pilot mode is active would call a different number of hooks
  // between renders once the coordinator flags resolve asynchronously,
  // which is exactly the rules-of-hooks failure this ordering avoids.
  const isPilot = useIsPilotMode();

  const offer = useMemo(
    () =>
      [
        ...localizeOffers(publishedOffers, locale),
        ...localizeOffers(OFFERS, locale),
      ].find((candidate) => candidate.id === params.id),
    [locale, params.id, publishedOffers]
  );

  if (isPilot) {
    return <OfferDetailV2 offerId={params.id} />;
  }

  if (!offer) {
    return (
      <View style={styles.center}>
        <Text style={styles.meta}>{t.offer.notFound}</Text>
      </View>
    );
  }

  const categoryLabel = t.categories[offer.category];
  const priceLabel = t.offer.priceInstead(
    formatPrice(offer.newPrice, locale),
    formatPrice(offer.oldPrice, locale)
  );
  const hasSyncedReservation =
    reservationSynced || existingReservation?.syncStatus === "synced";
  const visibleReservation = createdReservation ?? existingReservation;
  const reminderStatusLabel = visibleReservation?.reminderStatus
    ? (() => {
        const reminderCopy =
          t.buyerReservations.reminderStatus[visibleReservation.reminderStatus];
        return typeof reminderCopy === "function"
          ? reminderCopy(
              formatReminderTime(
                visibleReservation.reminderScheduledFor,
                locale
              )
            )
          : reminderCopy;
      })()
    : null;

  const handleReserve = async () => {
    if (
      reservationInFlightRef.current ||
      isReserving ||
      isReserved ||
      existingReservation
    ) {
      return;
    }

    reservationInFlightRef.current = true;
    setIsReserving(true);

    try {
      const reservation = await createPickupReservation(
        offer,
        t.offer.pickupBy(offer.endTime)
      );
      const persistedReservation = await addReservation(offer, reservation);
      setIsReserved(true);
      setReservationCode(reservation.reservationCode);
      setReservationSynced(reservation.synced);
      setCreatedReservation(persistedReservation);
    } catch (reservationError) {
      Alert.alert(
        t.offer.reservationFailedTitle,
        reservationError instanceof Error
          ? reservationError.message
          : t.offer.reservationFailedFallback
      );
    } finally {
      reservationInFlightRef.current = false;
      setIsReserving(false);
    }
  };

  const handleRetrySync = async () => {
    if (!visibleReservation || isRetryingSync) {
      return;
    }

    setIsRetryingSync(true);

    try {
      const updatedReservation = await retryReservationSync(visibleReservation.id);

      if (updatedReservation) {
        setCreatedReservation(updatedReservation);
        setReservationSynced(updatedReservation.syncStatus === "synced");
      }
    } catch (syncError) {
      Alert.alert(
        t.offer.reservationFailedTitle,
        syncError instanceof Error
          ? syncError.message
          : t.offer.reservationFailedFallback
      );
    } finally {
      setIsRetryingSync(false);
    }
  };

  return (
    <ScreenScrollView
      bottomInsetPadding={20}
      contentContainerStyle={styles.container}
      testID="offer-detail-screen"
      topInsetPadding={20}
    >
      <View style={styles.headerRow}>
        <Text style={styles.restaurant}>{offer.restaurant}</Text>
        <Pressable
          accessibilityLabel={t.offer.closeDetails}
          accessibilityRole="button"
          hitSlop={10}
          onPress={() => router.back()}
          style={styles.closeButton}
          testID="offer-detail-close-button"
        >
          <Ionicons color="#111827" name="close" size={24} />
        </Pressable>
      </View>
      <Text style={styles.title}>{offer.title}</Text>
      <Text style={styles.meta}>{categoryLabel}</Text>
      <Text style={styles.meta}>{priceLabel}</Text>
      <Text style={styles.meta}>{t.offer.pickupBy(offer.endTime)}</Text>
      <Text style={styles.meta}>{offer.location.address}</Text>

      <InfoSection
        body={
          offer.contents?.length
            ? offer.contents.join(", ")
            : t.offer.surpriseContents
        }
        testID="offer-detail-contents-section"
        title={t.offer.whatYouMightGet}
      />
      {offer.pickupInstructions ? (
        <InfoSection
          body={offer.pickupInstructions}
          testID="offer-detail-pickup-instructions-section"
          title={t.offer.pickupInstructionsTitle}
        />
      ) : null}
      {offer.dietaryBadges?.length ? (
        <BadgeSection
          badges={offer.dietaryBadges}
          testID="offer-detail-dietary-section"
          title={t.offer.dietaryTitle}
        />
      ) : null}
      {offer.allergens?.length ? (
        <BadgeSection
          badges={offer.allergens}
          tone="warning"
          testID="offer-detail-allergens-section"
          title={t.offer.allergensTitle}
        />
      ) : null}
      {offer.cancellationPolicy ? (
        <InfoSection
          body={offer.cancellationPolicy}
          testID="offer-detail-cancellation-policy-section"
          title={t.offer.cancellationPolicyTitle}
        />
      ) : null}

      <Pressable
        onPress={() => void toggleFavorite(offer.id)}
        style={styles.secondaryButton}
        testID="offer-detail-favorite-button"
      >
        <Text style={styles.secondaryText}>
          {favorites.includes(offer.id)
            ? t.offer.removeFromFavorites
            : t.offer.addToFavorites}
        </Text>
      </Pressable>

      <Pressable
        disabled={isReserved || isReserving || Boolean(existingReservation)}
        onPress={() => void handleReserve()}
        style={styles.primaryButton}
        testID="offer-detail-reserve-button"
      >
        <Text style={styles.primaryText}>
          {isReserving
            ? t.offer.reserving
            : isReserved || existingReservation
              ? t.offer.reserved
              : t.offer.reserveNow}
        </Text>
      </Pressable>
      {reservationCode || existingReservation ? (
        <View
          style={styles.reservationPanel}
          testID="reservation-confirmation-panel"
        >
          <Text style={styles.reservationLabel}>{t.offer.pickupCode}</Text>
          {reservationCode ? (
            <Text
              style={styles.reservationCode}
              testID="reservation-pickup-code"
            >
              {reservationCode}
            </Text>
          ) : (
            <Text style={styles.meta}>
              {t.buyerReservations.codeEnding(existingReservation?.codeHint ?? "")}
            </Text>
          )}
          <Text style={styles.meta}>
            {hasSyncedReservation
              ? t.offer.reservationSyncedMessage
              : t.offer.reservationLocalMessage}
          </Text>
          {visibleReservation?.syncStatus === "failed" ? (
            <View
              style={styles.syncFailedPanel}
              testID="reservation-sync-failed-panel"
            >
              <Text style={styles.syncFailedTitle}>
                {t.buyerReservations.syncStatus.failed}
              </Text>
              {visibleReservation.syncError ? (
                <Text style={styles.syncFailedMessage}>
                  {visibleReservation.syncError}
                </Text>
              ) : null}
              <Pressable
                accessibilityRole="button"
                disabled={isRetryingSync}
                onPress={() => void handleRetrySync()}
                style={[
                  styles.syncRetryButton,
                  isRetryingSync ? styles.disabledButton : null,
                ]}
                testID="reservation-sync-retry-button"
              >
                <Text style={styles.syncRetryText}>
                  {isRetryingSync ? t.offer.reserving : t.buyerReservations.retry}
                </Text>
              </Pressable>
            </View>
          ) : null}
          {reminderStatusLabel ? (
            <Text style={styles.meta}>{reminderStatusLabel}</Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/reservations")}
            style={styles.viewReservationButton}
            testID="offer-detail-view-reservation-button"
          >
            <Text style={styles.viewReservationText}>
              {t.offer.viewReservation}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </ScreenScrollView>
  );
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
            style={[
              styles.badge,
              tone === "warning" ? styles.warningBadge : null,
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                tone === "warning" ? styles.warningBadgeText : null,
              ]}
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
  },
  container: {
    backgroundColor: "#F8F9FA",
    gap: 10,
    minHeight: "100%",
    padding: 20,
  },
  disabledButton: {
    opacity: 0.6,
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
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  infoSection: {
    gap: 8,
    marginTop: 10,
  },
  meta: {
    color: "#4B5563",
    fontSize: 15,
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
  restaurant: {
    color: "#6B7280",
    fontSize: 12,
    textTransform: "uppercase",
  },
  reservationCode: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "800",
  },
  reservationLabel: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  reservationPanel: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D1D5DB",
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
    marginTop: 10,
    padding: 16,
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
  syncFailedMessage: {
    color: "#9A3412",
    fontSize: 13,
    lineHeight: 18,
  },
  syncFailedPanel: {
    backgroundColor: "#FFF7ED",
    borderColor: "#FDBA74",
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    marginTop: 8,
    padding: 10,
  },
  syncFailedTitle: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "700",
  },
  syncRetryButton: {
    alignSelf: "flex-start",
    borderColor: "#EA580C",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  syncRetryText: {
    color: "#9A3412",
    fontWeight: "700",
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
  viewReservationButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#111827",
    borderRadius: 10,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  viewReservationText: {
    color: "#FFFFFF",
    fontSize: 14,
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

import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { useT } from "@/i18n";
import { useFavorites, useToggleFavorite } from "@/lib/favorites-store";
import { useLocale } from "@/lib/locale-store";
import type { MarketplaceOfferV2 } from "@/lib/contracts";

import { formatFullPickupWindow, formatFullTimestamp, formatUzs } from "@/lib/buyer/formatting";
import { useBuyerMarketplaceOfferV2 } from "@/lib/buyer/marketplace-v2-store";

type OfferDetailV2Props = {
  offerId: string | undefined;
};

/**
 * Pilot mode offer detail. Reads only the public MarketplaceOfferV2 contract
 * through useBuyerMarketplaceOfferV2, no seed data and no v1 stores are
 * touched here. Reservation submission is added in a later slice, this
 * component already renders the correct enabled, sold out, expired, paused,
 * and withdrawn button states so the buyer never sees a reservable looking
 * button for an offer that cannot actually be reserved.
 */
export function OfferDetailV2({ offerId }: OfferDetailV2Props) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const favorites = useFavorites();
  const toggleFavorite = useToggleFavorite();
  const { offer, isLoading, error, refresh } = useBuyerMarketplaceOfferV2(offerId);

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

      <Pressable
        disabled={!canReserve}
        style={[styles.primaryButton, !canReserve ? styles.disabledButton : null]}
        testID="offer-detail-v2-reserve-button"
      >
        <Text style={styles.primaryText}>{t.buyerV2.offerDetail.reserveNow}</Text>
      </Pressable>
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

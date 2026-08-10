import { Pressable, StyleSheet, Text, View } from "react-native";

import { useT } from "@/i18n";
import { formatUzs } from "@/lib/buyer/formatting";
import { formatPrice } from "@/lib/format-price";
import { useLocale } from "@/lib/locale-store";
import type { Offer } from "@/types/offer";

type OfferCardProps = {
  isActive?: boolean;
  isFavorite: boolean;
  offer: Offer;
  onPress: () => void;
  onToggleFavorite: () => void;
  /**
   * Seeds and v1 seller published offers are priced in dollars and always
   * pass this as undefined, which keeps their formatting byte identical to
   * before. Pilot mode offers are priced in whole Uzbek som, callers pass
   * "UZS" so the card matches the currency the offer detail screen already
   * uses instead of routing a UZS amount through the dollar formatter.
   */
  currency?: "USD" | "UZS";
};

export function OfferCard({
  isActive = false,
  isFavorite,
  offer,
  onPress,
  onToggleFavorite,
  currency = "USD",
}: OfferCardProps) {
  const t = useT();
  const locale = useLocale();
  const offerLabel = `${offer.title}, ${offer.restaurant}`;
  const favoriteLabel = isFavorite
    ? `${t.offer.removeFromFavorites}: ${offer.title}`
    : `${t.offer.addToFavorites}: ${offer.title}`;
  const formatOfferPrice = (amount: number) =>
    currency === "UZS" ? formatUzs(amount, locale) : formatPrice(amount, locale);
  // A discount claim needs both a positive percentage and an old price that
  // is genuinely higher than the new one, offer-mappers.ts already sets
  // discount to 0 and oldPrice equal to newPrice when there is no supported
  // reference price, this guard is what keeps that honest mapping from
  // being undone by an unconditional struck price in the card itself.
  const hasRealDiscount = offer.discount > 0 && offer.oldPrice > offer.newPrice;

  return (
    <Pressable
      accessibilityLabel={offerLabel}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
      onPress={onPress}
      style={[styles.card, isActive ? styles.cardActive : null]}
      testID={`offer-card-${offer.id}`}
    >
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.restaurant}>{offer.restaurant}</Text>
          <Text style={styles.title}>{offer.title}</Text>
        </View>
        <Pressable
          accessibilityLabel={favoriteLabel}
          accessibilityRole="button"
          hitSlop={8}
          onPress={onToggleFavorite}
          style={styles.favoriteButton}
          testID={`favorite-toggle-${offer.id}`}
        >
          <Text style={styles.favoriteText}>{isFavorite ? "♥" : "♡"}</Text>
        </Pressable>
      </View>
      <View style={styles.row}>
        <Text style={styles.price}>{formatOfferPrice(offer.newPrice)}</Text>
        {hasRealDiscount ? (
          <Text style={styles.oldPrice}>{formatOfferPrice(offer.oldPrice)}</Text>
        ) : null}
        <Text style={styles.meta}>{offer.distance}</Text>
        <Text style={styles.meta}>{offer.endTime}</Text>
      </View>
      {offer.quantityAvailable ? (
        <Text style={styles.meta}>
          {t.offer.portionsLeft(offer.quantityAvailable)}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D1D5DB",
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    marginBottom: 12,
    padding: 16,
  },
  cardActive: {
    borderColor: "#16C79A",
    borderWidth: 2,
  },
  favoriteButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  favoriteText: {
    color: "#16C79A",
    fontSize: 20,
    fontWeight: "700",
  },
  meta: {
    color: "#6B7280",
    fontSize: 13,
  },
  oldPrice: {
    color: "#9CA3AF",
    fontSize: 14,
    textDecorationLine: "line-through",
  },
  price: {
    color: "#16C79A",
    fontSize: 18,
    fontWeight: "700",
  },
  restaurant: {
    color: "#6B7280",
    fontSize: 12,
    textTransform: "uppercase",
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  title: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 4,
  },
});

import { useRouter } from "expo-router";
import { useMemo } from "react";
import { StyleSheet, Text } from "react-native";

import { OfferCard } from "@/components/OfferCard";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import { OFFERS } from "@/data/offers";
import { useT } from "@/i18n";
import { filterAndSortOffers } from "@/lib/filters";
import { useFavorites, useToggleFavorite } from "@/lib/favorites-store";
import { useLocale } from "@/lib/locale-store";
import { localizeOffers } from "@/lib/localized-offers";
import { usePublishedSellerOffers } from "@/lib/marketplace-store";
import { useSearchQuery } from "@/lib/search-store";

export default function FavoritesScreen() {
  const router = useRouter();
  const favorites = useFavorites();
  const toggleFavorite = useToggleFavorite();
  const publishedOffers = usePublishedSellerOffers();
  const query = useSearchQuery();
  const t = useT();
  const locale = useLocale();

  const offers = useMemo(
    () =>
      filterAndSortOffers({
        activeCategory: "All",
        favoriteIds: favorites,
        offers: [
          ...localizeOffers(publishedOffers, locale),
          ...localizeOffers(OFFERS, locale),
        ],
        query,
        showFavoritesOnly: true,
        sortMode: "expiry",
      }),
    [favorites, locale, publishedOffers, query]
  );
  const emptyMessage =
    favorites.length && query.trim()
      ? t.favorites.noSearchMatches
      : t.favorites.noFavorites;

  return (
    <ScreenScrollView
      contentContainerStyle={styles.container}
      testID="favorites-screen"
    >
      <Text style={styles.title}>{t.nav.favorites}</Text>
      {offers.map((offer) => (
        <OfferCard
          isFavorite
          key={offer.id}
          offer={offer}
          onPress={() => router.push(`/offer/${offer.id}`)}
          onToggleFavorite={() => void toggleFavorite(offer.id)}
        />
      ))}
      {!offers.length ? (
        <Text style={styles.empty} testID="favorites-empty-state">
          {emptyMessage}
        </Text>
      ) : null}
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#F8F9FA",
    minHeight: "100%",
    padding: 16,
  },
  empty: {
    color: "#6B7280",
    marginTop: 16,
  },
  title: {
    color: "#111827",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 12,
  },
});

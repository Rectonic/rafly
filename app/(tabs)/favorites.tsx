import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

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
import { useBuyerMarketplaceFeedV2 } from "@/lib/buyer/marketplace-v2-store";
import {
  mapMarketplaceOfferV2ToOffer,
  UnknownOfferStatusError,
} from "@/lib/buyer/offer-mappers";
import type { Offer } from "@/types/offer";

export default function FavoritesScreen() {
  const router = useRouter();
  const favorites = useFavorites();
  const toggleFavorite = useToggleFavorite();
  const publishedOffers = usePublishedSellerOffers();
  const marketplaceV2 = useBuyerMarketplaceFeedV2();
  const isPilot = marketplaceV2.isPilot;
  const query = useSearchQuery();
  const t = useT();
  const locale = useLocale();

  // Favorites store raw offer ids only, so a v2 offer id filters the same
  // way a v1 id does. Pilot mode still shows only live v2 offers here, a
  // favorited offer that later sells out or expires simply drops off this
  // list along with the main feed, matching the buyer facing contract that
  // pilot mode never mixes in seed supply. A mapping failure is surfaced
  // as an honest error the same way the main feed does, never silently
  // swallowed to an empty list.
  const { offers: pilotOffers, mappingError } = useMemo(() => {
    if (!isPilot) {
      return { mappingError: null as string | null, offers: [] as Offer[] };
    }

    try {
      return {
        mappingError: null,
        offers: marketplaceV2.offers.map((offer) =>
          mapMarketplaceOfferV2ToOffer(offer)
        ),
      };
    } catch (error) {
      return {
        mappingError:
          error instanceof UnknownOfferStatusError
            ? error.message
            : "Unable to read live offers.",
        offers: [],
      };
    }
  }, [isPilot, marketplaceV2.offers]);

  const pilotError = marketplaceV2.error ?? mappingError;

  const offers = useMemo(() => {
    if (isPilot) {
      return filterAndSortOffers({
        activeCategory: "All",
        favoriteIds: favorites,
        offers: pilotOffers,
        query,
        showFavoritesOnly: true,
        sortMode: "expiry",
      });
    }

    return filterAndSortOffers({
      activeCategory: "All",
      favoriteIds: favorites,
      offers: [
        ...localizeOffers(publishedOffers, locale),
        ...localizeOffers(OFFERS, locale),
      ],
      query,
      showFavoritesOnly: true,
      sortMode: "expiry",
    });
  }, [favorites, isPilot, locale, pilotOffers, publishedOffers, query]);
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

      {isPilot && marketplaceV2.isLoading ? (
        <View
          style={styles.inlineStatePanel}
          testID="favorites-pilot-loading-state"
        >
          <Text style={styles.inlineStateText}>{t.buyerV2.feed.loading}</Text>
        </View>
      ) : null}

      {isPilot && pilotError ? (
        <View style={styles.errorPanel} testID="favorites-pilot-error-state">
          <Text style={styles.errorTitle}>{t.buyerV2.feed.errorTitle}</Text>
          <Text style={styles.errorText}>{pilotError}</Text>
          <Text style={styles.errorHint}>{t.buyerV2.feed.errorHint}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void marketplaceV2.refresh()}
            style={styles.retryButton}
            testID="favorites-pilot-retry-button"
          >
            <Text style={styles.retryText}>{t.buyerV2.feed.retry}</Text>
          </Pressable>
        </View>
      ) : null}

      {offers.map((offer) => (
        <OfferCard
          currency={isPilot ? "UZS" : undefined}
          isFavorite
          key={offer.id}
          offer={offer}
          onPress={() => router.push(`/offer/${offer.id}`)}
          onToggleFavorite={() => void toggleFavorite(offer.id)}
        />
      ))}
      {!offers.length && !(isPilot && (pilotError || marketplaceV2.isLoading)) ? (
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
    marginBottom: 12,
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
  inlineStatePanel: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 12,
  },
  inlineStateText: {
    color: "#1D4ED8",
    fontSize: 13,
    fontWeight: "600",
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
  title: {
    color: "#111827",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 12,
  },
});

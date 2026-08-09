import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { OfferCard } from "@/components/OfferCard";
import { OffersMap } from "@/components/OffersMap";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import { OFFER_FILTERS, OFFERS } from "@/data/offers";
import { useT } from "@/i18n";
import {
  filterAndSortOffers,
  type RadiusFilterKm,
  type SortMode,
} from "@/lib/filters";
import {
  getCurrentCoordinates,
  isLocationPermissionDeniedError,
} from "@/lib/device-location";
import { useFavorites, useToggleFavorite } from "@/lib/favorites-store";
import type { GeoPoint } from "@/lib/geo";
import { useLocale } from "@/lib/locale-store";
import { localizeOffers } from "@/lib/localized-offers";
import { useMarketplaceState } from "@/lib/marketplace-store";
import { useSearchQuery, useSetSearchQuery } from "@/lib/search-store";
import type { OfferFilterCategory } from "@/types/offer";

const SORT_OPTIONS: SortMode[] = ["expiry", "price", "discount", "distance"];
const RADIUS_OPTIONS: RadiusFilterKm[] = [1, 3, 5, null];
const DEFAULT_NEAR_ME_RADIUS_KM: RadiusFilterKm = 3;
const MAP_SELECTED_CARD_TOP_GUTTER = 40;
type LocationStatus = "idle" | "locating" | "ready" | "denied" | "failed";

export default function FeedScreen() {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const favorites = useFavorites();
  const toggleFavorite = useToggleFavorite();
  const {
    error: marketplaceError,
    isLoading: isMarketplaceLoading,
    publishedOffers,
    refreshPublishedOffers,
  } = useMarketplaceState();
  const query = useSearchQuery();
  const setQuery = useSetSearchQuery();
  const [activeCategory, setActiveCategory] =
    useState<OfferFilterCategory>("All");
  const [sortMode, setSortMode] = useState<SortMode>("expiry");
  const [activeOfferId, setActiveOfferId] = useState<string | null>(null);
  const [radiusKm, setRadiusKm] = useState<RadiusFilterKm>(null);
  const [userLocation, setUserLocation] = useState<GeoPoint | null>(null);
  const [locationStatus, setLocationStatus] =
    useState<LocationStatus>("idle");
  const feedScrollRef = useRef<ScrollView>(null);
  const offerCardOffsetsRef = useRef<Record<string, number>>({});

  const offers = useMemo(
    () =>
      filterAndSortOffers({
        activeCategory,
        favoriteIds: favorites,
        offers: [
          ...localizeOffers(publishedOffers, locale),
          ...localizeOffers(OFFERS, locale),
        ],
        query,
        radiusKm,
        showFavoritesOnly: false,
        sortMode,
        userLocation,
      }),
    [
      activeCategory,
      favorites,
      locale,
      publishedOffers,
      query,
      radiusKm,
      sortMode,
      userLocation,
    ]
  );

  useEffect(() => {
    if (activeOfferId && !offers.some((offer) => offer.id === activeOfferId)) {
      setActiveOfferId(null);
    }
  }, [activeOfferId, offers]);

  async function handleNearMePress() {
    if (locationStatus === "locating") {
      return;
    }

    setLocationStatus("locating");

    try {
      const coordinates = await getCurrentCoordinates();
      setUserLocation(coordinates);
      setRadiusKm((currentRadius) => currentRadius ?? DEFAULT_NEAR_ME_RADIUS_KM);
      setSortMode("distance");
      setActiveOfferId(null);
      setLocationStatus("ready");
    } catch (error) {
      setUserLocation(null);
      setLocationStatus(
        isLocationPermissionDeniedError(error) ? "denied" : "failed"
      );
    }
  }

  function handleMapSelectOffer(offerId: string) {
    setActiveOfferId(offerId);

    const offerOffset = offerCardOffsetsRef.current[offerId];
    if (typeof offerOffset === "number") {
      feedScrollRef.current?.scrollTo({
        animated: true,
        y: Math.max(0, offerOffset - MAP_SELECTED_CARD_TOP_GUTTER),
      });
    }
  }

  const locationMessage =
    locationStatus === "ready"
      ? t.home.nearMe.active
      : locationStatus === "denied"
        ? t.home.nearMe.denied
        : locationStatus === "failed"
          ? t.home.nearMe.failed
          : null;

  return (
    <ScreenScrollView
      bottomInsetPadding={40}
      contentContainerStyle={styles.container}
      ref={feedScrollRef}
      testID="feed-screen"
    >
      <Text style={styles.title}>{t.home.title}</Text>
      <TextInput
        onChangeText={setQuery}
        placeholder={t.nav.search}
        style={styles.input}
        testID="feed-search-input"
        value={query}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.row}>
          {OFFER_FILTERS.map((category) => (
            <Pressable
              key={category}
              onPress={() => setActiveCategory(category)}
              style={[
                styles.chip,
                activeCategory === category ? styles.chipActive : null,
              ]}
              testID={`category-filter-${category}`}
            >
              <Text
                style={[
                  styles.chipText,
                  activeCategory === category ? styles.chipTextActive : null,
                ]}
              >
                {t.categories[category]}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.row}>
          {SORT_OPTIONS.map((option) => (
            <Pressable
              key={option}
              onPress={() => setSortMode(option)}
              style={[
                styles.sortChip,
                sortMode === option ? styles.chipActive : null,
              ]}
              testID={`sort-option-${option}`}
            >
              <Text
                style={[
                  styles.chipText,
                  sortMode === option ? styles.chipTextActive : null,
                ]}
              >
                {t.home.sort[option]}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <View style={styles.discoveryControls}>
        <View style={styles.discoveryHeader}>
          <Text style={styles.discoveryTitle}>{t.home.radius.title}</Text>
          <Pressable
            accessibilityRole="button"
            disabled={locationStatus === "locating"}
            onPress={() => void handleNearMePress()}
            style={[
              styles.nearMeButton,
              userLocation ? styles.nearMeButtonActive : null,
              locationStatus === "locating" ? styles.disabledButton : null,
            ]}
            testID="near-me-button"
          >
            <Text
              style={[
                styles.nearMeText,
                userLocation ? styles.nearMeTextActive : null,
              ]}
            >
              {locationStatus === "locating"
                ? t.home.nearMe.locating
                : t.home.nearMe.idle}
            </Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.row}>
            {RADIUS_OPTIONS.map((option) => {
              const label = option
                ? t.home.radius.option(option)
                : t.home.radius.all;
              const testId = option
                ? `radius-filter-${option}`
                : "radius-filter-all";

              return (
                <Pressable
                  accessibilityLabel={t.home.radius.accessibilityLabel(label)}
                  accessibilityRole="button"
                  key={testId}
                  onPress={() => {
                    setRadiusKm(option);
                    setActiveOfferId(null);
                  }}
                  style={[
                    styles.sortChip,
                    radiusKm === option ? styles.chipActive : null,
                  ]}
                  testID={testId}
                >
                  <Text
                    style={[
                      styles.chipText,
                      radiusKm === option ? styles.chipTextActive : null,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

      {locationMessage ? (
        <Text style={styles.locationStatus} testID="near-me-status">
          {locationMessage}
        </Text>
      ) : null}
      </View>

      {isMarketplaceLoading ? (
        <View
          style={styles.inlineStatePanel}
          testID="feed-marketplace-loading-state"
        >
          <Text style={styles.inlineStateText}>{t.home.marketplaceLoading}</Text>
        </View>
      ) : null}

      {marketplaceError ? (
        <View style={styles.errorPanel} testID="feed-marketplace-error-state">
          <Text style={styles.errorTitle}>{t.home.marketplaceErrorTitle}</Text>
          <Text style={styles.errorText}>{marketplaceError}</Text>
          <Text style={styles.errorHint}>{t.home.marketplaceErrorHint}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void refreshPublishedOffers()}
            style={styles.retryButton}
            testID="feed-marketplace-retry-button"
          >
            <Text style={styles.retryText}>{t.home.retryMarketplace}</Text>
          </Pressable>
        </View>
      ) : null}

      <Text style={styles.offerCount} testID="feed-offer-count">
        {t.home.offersShowing(offers.length)}
      </Text>

      <OffersMap
        activeOfferId={activeOfferId}
        offers={offers}
        onOpenOffer={(offerId) => router.push(`/offer/${offerId}`)}
        onSelectOffer={handleMapSelectOffer}
        userLocation={userLocation}
      />

      {offers.length ? (
        offers.map((offer) => (
          <View
            key={offer.id}
            onLayout={(event) => {
              offerCardOffsetsRef.current[offer.id] =
                event.nativeEvent.layout.y;
            }}
            testID={`offer-card-layout-${offer.id}`}
          >
            <OfferCard
              isActive={offer.id === activeOfferId}
              isFavorite={favorites.includes(offer.id)}
              offer={offer}
              onPress={() => {
                setActiveOfferId(offer.id);
                router.push(`/offer/${offer.id}`);
              }}
              onToggleFavorite={() => void toggleFavorite(offer.id)}
            />
          </View>
        ))
      ) : (
        <View style={styles.emptyState} testID="feed-empty-state">
          <Text style={styles.emptyTitle}>
            {query.trim()
              ? t.home.noOffersSearch(query.trim())
              : t.home.noOffersCategory}
          </Text>
          <Text style={styles.emptyHint}>{t.home.noOffersHint}</Text>
        </View>
      )}
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: "#F3F4F6",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: "#16C79A",
  },
  chipText: {
    color: "#111827",
    fontWeight: "500",
  },
  chipTextActive: {
    color: "#FFFFFF",
  },
  container: {
    backgroundColor: "#F8F9FA",
    padding: 16,
    paddingBottom: 40,
  },
  disabledButton: {
    opacity: 0.62,
  },
  discoveryControls: {
    marginTop: 14,
  },
  discoveryHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  discoveryTitle: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "700",
  },
  emptyHint: {
    color: "#6B7280",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  emptyState: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D1D5DB",
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
    padding: 16,
  },
  emptyTitle: {
    color: "#111827",
    fontSize: 15,
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
    marginTop: 12,
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
    marginTop: 12,
    padding: 12,
  },
  inlineStateText: {
    color: "#1D4ED8",
    fontSize: 13,
    fontWeight: "600",
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D1D5DB",
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  locationStatus: {
    color: "#4B5563",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
  },
  nearMeButton: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#2563EB",
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 38,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  nearMeButtonActive: {
    backgroundColor: "#2563EB",
  },
  nearMeText: {
    color: "#2563EB",
    fontSize: 13,
    fontWeight: "700",
  },
  nearMeTextActive: {
    color: "#FFFFFF",
  },
  offerCount: {
    color: "#6B7280",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 14,
  },
  row: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
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
  sortChip: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D1D5DB",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  title: {
    color: "#111827",
    fontSize: 28,
    fontWeight: "700",
  },
});

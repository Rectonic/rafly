import React, { useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Search, ChevronDown } from 'lucide-react-native';
import { OFFERS, OFFER_FILTERS } from '@/data/offers';
import { usePublishedSellerOffers } from '@/lib/marketplace-store';
import { filterAndSort, type SortMode } from '@/lib/filters';
import { useSearchQuery, useSetSearchQuery } from '@/lib/search-store';
import { useT } from '@/i18n';
import { useColors } from '@/hooks/useColors';
import { OfferCard } from '@/components/OfferCard';
import { OffersMap } from '@/components/OffersMap';
import type { Offer, OfferFilterCategory } from '@/types/offer';

export default function FeedScreen() {
  const t = useT();
  const colors = useColors();
  const searchQuery = useSearchQuery();
  const setSearchQuery = useSetSearchQuery();
  const publishedOffers = usePublishedSellerOffers();
  const flatListRef = useRef<FlatList<Offer>>(null);

  const [activeCategory, setActiveCategory] = useState<OfferFilterCategory>('All');
  const [sortMode, setSortMode] = useState<SortMode>('expiry');
  const [activeOfferId, setActiveOfferId] = useState<string | null>(null);
  const [showSortMenu, setShowSortMenu] = useState(false);

  const allOffers = useMemo(
    () => [...publishedOffers, ...OFFERS],
    [publishedOffers]
  );

  const sortedOffers = useMemo(
    () => filterAndSort(allOffers, { category: activeCategory, searchQuery, sortMode }),
    [allOffers, activeCategory, searchQuery, sortMode]
  );

  const handleMarkerPress = (offerId: string) => {
    setActiveOfferId(offerId);
    const idx = sortedOffers.findIndex((o) => o.id === offerId);
    if (idx >= 0) flatListRef.current?.scrollToIndex({ index: idx, animated: true });
  };

  const sortLabels: Record<SortMode, string> = {
    expiry: t.home.sort.expiry,
    price: t.home.sort.price,
    discount: t.home.sort.discount,
    distance: t.home.sort.distance,
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.logo, { color: colors.primary }]}>LastBite</Text>
        <View style={[styles.searchBar, { backgroundColor: colors.muted }]}>
          <Search size={16} stroke={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder={t.mobile.searchPlaceholder}
            placeholderTextColor={colors.mutedForeground}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
        </View>
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        <OffersMap
          offers={sortedOffers}
          activeOfferId={activeOfferId}
          onMarkerPress={handleMarkerPress}
          onCalloutPress={(id) => setActiveOfferId(id)}
          formatCalloutMeta={(offer) =>
            `${t.offer.youSave((offer.oldPrice - offer.newPrice).toFixed(2))} · ${t.offer.collectBy} ${offer.endTime}`
          }
          height={250}
        />
      </View>

      {/* Filter chips + sort row */}
      <View style={[styles.controlsRow, { borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
          {OFFER_FILTERS.map((cat) => {
            const isActive = cat === activeCategory;
            return (
              <Pressable
                key={cat}
                onPress={() => setActiveCategory(cat)}
                style={[
                  styles.chip,
                  { borderColor: isActive ? colors.primary : colors.border },
                  isActive && { backgroundColor: colors.primary },
                ]}
              >
                <Text
                  style={[
                    styles.chipLabel,
                    { color: isActive ? '#fff' : colors.mutedForeground },
                  ]}
                >
                  {t.categories[cat as keyof typeof t.categories] ?? cat}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Sort dropdown */}
        <View style={styles.sortArea}>
          <Pressable
            style={[styles.sortPill, { borderColor: colors.border }]}
            onPress={() => setShowSortMenu((v) => !v)}
          >
            <Text style={[styles.sortLabel, { color: colors.foreground }]}>
              {sortLabels[sortMode]}
            </Text>
            <ChevronDown size={14} stroke={colors.mutedForeground} />
          </Pressable>
          {showSortMenu && (
            <View style={[styles.sortMenu, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {(Object.keys(sortLabels) as SortMode[]).map((mode) => (
                <Pressable
                  key={mode}
                  onPress={() => { setSortMode(mode); setShowSortMenu(false); }}
                  style={styles.sortMenuItem}
                >
                  <Text style={[styles.sortMenuLabel, { color: colors.foreground }]}>
                    {sortLabels[mode]}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* Offer count */}
      <Text style={[styles.offerCount, { color: colors.mutedForeground }]}>
        {t.home.offersShowing(sortedOffers.length)}
      </Text>

      {/* Offer list */}
      <FlatList
        ref={flatListRef}
        data={sortedOffers}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <OfferCard
            offer={item}
            index={index}
            isActive={item.id === activeOfferId}
          />
        )}
        onScrollToIndexFailed={() => {}}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {searchQuery
                ? t.home.noOffersSearch(searchQuery)
                : t.home.noOffersCategory}
            </Text>
            <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
              {t.home.noOffersHint}
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    gap: 12,
    borderBottomWidth: 1,
  },
  logo: { fontSize: 20, fontWeight: '700', letterSpacing: -0.5 },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 38,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14 },
  mapContainer: { marginHorizontal: 16, marginTop: 12, borderRadius: 16, overflow: 'hidden' },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingVertical: 8,
  },
  chips: { flex: 1, paddingLeft: 16 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 8,
  },
  chipLabel: { fontSize: 13, fontWeight: '500' },
  sortArea: { paddingRight: 16, position: 'relative' },
  sortPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sortLabel: { fontSize: 13, fontWeight: '500' },
  sortMenu: {
    position: 'absolute',
    right: 16,
    top: 44,
    borderWidth: 1,
    borderRadius: 10,
    zIndex: 100,
    minWidth: 160,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  sortMenuItem: { paddingHorizontal: 14, paddingVertical: 10 },
  sortMenuLabel: { fontSize: 14 },
  offerCount: { fontSize: 12, paddingHorizontal: 16, paddingVertical: 6 },
  emptyState: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 32 },
  emptyText: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  emptyHint: { fontSize: 14, textAlign: 'center', marginTop: 8 },
});

import React, { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Heart } from 'lucide-react-native';
import { OFFERS } from '@/data/offers';
import { usePublishedSellerOffers } from '@/lib/marketplace-store';
import { filterAndSort } from '@/lib/filters';
import { useFavorites } from '@/lib/favorites-store';
import { useT } from '@/i18n';
import { useColors } from '@/hooks/useColors';
import { OfferCard } from '@/components/OfferCard';

export default function FavoritesScreen() {
  const t = useT();
  const colors = useColors();
  const favorites = useFavorites();
  const publishedOffers = usePublishedSellerOffers();

  const allOffers = useMemo(
    () => [...publishedOffers, ...OFFERS],
    [publishedOffers]
  );

  const favoriteOffers = useMemo(
    () =>
      filterAndSort(allOffers, {
        category: 'All',
        searchQuery: '',
        sortMode: 'expiry',
        showFavoritesOnly: true,
        favoriteIds: favorites,
      }),
    [allOffers, favorites]
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          {t.mobile.tabFavorites}
        </Text>
      </View>

      <FlatList
        data={favoriteOffers}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => <OfferCard offer={item} index={index} />}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 24, flexGrow: 1 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Heart size={48} stroke={colors.border} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              {t.mobile.noFavorites}
            </Text>
            <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
              {t.mobile.noFavoritesHint}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  title: { fontSize: 28, fontWeight: '700' },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptyHint: { fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 32 },
});

import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Heart, Clock, Star, MapPin } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import Animated, {
  FadeInDown,
} from 'react-native-reanimated';
import { Badge } from '@/components/ui/Badge';
import { IconButton } from '@/components/ui/IconButton';
import { useCountdown } from '@/hooks/useCountdown';
import { useFavorites, useToggleFavorite } from '@/lib/favorites-store';
import { useT } from '@/i18n';
import { useColors } from '@/hooks/useColors';
import type { Offer } from '@/types/offer';

interface OfferCardProps {
  offer: Offer;
  index: number;
  isActive?: boolean;
}

function StockBar({ qty }: { qty: number }) {
  const colors = useColors();
  const barColor = qty <= 2 ? colors.destructive : qty <= 4 ? colors.amber : colors.primary;
  const width = `${Math.min(100, (qty / 10) * 100)}%` as const;
  return (
    <View style={styles.stockBarBg}>
      <View style={[styles.stockBarFill, { width, backgroundColor: barColor }]} />
    </View>
  );
}

export function OfferCard({ offer, index, isActive }: OfferCardProps) {
  const t = useT();
  const colors = useColors();
  const router = useRouter();
  const favorites = useFavorites();
  const toggleFavorite = useToggleFavorite();
  const isFavorited = favorites.includes(offer.id);
  const { label: countdownLabel, urgent } = useCountdown(offer.endTime);
  const isLowStock = (offer.quantityAvailable ?? 99) <= 3;

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 40).duration(250)}
      style={[styles.shadow]}
    >
      {/* Inner view clips content (overflow:hidden) without clipping the iOS shadow */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: isActive ? colors.primary : colors.border,
            borderWidth: isActive ? 2 : 1,
          },
        ]}
      >
      <Pressable onPress={() => router.push(`/offer/${offer.id}`)}>
        {/* Image */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: offer.image }}
            style={styles.image}
            resizeMode="cover"
          />
          {/* Badges — top right */}
          <View style={styles.badgesTopRight}>
            <Badge
              label={`-${offer.discount}%`}
              bg={colors.secondary}
              color="#fff"
            />
            {offer.isSurpriseBag && (
              <Badge
                label={t.offer.surprise}
                bg={colors.destructive}
                color="#fff"
                style={{ marginTop: 4 }}
              />
            )}
            {isLowStock && (
              <Badge
                label={t.offer.onlyLeft(offer.quantityAvailable!)}
                bg={colors.amber}
                color="#fff"
                style={{ marginTop: 4 }}
              />
            )}
          </View>
          {/* Favorite — top left */}
          <IconButton
            style={styles.favoriteBtn}
            onPress={() => toggleFavorite(offer.id)}
            accessibilityLabel={
              isFavorited ? t.offer.removeFromFavorites : t.offer.addToFavorites
            }
          >
            <Heart
              size={16}
              stroke={isFavorited ? '#FF6B6B' : '#fff'}
              fill={isFavorited ? '#FF6B6B' : 'transparent'}
            />
          </IconButton>
          {/* Countdown — bottom left */}
          <View
            style={[
              styles.countdown,
              { backgroundColor: urgent ? 'rgba(220,38,38,0.8)' : 'rgba(0,0,0,0.6)' },
            ]}
          >
            <Clock size={12} stroke={urgent ? '#fff' : colors.secondary} />
            <Text style={styles.countdownText}>
              {countdownLabel
                ? t.offer.countdown(countdownLabel)
                : `${t.offer.collectBy} ${offer.endTime}`}
            </Text>
          </View>
        </View>

        {/* Card body */}
        <View style={styles.body}>
          <Text style={[styles.restaurant, { color: colors.mutedForeground }]}>
            {offer.restaurant.toUpperCase()}
          </Text>
          <View style={styles.ratingRow}>
            <Star size={12} stroke={colors.secondary} fill={colors.secondary} />
            <Text style={[styles.rating, { color: colors.foreground }]}>
              {offer.rating}
            </Text>
          </View>
          <Text
            style={[styles.title, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {offer.title}
          </Text>

          {offer.quantityAvailable != null && (
            <View style={styles.stockRow}>
              <Text style={[styles.stockLabel, { color: colors.mutedForeground }]}>
                {t.offer.portionsLeft(offer.quantityAvailable)}
              </Text>
              <StockBar qty={offer.quantityAvailable} />
            </View>
          )}

          <View style={styles.priceRow}>
            <View style={styles.priceGroup}>
              <Text style={[styles.newPrice, { color: colors.primary }]}>
                ${offer.newPrice.toFixed(2)}
              </Text>
              <Text style={[styles.oldPrice, { color: colors.mutedForeground }]}>
                ${offer.oldPrice.toFixed(2)}
              </Text>
            </View>
            <View style={styles.distanceBadge}>
              <MapPin size={12} stroke={colors.mutedForeground} />
              <Text style={[styles.distance, { color: colors.mutedForeground }]}>
                {offer.distance}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Outer view: shadow only (NOT overflow:hidden — that clips the shadow on iOS)
  shadow: {
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  // Inner view: clips image to rounded corners
  card: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  imageContainer: { height: 200, position: 'relative' },
  image: { width: '100%', height: '100%' },
  badgesTopRight: { position: 'absolute', top: 10, right: 10 },
  favoriteBtn: { position: 'absolute', top: 10, left: 10 },
  countdown: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  countdownText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  body: { padding: 12 },
  restaurant: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  rating: { fontSize: 12, fontWeight: '500' },
  title: { fontSize: 16, fontWeight: '600', marginTop: 4 },
  stockRow: { marginTop: 8, gap: 4 },
  stockLabel: { fontSize: 12 },
  stockBarBg: { height: 3, backgroundColor: '#E4E4E7', borderRadius: 2 },
  stockBarFill: { height: 3, borderRadius: 2 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  priceGroup: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  newPrice: { fontSize: 20, fontWeight: '700' },
  oldPrice: { fontSize: 14, textDecorationLine: 'line-through' },
  distanceBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  distance: { fontSize: 12 },
});

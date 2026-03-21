import React, { useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Heart, Share2, X, Clock, Leaf, CheckCircle2, Star, MapPin } from 'lucide-react-native';
import { OFFERS } from '@/data/offers';
import { usePublishedSellerOffers } from '@/lib/marketplace-store';
import { useFavorites, useToggleFavorite } from '@/lib/favorites-store';
import { schedulePickupReminder, cancelPickupReminder, requestNotificationPermission } from '@/lib/notifications';
import { useCountdown } from '@/hooks/useCountdown';
import { useT } from '@/i18n';
import { useColors } from '@/hooks/useColors';
import { Button } from '@/components/ui/Button';

export default function OfferDetailModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const t = useT();
  const colors = useColors();
  const favorites = useFavorites();
  const toggleFavorite = useToggleFavorite();
  const publishedOffers = usePublishedSellerOffers();
  const [isReserved, setIsReserved] = useState(false);

  // Find offer from all available offers
  const allOffers = [...publishedOffers, ...OFFERS];
  const offer = allOffers.find((o) => o.id === id);

  const { label: countdownLabel, urgent } = useCountdown(offer?.endTime ?? '23:59');
  const isFavorited = offer ? favorites.includes(offer.id) : false;

  if (!offer) {
    return (
      <View style={styles.notFound}>
        <Text style={{ color: colors.mutedForeground }}>Offer not found.</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: colors.primary }}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const savings = (offer.oldPrice - offer.newPrice).toFixed(2);
  const co2 = (offer.oldPrice * 0.2).toFixed(1);
  const water = Math.round((offer.oldPrice - offer.newPrice) * 35);

  const handleReserve = async () => {
    const granted = await requestNotificationPermission();
    if (!granted) {
      Alert.alert('', t.mobile.notificationPermissionDenied);
    }
    await schedulePickupReminder(
      offer.id,
      offer.restaurant,
      offer.endTime,
      t.mobile.notificationBody(offer.restaurant),
      t.mobile.notificationTitle,
    );
    setIsReserved(true);
  };

  const handleClose = () => {
    router.back();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Close button */}
      <Pressable onPress={handleClose} style={styles.closeBtn}>
        <X size={20} stroke={colors.foreground} />
      </Pressable>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Image */}
        <View style={styles.imageContainer}>
          <Image source={{ uri: offer.image }} style={styles.image} resizeMode="cover" />
          <View style={styles.imageActions}>
            <Pressable
              onPress={() => toggleFavorite(offer.id)}
              style={styles.imageActionBtn}
            >
              <Heart
                size={20}
                stroke={isFavorited ? '#FF6B6B' : '#fff'}
                fill={isFavorited ? '#FF6B6B' : 'transparent'}
              />
            </Pressable>
            <Pressable style={styles.imageActionBtn}>
              <Share2 size={20} stroke="#fff" />
            </Pressable>
          </View>
        </View>

        <View style={styles.content}>
          {isReserved ? (
            /* Reservation confirmation */
            <View style={styles.reservedContainer}>
              <CheckCircle2 size={64} stroke={colors.primary} />
              <Text style={[styles.reservedTitle, { color: colors.foreground }]}>
                {t.offer.reserved}
              </Text>
              <Image
                source={{
                  uri: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${offer.id}-mock`,
                }}
                style={styles.qrCode}
                accessibilityLabel={t.offer.qrAlt}
              />
              <Text style={[styles.qrMessage, { color: colors.mutedForeground }]}>
                {t.offer.qrMessage(offer.restaurant, offer.endTime)}
              </Text>
              {/* Impact stats */}
              <View style={styles.impactGrid}>
                <View style={[styles.impactCard, { backgroundColor: colors.greenLight }]}>
                  <Text style={[styles.impactValue, { color: colors.green }]}>{co2} kg</Text>
                  <Text style={[styles.impactLabel, { color: colors.green }]}>
                    {t.offer.co2Avoided}
                  </Text>
                </View>
                <View style={[styles.impactCard, { backgroundColor: '#EFF6FF' }]}>
                  <Text style={[styles.impactValue, { color: '#3B82F6' }]}>{water}L</Text>
                  <Text style={[styles.impactLabel, { color: '#3B82F6' }]}>
                    {t.offer.waterSaved}
                  </Text>
                </View>
                <View style={[styles.impactCard, { backgroundColor: colors.amberLight }]}>
                  <Text style={[styles.impactValue, { color: colors.amber }]}>${savings}</Text>
                  <Text style={[styles.impactLabel, { color: colors.amber }]}>
                    {t.offer.youSavedStat}
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            /* Offer details */
            <>
              <Text style={[styles.restaurant, { color: colors.mutedForeground }]}>
                {offer.restaurant.toUpperCase()}
              </Text>
              <Text style={[styles.title, { color: colors.foreground }]}>{offer.title}</Text>
              <View style={styles.metaRow}>
                <Star size={13} stroke={colors.secondary} fill={colors.secondary} />
                <Text style={[styles.metaText, { color: colors.foreground }]}>
                  {offer.rating} ({offer.reviews})
                </Text>
                <MapPin size={13} stroke={colors.mutedForeground} />
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                  {offer.distance} {t.offer.away}
                </Text>
              </View>

              {/* Countdown */}
              <View
                style={[
                  styles.countdownBox,
                  {
                    backgroundColor: urgent ? '#FEF2F2' : colors.amberLight,
                    borderColor: urgent ? '#FECACA' : colors.amberBorder,
                  },
                ]}
              >
                <Clock size={16} stroke={urgent ? colors.destructive : colors.amber} />
                <View>
                  <Text
                    style={[
                      styles.countdownText,
                      { color: urgent ? colors.destructive : '#92400E' },
                    ]}
                  >
                    {t.offer.collectToday}
                    {countdownLabel ? ` · ${countdownLabel}` : ''}
                  </Text>
                  {offer.pickupStart && (
                    <Text style={[styles.pickupWindow, { color: '#A16207' }]}>
                      {t.offer.pickupWindow(offer.pickupStart, offer.endTime)}
                    </Text>
                  )}
                </View>
              </View>

              {/* Portions */}
              {offer.quantityAvailable != null && (
                <View style={[styles.portionsRow, { backgroundColor: colors.muted }]}>
                  <Text style={[styles.portionsLabel, { color: colors.foreground }]}>
                    {t.offer.portionsAvailable}
                  </Text>
                  <Text
                    style={[
                      styles.portionsValue,
                      {
                        color:
                          offer.quantityAvailable <= 2
                            ? colors.destructive
                            : offer.quantityAvailable <= 4
                            ? colors.amber
                            : colors.primary,
                      },
                    ]}
                  >
                    {offer.quantityAvailable}
                  </Text>
                </View>
              )}

              {/* Contents */}
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                {t.offer.whatYouMightGet}
              </Text>
              {offer.contents && offer.contents.length > 0 ? (
                offer.contents.map((item) => (
                  <Text key={item} style={[styles.contentItem, { color: colors.foreground }]}>
                    • {item}
                  </Text>
                ))
              ) : (
                <Text style={[styles.desc, { color: colors.mutedForeground }]}>
                  {offer.isSurpriseBag ? t.offer.surpriseBagDesc : t.offer.regularDesc}
                </Text>
              )}

              {/* Impact teaser */}
              <View style={[styles.impactTeaser, { backgroundColor: colors.greenLight }]}>
                <Leaf size={16} stroke={colors.green} />
                <Text style={[styles.impactTeaserText, { color: colors.green }]}>
                  {t.offer.impactTeaser(parseFloat(co2), water)}
                </Text>
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {/* Sticky footer — only when not reserved */}
      {!isReserved && (
        <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
          <View>
            <View style={styles.priceRow}>
              <Text style={[styles.newPrice, { color: colors.primary }]}>
                ${offer.newPrice.toFixed(2)}
              </Text>
              <Text style={[styles.oldPrice, { color: colors.mutedForeground }]}>
                ${offer.oldPrice.toFixed(2)}
              </Text>
            </View>
            <Text style={[styles.saveText, { color: colors.secondary }]}>
              {t.offer.youSave(savings)}
            </Text>
          </View>
          <Button
            label={t.offer.reserveNow}
            onPress={handleReserve}
            style={styles.reserveBtn}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  closeBtn: {
    position: 'absolute',
    top: 52,
    right: 16,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageContainer: { height: 250, position: 'relative' },
  image: { width: '100%', height: '100%' },
  imageActions: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    gap: 8,
  },
  imageActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { padding: 16 },
  restaurant: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
  title: { fontSize: 22, fontWeight: '700', marginTop: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  metaText: { fontSize: 13 },
  countdownBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
  },
  countdownText: { fontSize: 14, fontWeight: '600' },
  pickupWindow: { fontSize: 12, marginTop: 2 },
  portionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  portionsLabel: { fontSize: 14 },
  portionsValue: { fontSize: 18, fontWeight: '700' },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginTop: 20, marginBottom: 8 },
  contentItem: { fontSize: 14, lineHeight: 22 },
  desc: { fontSize: 14, lineHeight: 22 },
  impactTeaser: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
    marginBottom: 8,
  },
  impactTeaserText: { flex: 1, fontSize: 14, lineHeight: 20 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
  },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  newPrice: { fontSize: 24, fontWeight: '700' },
  oldPrice: { fontSize: 16, textDecorationLine: 'line-through' },
  saveText: { fontSize: 13, fontWeight: '500', marginTop: 2 },
  reserveBtn: { flex: 1, marginLeft: 16 },
  // Reservation confirmation
  reservedContainer: { alignItems: 'center', paddingTop: 16 },
  reservedTitle: { fontSize: 24, fontWeight: '700', marginTop: 16 },
  qrCode: { width: 150, height: 150, marginTop: 20 },
  qrMessage: { fontSize: 14, textAlign: 'center', marginTop: 12, lineHeight: 20 },
  impactGrid: { flexDirection: 'row', gap: 12, marginTop: 24, flexWrap: 'wrap' },
  impactCard: {
    flex: 1,
    minWidth: 80,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  impactValue: { fontSize: 20, fontWeight: '700' },
  impactLabel: { fontSize: 11, textAlign: 'center', marginTop: 4 },
});

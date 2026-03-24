import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { OffersMapProps } from '@/components/OffersMap.types';

export function OffersMap({
  offers,
  activeOfferId,
  onMarkerPress,
  onCalloutPress,
  formatCalloutMeta,
  height = 250,
}: OffersMapProps) {
  return (
    <View style={[styles.container, { height }]}>
      <Text style={styles.title}>Map preview</Text>
      <Text style={styles.subtitle}>
        Interactive maps are available on iOS and Android. The web preview shows nearby offers instead.
      </Text>

      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {offers.map((offer) => {
          const isActive = offer.id === activeOfferId;

          return (
            <Pressable
              key={offer.id}
              onPress={() => {
                onMarkerPress(offer.id);
                onCalloutPress(offer.id);
              }}
              style={[
                styles.offerCard,
                isActive && styles.offerCardActive,
              ]}
            >
              <Text style={styles.offerTitle}>{offer.title}</Text>
              <Text style={styles.offerRestaurant}>{offer.restaurant}</Text>
              <Text style={styles.offerMeta}>{formatCalloutMeta(offer)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#F4F7F5',
    padding: 14,
    gap: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: '#4B5563',
  },
  listContent: {
    gap: 8,
    paddingTop: 8,
    paddingBottom: 4,
  },
  offerCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    padding: 12,
    gap: 3,
  },
  offerCardActive: {
    borderColor: '#16C79A',
    backgroundColor: '#ECFDF5',
  },
  offerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  offerRestaurant: {
    fontSize: 12,
    color: '#6B7280',
  },
  offerMeta: {
    fontSize: 12,
    fontWeight: '500',
    color: '#0F766E',
  },
});

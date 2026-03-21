import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Callout, type Region } from 'react-native-maps';
import { Text } from 'react-native';
import type { Offer } from '@/types/offer';

const TASHKENT_REGION: Region = {
  latitude: 41.3111,
  longitude: 69.2797,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

interface OffersMapProps {
  offers: Offer[];
  activeOfferId: string | null;
  onMarkerPress: (offerId: string) => void;
  onCalloutPress: (offerId: string) => void;
  formatCalloutMeta: (offer: Offer) => string;
  height?: number;
}

export function OffersMap({
  offers,
  activeOfferId,
  onMarkerPress,
  onCalloutPress,
  formatCalloutMeta,
  height = 250,
}: OffersMapProps) {
  const mapRef = useRef<MapView>(null);

  // Auto-fit to markers when offers change
  useEffect(() => {
    if (!mapRef.current || offers.length === 0) return;
    const coords = offers.map((o) => ({
      latitude: o.location.lat,
      longitude: o.location.lng,
    }));
    if (offers.length === 1) {
      mapRef.current.animateToRegion({
        latitude: coords[0].latitude,
        longitude: coords[0].longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
    } else {
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 48, right: 48, bottom: 48, left: 48 },
        animated: true,
      });
    }
  }, [offers]);

  // Pan to active marker when selection changes
  useEffect(() => {
    if (!activeOfferId || !mapRef.current) return;
    const offer = offers.find((o) => o.id === activeOfferId);
    if (!offer) return;
    mapRef.current.animateToRegion({
      latitude: offer.location.lat,
      longitude: offer.location.lng,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    }, 300);
  }, [activeOfferId, offers]);

  return (
    <View style={{ height, borderRadius: 16, overflow: 'hidden' }}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={TASHKENT_REGION}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {offers.map((offer) => {
          const isActive = offer.id === activeOfferId;
          return (
            <Marker
              key={offer.id}
              coordinate={{
                latitude: offer.location.lat,
                longitude: offer.location.lng,
              }}
              onPress={() => onMarkerPress(offer.id)}
              pinColor={isActive ? '#0f766e' : '#16C79A'}
            >
              {/* Custom circular marker */}
              <View
                style={[
                  styles.marker,
                  isActive && styles.markerActive,
                ]}
              />
              <Callout onPress={() => onCalloutPress(offer.id)}>
                <View style={styles.callout}>
                  <Text style={styles.calloutTitle}>{offer.title}</Text>
                  <Text style={styles.calloutSub}>{offer.restaurant}</Text>
                  <Text style={styles.calloutMeta}>
                    {formatCalloutMeta(offer)}
                  </Text>
                </View>
              </Callout>
            </Marker>
          );
        })}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  marker: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#16C79A',
    borderWidth: 2,
    borderColor: '#fff',
  },
  markerActive: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#0f766e',
  },
  callout: {
    width: 200,
    padding: 8,
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  calloutSub: {
    fontSize: 12,
    color: '#71717A',
    marginTop: 2,
  },
  calloutMeta: {
    fontSize: 12,
    color: '#16C79A',
    fontWeight: '600',
    marginTop: 4,
  },
});

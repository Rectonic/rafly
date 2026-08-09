import MapView, { Callout, Marker } from "react-native-maps";
import { StyleSheet, Text, View } from "react-native";

import { useT } from "@/i18n";
import type { GeoPoint } from "@/lib/geo";
import { getOfferMapRegion } from "@/lib/map-region";
import type { Offer } from "@/types/offer";

type OffersMapProps = {
  activeOfferId: string | null;
  offers: Offer[];
  onOpenOffer?: (offerId: string) => void;
  onSelectOffer: (offerId: string) => void;
  userLocation?: GeoPoint | null;
};

const MAP_PADDING = {
  bottom: 24,
  left: 24,
  right: 24,
  top: 24,
};

export function OffersMap({
  activeOfferId,
  offers,
  onOpenOffer,
  onSelectOffer,
  userLocation = null,
}: OffersMapProps) {
  const t = useT();
  const initialRegion = getOfferMapRegion(offers, userLocation);

  return (
    <View style={styles.mapFrame} testID="offers-map-frame">
      <MapView
        initialRegion={initialRegion}
        key={`${initialRegion.latitude}:${initialRegion.longitude}:${initialRegion.latitudeDelta}:${initialRegion.longitudeDelta}:${userLocation?.lat ?? "none"}:${userLocation?.lng ?? "none"}`}
        mapPadding={MAP_PADDING}
        style={StyleSheet.absoluteFillObject}
      >
        {userLocation ? (
          <Marker
            anchor={{ x: 0.5, y: 0.5 }}
            coordinate={{
              latitude: userLocation.lat,
              longitude: userLocation.lng,
            }}
            testID="map-user-location"
          >
            <View style={styles.userMarker}>
              <View style={styles.userMarkerDot} />
            </View>
          </Marker>
        ) : null}
        {offers.map((offer) => {
          const isActive = offer.id === activeOfferId;

          return (
            <Marker
              anchor={{ x: 0.5, y: 0.5 }}
              centerOffset={{ x: 0, y: 0 }}
              coordinate={{
                latitude: offer.location.lat,
                longitude: offer.location.lng,
              }}
              key={offer.id}
              onPress={() => onSelectOffer(offer.id)}
              testID={`map-marker-${offer.id}`}
            >
              <View style={styles.markerFrame}>
                <View
                  style={[
                    styles.marker,
                    isActive ? styles.markerActive : null,
                  ]}
                >
                  <Text style={styles.markerText}>
                    {Math.round(offer.discount)}
                  </Text>
                </View>
              </View>
              <Callout
                onPress={() => onOpenOffer?.(offer.id)}
                testID={`map-callout-${offer.id}`}
              >
                <View style={styles.callout}>
                  <Text style={styles.calloutTitle}>{offer.title}</Text>
                  <Text style={styles.calloutMeta}>{offer.restaurant}</Text>
                  <Text style={styles.calloutMeta}>
                    {t.offer.mapCallout(offer.discount, offer.endTime)}
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
  callout: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    width: 220,
  },
  calloutMeta: {
    color: "#4B5563",
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  calloutTitle: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 18,
  },
  mapFrame: {
    backgroundColor: "#E5E7EB",
    borderRadius: 18,
    height: 220,
    marginTop: 16,
    overflow: "hidden",
    width: "100%",
  },
  marker: {
    alignItems: "center",
    backgroundColor: "#16C79A",
    borderColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 2,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  markerActive: {
    backgroundColor: "#0F766E",
    height: 44,
    width: 44,
  },
  markerFrame: {
    alignItems: "center",
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  markerText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  userMarker: {
    alignItems: "center",
    backgroundColor: "rgba(37, 99, 235, 0.18)",
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  userMarkerDot: {
    backgroundColor: "#2563EB",
    borderColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 2,
    height: 16,
    width: 16,
  },
});

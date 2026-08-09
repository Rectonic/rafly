import type { Offer } from "@/types/offer";
import type { GeoPoint } from "@/lib/geo";

export type OfferMapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

const DEFAULT_REGION: OfferMapRegion = {
  latitude: 41.3111,
  longitude: 69.2797,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

const MIN_DELTA = 0.04;

function roundCoordinate(value: number) {
  return Math.round(value * 1000000) / 1000000;
}

function roundDelta(value: number) {
  return Math.round(value * 100) / 100;
}

export function getOfferMapRegion(
  offers: Offer[],
  focusPoint?: GeoPoint | null
): OfferMapRegion {
  const points: GeoPoint[] = [
    ...offers.map((offer) => ({
      lat: offer.location.lat,
      lng: offer.location.lng,
    })),
    ...(focusPoint ? [focusPoint] : []),
  ];

  if (!points.length) {
    return DEFAULT_REGION;
  }

  const latitudes = points.map((point) => point.lat);
  const longitudes = points.map((point) => point.lng);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);

  return {
    latitude: roundCoordinate((minLat + maxLat) / 2),
    latitudeDelta: roundDelta(Math.max((maxLat - minLat) * 1.4, MIN_DELTA)),
    longitude: roundCoordinate((minLng + maxLng) / 2),
    longitudeDelta: roundDelta(Math.max((maxLng - minLng) * 1.2, MIN_DELTA)),
  };
}

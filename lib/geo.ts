import type { Offer } from "@/types/offer";

export type GeoPoint = {
  lat: number;
  lng: number;
};

const EARTH_RADIUS_KM = 6371;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function distanceBetweenKm(from: GeoPoint, to: GeoPoint) {
  const latDelta = toRadians(to.lat - from.lat);
  const lngDelta = toRadians(to.lng - from.lng);
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);

  const haversine =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(lngDelta / 2) ** 2;

  return (
    2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

export function parseDistanceKm(distance: string) {
  const parsed = Number.parseFloat(distance.replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

export function getOfferDistanceKm(offer: Offer, userLocation?: GeoPoint | null) {
  if (userLocation) {
    return distanceBetweenKm(userLocation, {
      lat: offer.location.lat,
      lng: offer.location.lng,
    });
  }

  return parseDistanceKm(offer.distance);
}

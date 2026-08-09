import * as Location from "expo-location";

import type { GeoPoint } from "@/lib/geo";

export const LOCATION_PERMISSION_DENIED_CODE = "LOCATION_PERMISSION_DENIED";

export class LocationPermissionDeniedError extends Error {
  code = LOCATION_PERMISSION_DENIED_CODE;

  constructor() {
    super("Location permission was denied.");
    this.name = "LocationPermissionDeniedError";
  }
}

export async function getCurrentCoordinates(): Promise<GeoPoint> {
  const permission = await Location.requestForegroundPermissionsAsync();

  if (!permission.granted) {
    throw new LocationPermissionDeniedError();
  }

  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  return {
    lat: location.coords.latitude,
    lng: location.coords.longitude,
  };
}

export function isLocationPermissionDeniedError(error: unknown) {
  return (
    error instanceof LocationPermissionDeniedError ||
    (error !== null &&
      typeof error === "object" &&
      "code" in error &&
      error.code === LOCATION_PERMISSION_DENIED_CODE)
  );
}

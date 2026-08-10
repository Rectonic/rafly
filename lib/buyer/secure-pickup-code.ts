import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

/**
 * Raw pickup code storage for buyer v2 reservations, namespaced separately
 * from the v1 helpers in lib/reservations-store.tsx so the two generations
 * of reservation ids can never collide. SecureStore is the source of truth,
 * the AsyncStorage fallback only exists for entitlement-less simulator
 * builds where SecureStore throws, mirroring the v1 pattern. Ordinary
 * reservation metadata elsewhere only ever stores the pickupCodeHint the
 * server returns, this module is the only place the raw code is written.
 */

const CODE_KEY_PREFIX = "lastbite-v2-pickup-code";
const CODE_FALLBACK_KEY_PREFIX = "lastbite-v2-pickup-code-fallback";

function sanitizeReservationId(reservationId: string): string {
  return reservationId.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function pickupCodeKeyV2(reservationId: string): string {
  return `${CODE_KEY_PREFIX}-${sanitizeReservationId(reservationId)}`;
}

export function pickupCodeFallbackKeyV2(reservationId: string): string {
  return `${CODE_FALLBACK_KEY_PREFIX}-${sanitizeReservationId(reservationId)}`;
}

export async function persistPickupCodeV2(
  reservationId: string,
  pickupCode: string
): Promise<void> {
  try {
    await SecureStore.setItemAsync(pickupCodeKeyV2(reservationId), pickupCode);
  } catch {
    await AsyncStorage.setItem(pickupCodeFallbackKeyV2(reservationId), pickupCode);
  }
}

export async function loadPickupCodeV2(reservationId: string): Promise<string | null> {
  try {
    const secureValue = await SecureStore.getItemAsync(pickupCodeKeyV2(reservationId));
    if (secureValue) {
      return secureValue;
    }
  } catch {
    // SecureStore can be unavailable in entitlement-less simulator builds.
  }

  return AsyncStorage.getItem(pickupCodeFallbackKeyV2(reservationId));
}

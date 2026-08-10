import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

/**
 * Raw pickup code storage for buyer v2 reservations, namespaced separately
 * from the v1 helpers in lib/reservations-store.tsx so the two generations
 * of reservation ids can never collide. SecureStore is the only source of
 * truth. Ordinary reservation metadata elsewhere only ever stores the
 * pickupCodeHint the server returns, this module is the only place the raw
 * code is written.
 *
 * The unencrypted AsyncStorage copy is not a general fallback. It exists
 * only for entitlement-less simulator and e2e builds, and only when
 * EXPO_PUBLIC_LASTBITE_ALLOW_INSECURE_CODE_STORE is set to "1", matching the
 * escape hatch convention the rest of the repo uses. Without that flag a
 * SecureStore failure fails closed: nothing is written anywhere and the
 * caller is told the write degraded, so the surface can keep showing the
 * code it already holds in memory for this session without promising a
 * recovery after restart that would never arrive.
 */

const CODE_KEY_PREFIX = "lastbite-v2-pickup-code";
const CODE_FALLBACK_KEY_PREFIX = "lastbite-v2-pickup-code-fallback";

/**
 * How a raw pickup code write ended.
 *
 * - secure: written to SecureStore, recoverable after a restart
 * - insecure-fallback: written unencrypted under the explicit escape hatch
 * - degraded: not stored at all, only the in-memory value for this session
 */
export type PickupCodeStorageOutcome = "secure" | "insecure-fallback" | "degraded";

function insecureStoreAllowed(): boolean {
  return process.env.EXPO_PUBLIC_LASTBITE_ALLOW_INSECURE_CODE_STORE === "1";
}

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
): Promise<PickupCodeStorageOutcome> {
  try {
    await SecureStore.setItemAsync(pickupCodeKeyV2(reservationId), pickupCode);
    return "secure";
  } catch {
    if (!insecureStoreAllowed()) {
      return "degraded";
    }
    try {
      await AsyncStorage.setItem(pickupCodeFallbackKeyV2(reservationId), pickupCode);
      return "insecure-fallback";
    } catch {
      return "degraded";
    }
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

  if (!insecureStoreAllowed()) {
    // A build without the escape hatch never wrote an unencrypted copy and
    // never reads one either, including a leftover from a build that had the
    // hatch on. No code is the honest answer here.
    return null;
  }

  return AsyncStorage.getItem(pickupCodeFallbackKeyV2(reservationId));
}

import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Persists the clientReservationId for a reservation attempt that has not
 * yet reached a terminal outcome, keyed by offer id. useReserveOfferV2 reads
 * this before minting a fresh id, so a buyer who fails a reserve attempt
 * (a network error, for example), then leaves the screen or the app
 * restarts, retries with the exact same id rather than a new one. Reusing
 * the id is what makes the retry idempotent at the server, a fresh id for
 * the same intended action could otherwise create a second reservation.
 * Cleared on confirmed success or an explicit abandon.
 */
const PENDING_RESERVATION_KEY_PREFIX = "lastbite-v2-pending-reservation";

function pendingReservationKey(offerId: string): string {
  return `${PENDING_RESERVATION_KEY_PREFIX}-${offerId.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
}

export async function loadPendingClientReservationId(
  offerId: string
): Promise<string | null> {
  return AsyncStorage.getItem(pendingReservationKey(offerId));
}

export async function savePendingClientReservationId(
  offerId: string,
  clientReservationId: string
): Promise<void> {
  await AsyncStorage.setItem(pendingReservationKey(offerId), clientReservationId);
}

export async function clearPendingClientReservationId(offerId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(pendingReservationKey(offerId));
  } catch {
    // Best effort. A failed clear only risks reusing the same
    // clientReservationId on a later action, which stays safe, the
    // server idempotency key replays the already terminal result
    // rather than double booking a new reservation.
  }
}

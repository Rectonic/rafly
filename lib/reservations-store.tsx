import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

import { useT } from "@/i18n";
import {
  cancelPickupReminder,
  schedulePickupReminder,
} from "@/lib/pickup-reminders";
import {
  buildBuyerReservation,
  getEffectiveReservationStatus,
  withEffectiveReservationStatus,
} from "@/lib/reservation-history";
import {
  buildPickupOrderInsertFromReservation,
  syncPickupOrder,
  syncPickupOrderStatus,
  type ReservationResult,
} from "@/lib/reservations";
import type { Offer } from "@/types/offer";
import type { BuyerReservation } from "@/types/reservation";

const STORAGE_KEY = "lastbite-buyer-reservations";
const CODE_KEY_PREFIX = "lastbite-reservation-code";
const CODE_FALLBACK_KEY_PREFIX = "lastbite-reservation-code-fallback";

type ReservationHistoryContextValue = {
  addReservation: (
    offer: Offer,
    reservation: ReservationResult
  ) => Promise<BuyerReservation>;
  cancelReservation: (reservationId: string) => Promise<void>;
  completeReservation: (reservationId: string) => Promise<void>;
  error: string | null;
  isLoading: boolean;
  refreshReservations: () => Promise<void>;
  reservations: BuyerReservation[];
  revealedCodes: Record<string, string>;
  revealPickupCode: (reservationId: string) => Promise<void>;
  retryReservationSync: (reservationId: string) => Promise<BuyerReservation | null>;
};

const ReservationHistoryContext =
  createContext<ReservationHistoryContextValue | null>(null);

export function reservationCodeKey(reservationId: string) {
  return `${CODE_KEY_PREFIX}-${reservationId.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
}

export function reservationCodeFallbackKey(reservationId: string) {
  return `${CODE_FALLBACK_KEY_PREFIX}-${reservationId.replace(
    /[^a-zA-Z0-9._-]/g,
    "_"
  )}`;
}

/**
 * The unencrypted AsyncStorage copy of a v1 pickup code is not a general
 * fallback. It exists only for entitlement-less simulator and e2e builds, and
 * only when EXPO_PUBLIC_LASTBITE_ALLOW_INSECURE_CODE_STORE is set to "1", the
 * same escape hatch lib/buyer/secure-pickup-code.ts uses for v2. Without the
 * flag a SecureStore failure fails closed, the code stays in memory for this
 * session and nothing is written in plaintext. A pickup code is what a
 * stranger needs to collect somebody else's bag.
 */
function insecureCodeStoreAllowed(): boolean {
  return process.env.EXPO_PUBLIC_LASTBITE_ALLOW_INSECURE_CODE_STORE === "1";
}

async function persistPickupCode(reservationId: string, pickupCode: string) {
  try {
    await SecureStore.setItemAsync(reservationCodeKey(reservationId), pickupCode);
  } catch {
    if (!insecureCodeStoreAllowed()) {
      return;
    }
    try {
      await AsyncStorage.setItem(
        reservationCodeFallbackKey(reservationId),
        pickupCode
      );
    } catch {
      // Nothing is stored. The reservation itself is unaffected, only the
      // recovery of its raw code after a restart.
    }
  }
}

async function loadPickupCode(reservationId: string) {
  try {
    const securePickupCode = await SecureStore.getItemAsync(
      reservationCodeKey(reservationId)
    );

    if (securePickupCode) {
      return securePickupCode;
    }
  } catch {
    // SecureStore can be unavailable in entitlement-less simulator builds.
  }

  if (!insecureCodeStoreAllowed()) {
    // A build without the escape hatch never wrote an unencrypted copy and
    // never reads one either, including a leftover from a build that had the
    // hatch on. No code is the honest answer here.
    return null;
  }

  return AsyncStorage.getItem(reservationCodeFallbackKey(reservationId));
}

function parseReservations(raw: string | null) {
  if (!raw) {
    return [];
  }

  const parsed = JSON.parse(raw) as BuyerReservation[];

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.filter(
    (reservation) =>
      typeof reservation?.id === "string" &&
      typeof reservation.offerId === "string" &&
      typeof reservation.offerTitle === "string"
  );
}

async function persistReservations(reservations: BuyerReservation[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(reservations));
}

export function ReservationHistoryProvider({ children }: PropsWithChildren) {
  const t = useT();
  const [reservations, setReservations] = useState<BuyerReservation[]>([]);
  const [revealedCodes, setRevealedCodes] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshReservations = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const parsed = parseReservations(await AsyncStorage.getItem(STORAGE_KEY));
      const refreshedReservations = await Promise.all(
        parsed.map(async (reservation) => {
          const nextReservation = withEffectiveReservationStatus(reservation);

          if (
            nextReservation.status === "expired" &&
            reservation.status === "active" &&
            reservation.reminderNotificationId
          ) {
            await cancelPickupReminder(reservation.reminderNotificationId);
            return {
              ...nextReservation,
              reminderNotificationId: undefined,
              reminderStatus: "cancelled" as const,
              updatedAt: new Date().toISOString(),
            };
          }

          return nextReservation;
        })
      );
      const sortedReservations = refreshedReservations.sort(
        (left, right) =>
          new Date(right.createdAt).getTime() -
          new Date(left.createdAt).getTime()
      );

      if (JSON.stringify(sortedReservations) !== JSON.stringify(parsed)) {
        await persistReservations(sortedReservations);
      }

      setReservations(sortedReservations);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load reservations."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshReservations();
  }, [refreshReservations]);

  const addReservation = useCallback(
    async (offer: Offer, reservationResult: ReservationResult) => {
      const now = new Date();
      const existingReservation = reservations.find(
        (reservation) =>
          reservation.offerId === offer.id &&
          getEffectiveReservationStatus(reservation, now) === "active"
      );

      if (existingReservation) {
        await persistPickupCode(
          existingReservation.id,
          reservationResult.reservationCode
        );
        setRevealedCodes((currentCodes) => ({
          ...currentCodes,
          [existingReservation.id]: reservationResult.reservationCode,
        }));
        return existingReservation;
      }

      const nextReservation = buildBuyerReservation({
        now,
        offer,
        pickupCode: reservationResult.reservationCode,
        pickupOrderId: reservationResult.pickupOrderId,
        pickupWindow: t.offer.pickupBy(offer.endTime),
        syncError: reservationResult.syncError,
        synced: reservationResult.synced,
      });

      await persistPickupCode(
        nextReservation.id,
        reservationResult.reservationCode
      );
      const reminderResult = await schedulePickupReminder(nextReservation, {
        body: t.buyerReservations.notificationBody(
          nextReservation.offerTitle,
          nextReservation.pickupWindow
        ),
        title: t.buyerReservations.notificationTitle,
      });
      const nextReservationWithReminder = {
        ...nextReservation,
        ...reminderResult,
      };
      const nextReservations = [nextReservationWithReminder, ...reservations];

      await persistReservations(nextReservations);
      setReservations(nextReservations);
      setRevealedCodes((currentCodes) => ({
        ...currentCodes,
        [nextReservationWithReminder.id]: reservationResult.reservationCode,
      }));
      setError(null);

      return nextReservationWithReminder;
    },
    [reservations, t.buyerReservations, t.offer]
  );

  const updateReservationStatus = useCallback(
    async (
      reservationId: string,
      status: BuyerReservation["status"]
    ) => {
      let sellerStatusSyncError: string | null = null;
      const nextReservations = await Promise.all(
        reservations.map(async (reservation) => {
          if (reservation.id !== reservationId) {
            return reservation;
          }

          if (reservation.reminderNotificationId) {
            await cancelPickupReminder(reservation.reminderNotificationId);
          }

          const shouldCancelSellerOrder =
            status === "cancelled" &&
            reservation.sellerId &&
            reservation.syncStatus === "synced";
          const pickupCode = shouldCancelSellerOrder
            ? await loadPickupCode(reservation.id)
            : null;
          const sellerStatusSyncResult = shouldCancelSellerOrder
            ? pickupCode
              ? await syncPickupOrderStatus({
                  pickupCode,
                  reservation,
                  status: "cancelled",
                })
              : {
                  syncError: "Pickup code is not available on this device.",
                  synced: false,
                }
            : null;

          if (sellerStatusSyncResult?.syncError) {
            sellerStatusSyncError = sellerStatusSyncResult.syncError;
          }

          return {
            ...reservation,
            reminderNotificationId: undefined,
            reminderStatus: reservation.reminderNotificationId
              ? ("cancelled" as const)
              : reservation.reminderStatus,
            syncError: sellerStatusSyncResult
              ? sellerStatusSyncResult.syncError
              : reservation.syncError,
            syncStatus: sellerStatusSyncResult
              ? sellerStatusSyncResult.synced
                ? ("synced" as const)
                : ("failed" as const)
              : reservation.syncStatus,
            status,
            updatedAt: new Date().toISOString(),
          };
        })
      );

      await persistReservations(nextReservations);
      setReservations(nextReservations);
      setError(sellerStatusSyncError);
    },
    [reservations]
  );

  const cancelReservation = useCallback(
    async (reservationId: string) =>
      updateReservationStatus(reservationId, "cancelled"),
    [updateReservationStatus]
  );

  const completeReservation = useCallback(
    async (reservationId: string) =>
      updateReservationStatus(reservationId, "completed"),
    [updateReservationStatus]
  );

  const revealPickupCode = useCallback(async (reservationId: string) => {
    setError(null);

    try {
      const pickupCode = await loadPickupCode(reservationId);

      if (!pickupCode) {
        setError("Pickup code is not available on this device.");
        return;
      }

      setRevealedCodes((currentCodes) => ({
        ...currentCodes,
        [reservationId]: pickupCode,
      }));
    } catch (revealError) {
      setError(
        revealError instanceof Error
          ? revealError.message
          : "Unable to reveal pickup code."
      );
    }
  }, []);

  const retryReservationSync = useCallback(
    async (reservationId: string) => {
      setError(null);

      const reservation = reservations.find(
        (candidate) => candidate.id === reservationId
      );

      if (!reservation) {
        setError("Reservation is no longer available on this device.");
        return null;
      }

      const pickupCode = await loadPickupCode(reservationId);

      if (!pickupCode) {
        setError("Pickup code is not available on this device.");
        return null;
      }

      const insert = buildPickupOrderInsertFromReservation({
        pickupCode,
        reservation,
      });

      if (!insert) {
        setError("This reservation cannot sync with a seller.");
        return reservation;
      }

      const syncingReservations = reservations.map((candidate) =>
        candidate.id === reservationId
          ? {
              ...candidate,
              syncError: undefined,
              syncStatus: "syncing" as const,
              updatedAt: new Date().toISOString(),
            }
          : candidate
      );
      await persistReservations(syncingReservations);
      setReservations(syncingReservations);

      const syncResult = await syncPickupOrder(insert);
      let updatedReservation: BuyerReservation | null = null;
      const nextReservations = syncingReservations.map((candidate) => {
        if (candidate.id !== reservationId) {
          return candidate;
        }

        updatedReservation = {
          ...candidate,
          syncError: syncResult.syncError,
          syncStatus: syncResult.synced ? "synced" : "failed",
          updatedAt: new Date().toISOString(),
        };

        return updatedReservation;
      });

      await persistReservations(nextReservations);
      setReservations(nextReservations);

      if (syncResult.syncError) {
        setError(syncResult.syncError);
      }

      return updatedReservation;
    },
    [reservations]
  );

  const value = useMemo(
    () => ({
      addReservation,
      cancelReservation,
      completeReservation,
      error,
      isLoading,
      refreshReservations,
      reservations,
      revealedCodes,
      revealPickupCode,
      retryReservationSync,
    }),
    [
      addReservation,
      cancelReservation,
      completeReservation,
      error,
      isLoading,
      refreshReservations,
      reservations,
      revealedCodes,
      revealPickupCode,
      retryReservationSync,
    ]
  );

  return (
    <ReservationHistoryContext.Provider value={value}>
      {children}
    </ReservationHistoryContext.Provider>
  );
}

function useReservationHistoryContext() {
  const value = useContext(ReservationHistoryContext);

  if (!value) {
    throw new Error("ReservationHistoryProvider is missing.");
  }

  return value;
}

export function useReservationHistory() {
  return useReservationHistoryContext();
}

export function useAddReservation() {
  return useReservationHistoryContext().addReservation;
}

export function useRetryReservationSync() {
  return useReservationHistoryContext().retryReservationSync;
}

export function useReservationForOffer(offerId?: string) {
  const { reservations } = useReservationHistoryContext();

  if (!offerId) {
    return null;
  }

  return (
    reservations.find(
      (reservation) =>
        reservation.offerId === offerId &&
        getEffectiveReservationStatus(reservation) === "active"
    ) ?? null
  );
}

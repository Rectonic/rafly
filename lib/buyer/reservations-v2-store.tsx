import { useCallback, useEffect, useRef, useState } from "react";

import type {
  BuyerReservationV2,
  CommandError,
  MarketplaceOfferV2,
  ReservationStatusV2,
  ReserveOfferV2Result,
  Result,
} from "@/lib/contracts";

import { generateOpaqueId } from "./id";
import { useIsPilotMode, useOptionalBuyerApi } from "./optional-context";
import {
  clearPendingClientReservationId,
  loadPendingClientReservationId,
  savePendingClientReservationId,
} from "./pending-reservation";
import { persistPickupCodeV2 } from "./secure-pickup-code";

/**
 * Server side codes that mean the offer the buyer is looking at no longer
 * matches what the backend holds. A caller that passes onOfferChanged gets
 * a chance to refetch authoritative data and show a clear message instead
 * of leaving the buyer looking at a stale price, quantity, or status.
 */
const OFFER_CHANGED_ERROR_CODES: ReadonlySet<string> = new Set([
  "version_conflict",
  "sold_out",
  "offer_not_live",
]);

/**
 * Every reservation status except held is finished. A reservation in one of
 * these states can never become active again, so a pending
 * clientReservationId that replays into one of them is stale rather than
 * retryable.
 */
const TERMINAL_RESERVATION_STATUSES: ReadonlySet<ReservationStatusV2> = new Set([
  "fulfilled",
  "cancelled_by_buyer",
  "cancelled_by_seller",
  "expired_no_show",
  "failed_stock_mismatch",
]);

function isTerminalReservation(reservation: BuyerReservationV2): boolean {
  return TERMINAL_RESERVATION_STATUSES.has(reservation.status);
}

export type ReserveActionStatus = "idle" | "in-flight" | "held" | "error";

export interface UseReserveOfferV2Options {
  onOfferChanged?: () => void;
}

export interface UseReserveOfferV2Result {
  isPilot: boolean;
  status: ReserveActionStatus;
  reservation: BuyerReservationV2 | null;
  pickupCode: string | null;
  error: CommandError | null;
  /**
   * True when the raw pickup code could not be stored securely, so the code
   * in this result lives only in memory for this session. The reservation
   * itself is real, only its recovery after a restart is unavailable.
   */
  storageDegraded: boolean;
  reserve: (offer: MarketplaceOfferV2) => Promise<Result<ReserveOfferV2Result> | null>;
  abandon: (offerId?: string) => void;
}

/**
 * One buyer initiated reservation action. A single tap generates one
 * clientReservationId, kept across retries of the same action until it
 * either succeeds (a later reservation is a new action and gets a new id)
 * or the caller explicitly abandons it. Duplicate taps while a request is
 * in flight are dropped rather than queued. On success the raw pickup code
 * goes straight to SecureStore and only the safe hint stays in the returned
 * reservation, on failure nothing is ever marked held, matching the rule
 * that a backend failure must never produce a fabricated local success.
 *
 * The pending clientReservationId also survives a remount. It is persisted
 * to AsyncStorage keyed by offer id the moment an attempt starts, so a
 * buyer whose reserve attempt fails and who then leaves the screen, or
 * whose app restarts, retries with the exact same id rather than minting a
 * fresh one, which is what keeps the retry idempotent at the server instead
 * of risking a second reservation for the same intended action.
 */
export function useReserveOfferV2(
  installationId: string | null,
  options: UseReserveOfferV2Options = {}
): UseReserveOfferV2Result {
  const api = useOptionalBuyerApi();
  const isPilot = useIsPilotMode();
  const { onOfferChanged } = options;

  const [status, setStatus] = useState<ReserveActionStatus>("idle");
  const [reservation, setReservation] = useState<BuyerReservationV2 | null>(null);
  const [pickupCode, setPickupCode] = useState<string | null>(null);
  const [error, setError] = useState<CommandError | null>(null);
  const [storageDegraded, setStorageDegraded] = useState(false);

  const clientReservationIdRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);

  const reserve = useCallback(
    async (offer: MarketplaceOfferV2): Promise<Result<ReserveOfferV2Result> | null> => {
      if (!api || !isPilot || !installationId || inFlightRef.current) {
        return null;
      }

      inFlightRef.current = true;
      try {
        if (!clientReservationIdRef.current) {
          const pending = await loadPendingClientReservationId(offer.id);
          if (pending) {
            clientReservationIdRef.current = pending;
          } else {
            clientReservationIdRef.current = generateOpaqueId("reserve");
            await savePendingClientReservationId(offer.id, clientReservationIdRef.current);
          }
        }
        setStatus("in-flight");
        setError(null);
        setStorageDegraded(false);

        const send = (clientReservationId: string) =>
          api.reserveOfferV2({
            offerId: offer.id,
            quantity: 1,
            clientReservationId,
            installationId,
            expectedOfferVersion: offer.version,
          });

        let result = await send(clientReservationIdRef.current);

        if (result.ok && isTerminalReservation(result.value.reservation)) {
          // The id we reused belongs to an action that already finished, its
          // cleanup simply never landed. Replaying it can only ever hand back
          // that finished reservation, so the id is discarded and the buyer's
          // actual intent, a new reservation, is sent once with a fresh id.
          const fresh = generateOpaqueId("reserve");
          clientReservationIdRef.current = fresh;
          await savePendingClientReservationId(offer.id, fresh);
          result = await send(fresh);
        }

        if (result.ok && !isTerminalReservation(result.value.reservation)) {
          const outcome = await persistPickupCodeV2(
            result.value.reservation.id,
            result.value.pickupCode
          );
          setReservation(result.value.reservation);
          setPickupCode(result.value.pickupCode);
          setStorageDegraded(outcome === "degraded");
          setStatus("held");
          setError(null);
          // The action succeeded, a future reserve call is a new action and
          // earns its own clientReservationId.
          clientReservationIdRef.current = null;
          await clearPendingClientReservationId(offer.id);
        } else if (result.ok) {
          // Still terminal after the one retry. Nothing is held, and no error
          // code is invented for a response the server called successful.
          setReservation(null);
          setPickupCode(null);
          setStatus("error");
          clientReservationIdRef.current = null;
          await clearPendingClientReservationId(offer.id);
        } else {
          setError(result.error);
          setStatus("error");
          // clientReservationIdRef and its AsyncStorage backed copy both stay
          // set here on purpose, a retry of this same action, even after a
          // remount, must reuse this id rather than mint a new one.
          if (OFFER_CHANGED_ERROR_CODES.has(result.error.code)) {
            onOfferChanged?.();
          }
        }

        return result;
      } finally {
        inFlightRef.current = false;
      }
    },
    [api, installationId, isPilot, onOfferChanged]
  );

  const abandon = useCallback((offerId?: string) => {
    clientReservationIdRef.current = null;
    inFlightRef.current = false;
    setStatus("idle");
    setReservation(null);
    setPickupCode(null);
    setError(null);
    setStorageDegraded(false);
    if (offerId) {
      void clearPendingClientReservationId(offerId);
    }
  }, []);

  return {
    abandon,
    error,
    isPilot,
    pickupCode,
    reservation,
    reserve,
    status,
    storageDegraded,
  };
}

export interface UseBuyerReservationsV2Result {
  reservations: BuyerReservationV2[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * All reservations the server has on file for this installation. This is
 * the only way to recover a held reservation and its pickupCodeHint after
 * a restart, the server never returns the raw code here, only the hint.
 */
export function useBuyerReservationsV2(
  installationId: string | null
): UseBuyerReservationsV2Result {
  const api = useOptionalBuyerApi();
  const isPilot = useIsPilotMode();

  const [reservations, setReservations] = useState<BuyerReservationV2[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSequenceRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!api || !isPilot || !installationId) {
      // Clearing counts as a new request, so a pilot list already in flight
      // cannot land afterwards and repopulate what this clear just emptied.
      requestSequenceRef.current += 1;
      setReservations([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    const requestId = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestId;
    setIsLoading(true);
    setError(null);

    const result = await api.getBuyerReservationsV2(installationId);

    if (requestId !== requestSequenceRef.current) {
      return;
    }

    if (result.ok) {
      setReservations(result.value);
      setError(null);
      // The server is the authority on what finished. Any offer whose
      // reservation here is already terminal has no attempt left to retry,
      // so its pending clientReservationId is dropped rather than left on
      // disk to replay a finished reservation on the buyer's next tap.
      for (const finished of result.value.filter(isTerminalReservation)) {
        void clearPendingClientReservationId(finished.offerId);
      }
    } else {
      setReservations([]);
      setError(result.error.message);
    }
    setIsLoading(false);
  }, [api, installationId, isPilot]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { error, isLoading, refresh, reservations };
}

export type CancelActionStatus = "idle" | "in-flight" | "cancelled" | "error";

export interface UseCancelReservationV2Result {
  isPilot: boolean;
  cancel: (reservationId: string) => Promise<Result<BuyerReservationV2> | null>;
  statusFor: (reservationId: string) => CancelActionStatus;
  errorFor: (reservationId: string) => CommandError | null;
}

/**
 * Buyer cancellation, keyed per reservation id so one hook instance can
 * safely back a reservations list where several reservations might be
 * cancellable independently, as well as the single reservation an offer
 * detail screen shows. Cancelling is idempotent at the server, one
 * idempotencyKey per reservation is generated on the first attempt and
 * reused across retries until it succeeds, a duplicate tap on the same
 * reservation while a cancel is already in flight is dropped. Cancelling an
 * already terminal reservation is rejected by the server with invalid_state
 * rather than silently replaying a fabricated success, that rejection is
 * itself the safe behavior, repeating the action never corrupts state.
 */
export function useCancelReservationV2(
  installationId: string | null
): UseCancelReservationV2Result {
  const api = useOptionalBuyerApi();
  const isPilot = useIsPilotMode();

  const idempotencyKeysRef = useRef(new Map<string, string>());
  const inFlightRef = useRef(new Set<string>());
  const [statusMap, setStatusMap] = useState<Record<string, CancelActionStatus>>({});
  const [errorMap, setErrorMap] = useState<Record<string, CommandError | null>>({});

  const cancel = useCallback(
    async (reservationId: string): Promise<Result<BuyerReservationV2> | null> => {
      if (!api || !isPilot || !installationId || inFlightRef.current.has(reservationId)) {
        return null;
      }

      inFlightRef.current.add(reservationId);
      let idempotencyKey = idempotencyKeysRef.current.get(reservationId);
      if (!idempotencyKey) {
        idempotencyKey = generateOpaqueId("cancel");
        idempotencyKeysRef.current.set(reservationId, idempotencyKey);
      }
      setStatusMap((current) => ({ ...current, [reservationId]: "in-flight" }));
      setErrorMap((current) => ({ ...current, [reservationId]: null }));

      const result = await api.cancelReservationV2({
        idempotencyKey,
        installationId,
        reservationId,
      });

      inFlightRef.current.delete(reservationId);

      if (result.ok) {
        setStatusMap((current) => ({ ...current, [reservationId]: "cancelled" }));
        // The idempotencyKey is kept rather than deleted. A reservation id
        // is never reused for a different reservation, so a repeat cancel
        // call against this same id, however it happens, replays the
        // stored successful result at the server instead of minting a
        // fresh key that would hit invalid_state against an already
        // terminal reservation, that replay is what makes cancellation
        // idempotent rather than merely once-safe.
      } else {
        setStatusMap((current) => ({ ...current, [reservationId]: "error" }));
        setErrorMap((current) => ({ ...current, [reservationId]: result.error }));
      }

      return result;
    },
    [api, installationId, isPilot]
  );

  const statusFor = useCallback(
    (reservationId: string) => statusMap[reservationId] ?? "idle",
    [statusMap]
  );
  const errorFor = useCallback(
    (reservationId: string) => errorMap[reservationId] ?? null,
    [errorMap]
  );

  return { cancel, errorFor, isPilot, statusFor };
}

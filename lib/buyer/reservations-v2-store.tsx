import { useCallback, useEffect, useRef, useState } from "react";

import type {
  BuyerReservationV2,
  CommandError,
  MarketplaceOfferV2,
  ReserveOfferV2Result,
  Result,
} from "@/lib/contracts";

import { generateOpaqueId } from "./id";
import { useIsPilotMode, useOptionalBuyerApi } from "./optional-context";
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
  reserve: (offer: MarketplaceOfferV2) => Promise<Result<ReserveOfferV2Result> | null>;
  abandon: () => void;
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

  const clientReservationIdRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);

  const reserve = useCallback(
    async (offer: MarketplaceOfferV2): Promise<Result<ReserveOfferV2Result> | null> => {
      if (!api || !isPilot || !installationId || inFlightRef.current) {
        return null;
      }

      inFlightRef.current = true;
      if (!clientReservationIdRef.current) {
        clientReservationIdRef.current = generateOpaqueId("reserve");
      }
      setStatus("in-flight");
      setError(null);

      const result = await api.reserveOfferV2({
        offerId: offer.id,
        quantity: 1,
        clientReservationId: clientReservationIdRef.current,
        installationId,
        expectedOfferVersion: offer.version,
      });

      inFlightRef.current = false;

      if (result.ok) {
        await persistPickupCodeV2(result.value.reservation.id, result.value.pickupCode);
        setReservation(result.value.reservation);
        setPickupCode(result.value.pickupCode);
        setStatus("held");
        setError(null);
        // The action succeeded, a future reserve call is a new action and
        // earns its own clientReservationId.
        clientReservationIdRef.current = null;
      } else {
        setError(result.error);
        setStatus("error");
        if (OFFER_CHANGED_ERROR_CODES.has(result.error.code)) {
          onOfferChanged?.();
        }
      }

      return result;
    },
    [api, installationId, isPilot, onOfferChanged]
  );

  const abandon = useCallback(() => {
    clientReservationIdRef.current = null;
    inFlightRef.current = false;
    setStatus("idle");
    setReservation(null);
    setPickupCode(null);
    setError(null);
  }, []);

  return { abandon, error, isPilot, pickupCode, reservation, reserve, status };
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

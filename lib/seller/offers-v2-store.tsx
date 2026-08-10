import { useCallback, useEffect, useRef, useState } from "react";

import type { CommandError, MarketplaceOfferV2, Result } from "@/lib/contracts";

import { generateOpaqueIdV2 } from "./id-v2";
import { useOptionalSellerApi } from "./optional-context";

export type StoreOffersFetchStatusV2 = "idle" | "loading" | "error" | "ready";

export interface StoreOffersV2State {
  status: StoreOffersFetchStatusV2;
  offers: MarketplaceOfferV2[];
  error: CommandError | null;
  refresh: () => Promise<void>;
}

/**
 * Every offer the store has ever published, in every status, newest first,
 * read only. This is the list a seller pauses from, without it a live
 * offer published from a since abandoned publish session has no way back
 * to a pause control, exactly the gap finding 7 named.
 */
export function useStoreOffersV2(storeId: string | null): StoreOffersV2State {
  const api = useOptionalSellerApi();

  const [offers, setOffers] = useState<MarketplaceOfferV2[]>([]);
  const [status, setStatus] = useState<StoreOffersFetchStatusV2>("idle");
  const [error, setError] = useState<CommandError | null>(null);
  const requestSequenceRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!api || !storeId) {
      setOffers([]);
      setError(null);
      setStatus("idle");
      return;
    }

    const requestId = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestId;
    setStatus("loading");
    setError(null);

    const result = await api.listStoreOffersV2(storeId);

    if (requestId !== requestSequenceRef.current) {
      return;
    }

    if (result.ok) {
      setOffers(result.value);
      setError(null);
      setStatus("ready");
    } else {
      setOffers([]);
      setError(result.error);
      setStatus("error");
    }
  }, [api, storeId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { error, offers, refresh, status };
}

export type PauseActionStatusV2 = "idle" | "in-flight" | "paused" | "error";

export interface UsePauseOfferActionV2Result {
  pause: (offer: MarketplaceOfferV2) => Promise<Result<MarketplaceOfferV2> | null>;
  statusFor: (offerId: string) => PauseActionStatusV2;
  errorFor: (offerId: string) => CommandError | null;
}

/**
 * Pause, keyed per offer so one hook instance can back a whole list where
 * several offers might be paused independently, mirroring the buyer
 * surface's useCancelReservationV2. Each offer's idempotencyKey is minted
 * once and kept for the life of this hook instance rather than cleared on
 * success, so a repeated pause call against the same offer, a genuine
 * retry or a duplicate tap, always replays the same stored result instead
 * of risking a stale expectedVersion on a second real attempt.
 */
export function usePauseOfferActionV2(storeId: string | null): UsePauseOfferActionV2Result {
  const api = useOptionalSellerApi();

  const idempotencyKeysRef = useRef(new Map<string, string>());
  const inFlightRef = useRef(new Set<string>());
  const [statusMap, setStatusMap] = useState<Record<string, PauseActionStatusV2>>({});
  const [errorMap, setErrorMap] = useState<Record<string, CommandError | null>>({});

  const pause = useCallback(
    async (offer: MarketplaceOfferV2) => {
      if (!api || !storeId || inFlightRef.current.has(offer.id)) {
        return null;
      }

      inFlightRef.current.add(offer.id);
      let idempotencyKey = idempotencyKeysRef.current.get(offer.id);
      if (!idempotencyKey) {
        idempotencyKey = generateOpaqueIdV2("pause");
        idempotencyKeysRef.current.set(offer.id, idempotencyKey);
      }
      setStatusMap((current) => ({ ...current, [offer.id]: "in-flight" }));
      setErrorMap((current) => ({ ...current, [offer.id]: null }));

      const result = await api.pauseOfferV2({
        expectedVersion: offer.version,
        idempotencyKey,
        offerId: offer.id,
        storeId,
      });

      inFlightRef.current.delete(offer.id);

      if (result.ok) {
        setStatusMap((current) => ({ ...current, [offer.id]: "paused" }));
        setErrorMap((current) => ({ ...current, [offer.id]: null }));
      } else {
        setStatusMap((current) => ({ ...current, [offer.id]: "error" }));
        setErrorMap((current) => ({ ...current, [offer.id]: result.error }));
      }

      return result;
    },
    [api, storeId]
  );

  const statusFor = useCallback(
    (offerId: string) => statusMap[offerId] ?? "idle",
    [statusMap]
  );
  const errorFor = useCallback(
    (offerId: string) => errorMap[offerId] ?? null,
    [errorMap]
  );

  return { errorFor, pause, statusFor };
}

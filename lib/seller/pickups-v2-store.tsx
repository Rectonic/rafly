import { useCallback, useEffect, useRef, useState } from "react";

import type { CommandError, Result, SellerPickupV2 } from "@/lib/contracts";

import { generateOpaqueIdV2 } from "./id-v2";
import { useOptionalSellerApi } from "./optional-context";

export type PickupQueueStatusV2 = "idle" | "loading" | "error" | "ready";

export interface PickupQueueStateV2 {
  error: CommandError | null;
  pickups: SellerPickupV2[];
  refresh: () => Promise<void>;
  status: PickupQueueStatusV2;
}

export function useSellerPickupsV2(storeId: string | null): PickupQueueStateV2 {
  const api = useOptionalSellerApi();
  const [error, setError] = useState<CommandError | null>(null);
  const [pickups, setPickups] = useState<SellerPickupV2[]>([]);
  const [status, setStatus] = useState<PickupQueueStatusV2>("idle");
  const requestSequenceRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!api || !storeId) {
      setError(null);
      setPickups([]);
      setStatus("idle");
      return;
    }

    const requestId = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestId;
    setError(null);
    setStatus("loading");

    const result = await api.listSellerPickupsV2(storeId);
    if (requestId !== requestSequenceRef.current) return;

    if (result.ok) {
      setError(null);
      setPickups(result.value);
      setStatus("ready");
    } else {
      setError(result.error);
      setPickups([]);
      setStatus("error");
    }
  }, [api, storeId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { error, pickups, refresh, status };
}

export type FulfillmentStatusV2 = "idle" | "in-flight" | "fulfilled" | "error";

export interface FulfillPickupStateV2 {
  error: CommandError | null;
  fulfill: (pickupCode: string) => Promise<Result<SellerPickupV2> | null>;
  pickup: SellerPickupV2 | null;
  reset: () => void;
  status: FulfillmentStatusV2;
}

/**
 * The raw pickup code is accepted only as an action argument. It never enters
 * this hook's refs, a persisted store, a log, a queue projection, or a returned
 * UI model. The screen owns the sole in-memory field value and resets this
 * action key whenever that field changes.
 */
export function useFulfillPickupV2(storeId: string | null): FulfillPickupStateV2 {
  const api = useOptionalSellerApi();
  const [error, setError] = useState<CommandError | null>(null);
  const [pickup, setPickup] = useState<SellerPickupV2 | null>(null);
  const [status, setStatus] = useState<FulfillmentStatusV2>("idle");
  const actionKeyRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);

  const fulfill = useCallback(
    async (pickupCode: string) => {
      if (!api || !storeId || pickupCode.length === 0 || inFlightRef.current) {
        return null;
      }

      if (!actionKeyRef.current) {
        actionKeyRef.current = generateOpaqueIdV2("fulfill");
      }

      inFlightRef.current = true;
      setError(null);
      setPickup(null);
      setStatus("in-flight");

      const result = await api.fulfillReservationV2({
        idempotencyKey: actionKeyRef.current,
        pickupCode,
        storeId,
      });

      inFlightRef.current = false;
      if (result.ok) {
        setError(null);
        setPickup(result.value);
        setStatus("fulfilled");
      } else {
        setError(result.error);
        setPickup(null);
        setStatus("error");
      }

      return result;
    },
    [api, storeId]
  );

  const reset = useCallback(() => {
    if (inFlightRef.current) return;
    actionKeyRef.current = null;
    setError(null);
    setPickup(null);
    setStatus("idle");
  }, []);

  return { error, fulfill, pickup, reset, status };
}

import { useCallback, useRef, useState } from "react";

import type {
  CommandError,
  MarketplaceOfferV2,
  Result,
  StoreExceptionV2,
} from "@/lib/contracts";

import { generateOpaqueIdV2 } from "./id-v2";
import { useOptionalSellerApi } from "./optional-context";

export interface StockMismatchActionV2 {
  observedQuantity: number;
  offerId: string;
  reason: string;
}

export interface StockMismatchConfirmationV2 {
  exception: StoreExceptionV2;
  offer: MarketplaceOfferV2;
}

export type StockMismatchStatusV2 = "idle" | "in-flight" | "confirmed" | "error";

export interface StockMismatchStateV2 {
  error: CommandError | null;
  report: (
    action: StockMismatchActionV2
  ) => Promise<Result<StockMismatchConfirmationV2> | null>;
  result: StockMismatchConfirmationV2 | null;
  reset: () => void;
  status: StockMismatchStatusV2;
}

/**
 * Reports one mismatch action at a time. The UI remains unchanged until the
 * facade returns an authoritative paused offer and exception. The action
 * fingerprint keeps one key across a retry of identical facts and rotates it
 * when the seller changes the offer, observed quantity, or reason.
 */
export function useReportStockMismatchV2(
  storeId: string | null
): StockMismatchStateV2 {
  const api = useOptionalSellerApi();
  const [error, setError] = useState<CommandError | null>(null);
  const [result, setResult] = useState<StockMismatchConfirmationV2 | null>(null);
  const [status, setStatus] = useState<StockMismatchStatusV2>("idle");
  const fingerprintRef = useRef<string | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);

  const report = useCallback(
    async (action: StockMismatchActionV2) => {
      if (!api || !storeId || inFlightRef.current) return null;

      const fingerprint = JSON.stringify(action);
      if (fingerprintRef.current !== fingerprint || !idempotencyKeyRef.current) {
        fingerprintRef.current = fingerprint;
        idempotencyKeyRef.current = generateOpaqueIdV2("stock-mismatch");
      }

      inFlightRef.current = true;
      setError(null);
      setResult(null);
      setStatus("in-flight");

      const response = await api.reportStockMismatchV2({
        ...action,
        idempotencyKey: idempotencyKeyRef.current,
        storeId,
      });

      inFlightRef.current = false;
      if (response.ok) {
        setError(null);
        setResult(response.value);
        setStatus("confirmed");
      } else {
        setError(response.error);
        setResult(null);
        setStatus("error");
      }

      return response;
    },
    [api, storeId]
  );

  const reset = useCallback(() => {
    if (inFlightRef.current) return;
    fingerprintRef.current = null;
    idempotencyKeyRef.current = null;
    setError(null);
    setResult(null);
    setStatus("idle");
  }, []);

  return { error, report, reset, result, status };
}

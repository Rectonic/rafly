import { useCallback, useEffect, useRef, useState } from "react";

import type { CommandError, ExpiryWatchItemV2 } from "@/lib/contracts";

import { useOptionalSellerApi } from "./optional-context";

export type ExpiryWatchlistFetchStatusV2 =
  | "idle"
  | "loading"
  | "error"
  | "ready";

export interface ExpiryWatchlistStateV2 {
  status: ExpiryWatchlistFetchStatusV2;
  items: ExpiryWatchItemV2[];
  error: CommandError | null;
  refresh: () => Promise<void>;
}

export function useExpiryWatchlistV2(
  storeId: string | null
): ExpiryWatchlistStateV2 {
  const api = useOptionalSellerApi();
  const [items, setItems] = useState<ExpiryWatchItemV2[]>([]);
  const [status, setStatus] = useState<ExpiryWatchlistFetchStatusV2>("idle");
  const [error, setError] = useState<CommandError | null>(null);
  const requestSequenceRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestId;

    if (!api || !storeId) {
      setItems([]);
      setError(null);
      setStatus("idle");
      return;
    }

    setStatus("loading");
    setError(null);

    const result = await api.listExpiryWatchlistV2(storeId);
    if (requestId !== requestSequenceRef.current) {
      return;
    }

    if (result.ok) {
      setItems(result.value);
      setError(null);
      setStatus("ready");
    } else {
      setItems([]);
      setError(result.error);
      setStatus("error");
    }
  }, [api, storeId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { error, items, refresh, status };
}

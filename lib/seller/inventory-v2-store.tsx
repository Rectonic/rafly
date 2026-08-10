import { useCallback, useEffect, useRef, useState } from "react";

import type { CommandError, InventorySummaryV2 } from "@/lib/contracts";

import { useOptionalSellerApi } from "./optional-context";

export type StoreInventoryFetchStatusV2 = "idle" | "loading" | "error" | "ready";

export interface StoreInventoryV2State {
  status: StoreInventoryFetchStatusV2;
  items: InventorySummaryV2[];
  error: CommandError | null;
  refresh: () => Promise<void>;
}

/**
 * Read only projection of listStoreInventoryV2. No write path exists here
 * on purpose, quantity has no direct edit control anywhere in the Shop
 * Seller beta, the only way onHandQuantity changes is an approved stock
 * adjustment from a count session.
 */
export function useStoreInventoryV2(storeId: string | null): StoreInventoryV2State {
  const api = useOptionalSellerApi();

  const [items, setItems] = useState<InventorySummaryV2[]>([]);
  const [status, setStatus] = useState<StoreInventoryFetchStatusV2>("idle");
  const [error, setError] = useState<CommandError | null>(null);
  const requestSequenceRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!api || !storeId) {
      setItems([]);
      setError(null);
      setStatus("idle");
      return;
    }

    const requestId = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestId;
    setStatus("loading");
    setError(null);

    const result = await api.listStoreInventoryV2(storeId);

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

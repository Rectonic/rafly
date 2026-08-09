import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/lib/seller/auth-store";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { CreateInventoryItemInput } from "@/lib/seller/contracts";
import type { InventoryItem } from "@/types/seller";

type InventoryRow = {
  id: string;
  seller_id: string;
  product_name: string;
  barcode: string;
  expiry_date: string;
  quantity: number;
  source: "camera" | "image" | "manual";
  ocr_text: string | null;
  created_at: string;
};

function mapInventoryItem(row: InventoryRow): InventoryItem {
  return {
    id: row.id,
    sellerId: row.seller_id,
    productName: row.product_name,
    barcode: row.barcode,
    expiryDate: row.expiry_date,
    quantity: row.quantity,
    source: row.source,
    ocrText: row.ocr_text ?? undefined,
    createdAt: row.created_at,
  };
}

export function useInventory() {
  const { session } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    if (!isSupabaseConfigured() || !supabase || !session?.user) {
      setItems([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: loadError } = await supabase
        .from("inventory_items")
        .select("*")
        .eq("seller_id", session.user.id)
        .order("expiry_date", { ascending: true });

      if (loadError) {
        setError(loadError.message);
        return;
      }

      setItems((data ?? []).map((row) => mapInventoryItem(row as InventoryRow)));
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load inventory."
      );
    } finally {
      setIsLoading(false);
    }
  }, [session?.user]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const addItem = useCallback(
    async (input: CreateInventoryItemInput) => {
      if (!isSupabaseConfigured() || !supabase || !session?.user) {
        const missingConfigError = new Error("Supabase is not configured.");
        setError(missingConfigError.message);
        throw missingConfigError;
      }

      const { error: createError } = await supabase.from("inventory_items").insert({
        barcode: input.barcode,
        created_at: new Date().toISOString(),
        expiry_date: input.expiryDate,
        ocr_text: input.ocrText ?? null,
        product_name: input.productName,
        quantity: input.quantity,
        seller_id: session.user.id,
        source: input.source,
      });

      if (createError) {
        setError(createError.message);
        throw createError;
      }

      await loadItems();
    },
    [loadItems, session?.user]
  );

  const updateItem = useCallback(
    async (id: string, input: Partial<CreateInventoryItemInput>) => {
      if (!isSupabaseConfigured() || !supabase || !session?.user) {
        const missingConfigError = new Error("Supabase is not configured.");
        setError(missingConfigError.message);
        throw missingConfigError;
      }

      const updatePayload: Record<string, unknown> = {};

      if (input.productName !== undefined) {
        updatePayload.product_name = input.productName;
      }
      if (input.barcode !== undefined) {
        updatePayload.barcode = input.barcode;
      }
      if (input.expiryDate !== undefined) {
        updatePayload.expiry_date = input.expiryDate;
      }
      if (input.quantity !== undefined) {
        updatePayload.quantity = input.quantity;
      }
      if (input.source !== undefined) {
        updatePayload.source = input.source;
      }
      if (input.ocrText !== undefined) {
        updatePayload.ocr_text = input.ocrText;
      }

      const { error: updateError } = await supabase
        .from("inventory_items")
        .update(updatePayload)
        .eq("id", id)
        .eq("seller_id", session.user.id);

      if (updateError) {
        setError(updateError.message);
        throw updateError;
      }

      await loadItems();
    },
    [loadItems, session?.user]
  );

  const deleteItem = useCallback(
    async (id: string) => {
      if (!isSupabaseConfigured() || !supabase || !session?.user) {
        const missingConfigError = new Error("Supabase is not configured.");
        setError(missingConfigError.message);
        throw missingConfigError;
      }

      const { error: deleteError } = await supabase
        .from("inventory_items")
        .delete()
        .eq("id", id)
        .eq("seller_id", session.user.id);

      if (deleteError) {
        setError(deleteError.message);
        throw deleteError;
      }

      await loadItems();
    },
    [loadItems, session?.user]
  );

  return useMemo(
    () => ({
      addItem,
      deleteItem,
      error,
      isLoading,
      items,
      loadItems,
      updateItem,
    }),
    [addItem, deleteItem, error, isLoading, items, loadItems, updateItem]
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "@/lib/seller/auth-store";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { PickupOrder } from "@/types/seller";

type PickupOrderRow = {
  id: string;
  seller_id: string;
  offer_id: string | null;
  customer_name: string;
  reservation_code: string;
  pickup_window: string;
  total: number;
  status: PickupOrder["status"];
  created_at: string;
};

type OfferLookupRow = {
  id: string;
  title: string;
};

function mapPickupOrder(
  row: PickupOrderRow,
  offerTitlesById: Map<string, string>
): PickupOrder {
  return {
    id: row.id,
    sellerId: row.seller_id,
    offerId: row.offer_id,
    customerName: row.customer_name,
    offerTitle:
      (row.offer_id ? offerTitlesById.get(row.offer_id) : undefined) ??
      "Reserved package",
    reservationCode: row.reservation_code,
    pickupWindow: row.pickup_window,
    total: Number(row.total),
    status: row.status,
    createdAt: row.created_at,
  };
}

export function useOrders() {
  const { session } = useAuth();
  const [orders, setOrders] = useState<PickupOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [verifyingOrderId, setVerifyingOrderId] = useState<string | null>(null);
  const verifyingOrderIdRef = useRef<string | null>(null);

  const loadOrders = useCallback(async () => {
    if (!isSupabaseConfigured() || !supabase || !session?.user) {
      setOrders([]);
      setLastLoadedAt(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [{ data: ordersData, error: ordersError }, { data: offersData }] =
        await Promise.all([
          supabase
            .from("pickup_orders")
            .select("*")
            .eq("seller_id", session.user.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("seller_offers")
            .select("id,title")
            .eq("seller_id", session.user.id),
        ]);

      if (ordersError) {
        setError(ordersError.message);
        return;
      }

      const offerTitlesById = new Map<string, string>();

      (offersData ?? []).forEach((row) => {
        const offer = row as OfferLookupRow;
        offerTitlesById.set(offer.id, offer.title);
      });

      setOrders(
        (ordersData ?? []).map((row) =>
          mapPickupOrder(row as PickupOrderRow, offerTitlesById)
        )
      );
      setLastLoadedAt(new Date().toISOString());
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Unable to load orders."
      );
    } finally {
      setIsLoading(false);
    }
  }, [session?.user]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const verifyPickup = useCallback(
    async (orderId: string) => {
      if (!isSupabaseConfigured() || !supabase || !session?.user) {
        const missingConfigError = new Error("Supabase is not configured.");
        setError(missingConfigError.message);
        throw missingConfigError;
      }

      if (verifyingOrderIdRef.current) {
        return;
      }

      verifyingOrderIdRef.current = orderId;
      setVerifyingOrderId(orderId);

      try {
        const { data: updatedOrder, error: updateError } = await supabase
          .from("pickup_orders")
          .update({
            status: "collected",
          })
          .eq("id", orderId)
          .eq("seller_id", session.user.id)
          .eq("status", "pending")
          .select("id")
          .maybeSingle();

        if (updateError) {
          setError(updateError.message);
          throw updateError;
        }

        if (!updatedOrder) {
          const alreadyHandledError = new Error(
            "This pickup order is no longer pending."
          );
          setError(alreadyHandledError.message);
          throw alreadyHandledError;
        }

        await loadOrders();
      } finally {
        verifyingOrderIdRef.current = null;
        setVerifyingOrderId(null);
      }
    },
    [loadOrders, session?.user]
  );

  return useMemo(
    () => ({
      error,
      isLoading,
      lastLoadedAt,
      orders,
      refreshOrders: loadOrders,
      verifyingOrderId,
      verifyPickup,
    }),
    [
      error,
      isLoading,
      lastLoadedAt,
      loadOrders,
      orders,
      verifyingOrderId,
      verifyPickup,
    ]
  );
}

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Offer } from "@/types/offer";

export type PickupOrderInsert = {
  seller_id: string;
  offer_id: string;
  customer_name: string;
  reservation_code: string;
  pickup_window: string;
  total: number;
};

export type ReservationResult = {
  pickupOrderId?: string;
  quantityAvailable?: number;
  reservationCode: string;
  syncError?: string;
  synced: boolean;
};

export type PickupOrderStatusSyncInput = {
  pickupCode: string;
  reservation: {
    offerId: string;
    sellerId?: string;
  };
  status: "cancelled" | "collected";
};

const DEFAULT_CUSTOMER_NAME = "Mobile customer";
export const RESERVATION_SYNC_TIMEOUT_MS = 12_000;
const RESERVATION_SYNC_TIMEOUT_MESSAGE =
  "Reservation sync timed out. Try again from Reservations.";
const PICKUP_ORDER_STATUS_SYNC_FAILED_MESSAGE =
  "Seller pickup order is no longer pending.";

type ReservationSyncOptions = {
  syncTimeoutMs?: number;
};

type ReservationRpcRow = {
  pickup_order_id?: string;
  quantity_available?: number;
  status?: string;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}

function firstRpcRow(data: ReservationRpcRow[] | ReservationRpcRow | null) {
  return Array.isArray(data) ? data[0] : data;
}

function mapReservationRpcResult(
  data: ReservationRpcRow[] | ReservationRpcRow | null
): Omit<ReservationResult, "reservationCode"> {
  const row = firstRpcRow(data);

  return {
    pickupOrderId: row?.pickup_order_id,
    quantityAvailable:
      typeof row?.quantity_available === "number"
        ? row.quantity_available
        : undefined,
    synced: true,
  };
}

export function buildReservationCode(offerId: string, seed = Date.now()) {
  const offerSuffix = offerId
    .replace(/[^a-z0-9]/gi, "")
    .slice(-3)
    .toUpperCase()
    .padStart(3, "X");
  const numericSuffix = String(Math.abs(Math.floor(seed)) % 1_000_000).padStart(
    6,
    "0"
  );

  return `LB-${offerSuffix}-${numericSuffix}`;
}

export function buildReservationInsert(
  offer: Offer,
  reservationCode: string,
  customerName = DEFAULT_CUSTOMER_NAME,
  pickupWindow = `Pickup by ${offer.endTime}`
): PickupOrderInsert | null {
  if (offer.source !== "seller" || !offer.sellerId) {
    return null;
  }

  return {
    customer_name: customerName,
    offer_id: offer.id,
    pickup_window: pickupWindow,
    reservation_code: reservationCode,
    seller_id: offer.sellerId,
    total: offer.newPrice,
  };
}

export async function syncPickupOrder(
  insert: PickupOrderInsert,
  options: ReservationSyncOptions = {}
): Promise<Omit<ReservationResult, "reservationCode">> {
  if (!isSupabaseConfigured() || !supabase) {
    return {
      syncError:
        "Supabase is not configured. Seller-backed reservations cannot sync.",
      synced: false,
    };
  }

  try {
    const { data, error } = (await withTimeout(
      Promise.resolve(
        supabase.rpc("reserve_seller_offer", {
          p_customer_name: insert.customer_name,
          p_offer_id: insert.offer_id,
          p_pickup_window: insert.pickup_window,
          p_reservation_code: insert.reservation_code,
        })
      ),
      options.syncTimeoutMs ?? RESERVATION_SYNC_TIMEOUT_MS,
      RESERVATION_SYNC_TIMEOUT_MESSAGE
    )) as {
      data: ReservationRpcRow[] | ReservationRpcRow | null;
      error: { message: string } | null;
    };

    if (error) {
      return {
        syncError: error.message,
        synced: false,
      };
    }

    return mapReservationRpcResult(data);
  } catch (syncError) {
    return {
      syncError: getErrorMessage(syncError, "Unable to sync reservation."),
      synced: false,
    };
  }
}

export async function syncPickupOrderStatus(
  input: PickupOrderStatusSyncInput,
  options: ReservationSyncOptions = {}
): Promise<Omit<ReservationResult, "reservationCode">> {
  if (!input.reservation.sellerId) {
    return {
      syncError: "This reservation cannot sync with a seller.",
      synced: false,
    };
  }

  if (!isSupabaseConfigured() || !supabase) {
    return {
      syncError:
        "Supabase is not configured. Seller pickup order cannot update.",
      synced: false,
    };
  }

  try {
    if (input.status === "cancelled") {
      const { data, error } = (await withTimeout(
        Promise.resolve(
          supabase.rpc("cancel_seller_reservation", {
            p_offer_id: input.reservation.offerId,
            p_reservation_code: input.pickupCode,
          })
        ),
        options.syncTimeoutMs ?? RESERVATION_SYNC_TIMEOUT_MS,
        RESERVATION_SYNC_TIMEOUT_MESSAGE
      )) as {
        data: ReservationRpcRow[] | ReservationRpcRow | null;
        error: { message: string } | null;
      };

      if (error) {
        return {
          syncError: error.message,
          synced: false,
        };
      }

      return mapReservationRpcResult(data);
    }

    const { data, error } = (await withTimeout(
      Promise.resolve(
        supabase
          .from("pickup_orders")
          .update({
            status: input.status,
          })
          .eq("seller_id", input.reservation.sellerId)
          .eq("offer_id", input.reservation.offerId)
          .eq("reservation_code", input.pickupCode)
          .eq("status", "pending")
          .select("id")
          .maybeSingle()
      ),
      options.syncTimeoutMs ?? RESERVATION_SYNC_TIMEOUT_MS,
      RESERVATION_SYNC_TIMEOUT_MESSAGE
    )) as {
      data: { id: string } | null;
      error: { message: string } | null;
    };

    if (error) {
      return {
        syncError: error.message,
        synced: false,
      };
    }

    if (!data) {
      return {
        syncError: PICKUP_ORDER_STATUS_SYNC_FAILED_MESSAGE,
        synced: false,
      };
    }

    return {
      synced: true,
    };
  } catch (syncError) {
    return {
      syncError: getErrorMessage(syncError, "Unable to update pickup order."),
      synced: false,
    };
  }
}

export async function createPickupReservation(
  offer: Offer,
  pickupWindow = `Pickup by ${offer.endTime}`,
  options: ReservationSyncOptions = {}
): Promise<ReservationResult> {
  const reservationCode = buildReservationCode(offer.id);
  const insert = buildReservationInsert(
    offer,
    reservationCode,
    DEFAULT_CUSTOMER_NAME,
    pickupWindow
  );

  if (!insert) {
    return {
      reservationCode,
      synced: false,
    };
  }

  return {
    reservationCode,
    ...(await syncPickupOrder(insert, options)),
  };
}

export function buildPickupOrderInsertFromReservation({
  pickupCode,
  reservation,
}: {
  pickupCode: string;
  reservation: {
    id: string;
    offerId: string;
    pickupWindow: string;
    sellerId?: string;
    total: number;
  };
}): PickupOrderInsert | null {
  if (!reservation.sellerId) {
    return null;
  }

  return {
    customer_name: DEFAULT_CUSTOMER_NAME,
    offer_id: reservation.offerId,
    pickup_window: reservation.pickupWindow,
    reservation_code: pickupCode,
    seller_id: reservation.sellerId,
    total: reservation.total,
  };
}

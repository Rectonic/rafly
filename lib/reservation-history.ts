import type { Offer } from "@/types/offer";
import type {
  BuyerReservation,
  BuyerReservationStatus,
} from "@/types/reservation";

type BuildBuyerReservationInput = {
  now?: Date;
  offer: Offer;
  pickupCode: string;
  pickupOrderId?: string;
  pickupWindow?: string;
  syncError?: string;
  synced: boolean;
};

function buildPickupEndDate(endTime: string, now: Date) {
  const [hours, minutes] = endTime.split(":").map(Number);
  const expiresAt = new Date(now);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    expiresAt.setHours(expiresAt.getHours() + 2, 0, 0, 0);
    return expiresAt;
  }

  expiresAt.setHours(hours, minutes, 0, 0);

  return expiresAt;
}

export function buildBuyerReservation({
  now = new Date(),
  offer,
  pickupCode,
  pickupOrderId,
  pickupWindow,
  syncError,
  synced,
}: BuildBuyerReservationInput): BuyerReservation {
  return {
    codeHint: pickupCode.slice(-4),
    createdAt: now.toISOString(),
    expiresAt: buildPickupEndDate(offer.endTime, now).toISOString(),
    id: `${offer.id}-${now.getTime()}`,
    offerId: offer.id,
    pickupOrderId,
    offerTitle: offer.title,
    pickupWindow: pickupWindow ?? `Pickup by ${offer.endTime}`,
    restaurant: offer.restaurant,
    sellerId: offer.sellerId,
    status: "active",
    syncError,
    syncStatus: synced ? "synced" : syncError ? "failed" : "local",
    total: offer.newPrice,
  };
}

export function getEffectiveReservationStatus(
  reservation: BuyerReservation,
  now = new Date()
): BuyerReservationStatus {
  if (reservation.status !== "active") {
    return reservation.status;
  }

  return new Date(reservation.expiresAt).getTime() < now.getTime()
    ? "expired"
    : "active";
}

export function withEffectiveReservationStatus(
  reservation: BuyerReservation,
  now = new Date()
): BuyerReservation {
  return {
    ...reservation,
    status: getEffectiveReservationStatus(reservation, now),
  };
}

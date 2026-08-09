export type BuyerReservationStatus =
  | "active"
  | "completed"
  | "cancelled"
  | "expired";

export type BuyerReservationSyncStatus =
  | "local"
  | "synced"
  | "failed"
  | "syncing";

export type BuyerReservationReminderStatus =
  | "scheduled"
  | "permission-denied"
  | "skipped"
  | "failed"
  | "cancelled";

export interface BuyerReservation {
  id: string;
  offerId: string;
  pickupOrderId?: string;
  sellerId?: string;
  offerTitle: string;
  restaurant: string;
  pickupWindow: string;
  expiresAt: string;
  total: number;
  status: BuyerReservationStatus;
  syncError?: string;
  syncStatus: BuyerReservationSyncStatus;
  reminderError?: string;
  reminderNotificationId?: string;
  reminderScheduledFor?: string;
  reminderStatus?: BuyerReservationReminderStatus;
  codeHint: string;
  createdAt: string;
  updatedAt?: string;
}

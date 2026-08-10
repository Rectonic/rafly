import type { IsoDateTime, Result } from './common'

export type MarketplaceOfferStatusV2 = 'live' | 'paused' | 'sold_out' | 'expired' | 'withdrawn'

export type ReservationStatusV2 =
  | 'held'
  | 'fulfilled'
  | 'cancelled_by_buyer'
  | 'cancelled_by_seller'
  | 'expired_no_show'
  | 'failed_stock_mismatch'

export interface MarketplaceOfferV2 {
  id: string
  version: number
  storeId: string
  storeName: string
  storeAddress: string
  latitude: number
  longitude: number
  title: string
  category: string
  imageUrl: string | null
  contents: string[]
  offerPriceUzs: number
  referencePriceUzs: number | null
  discountPercent: number | null
  quantityAvailable: number
  pickupStart: IsoDateTime
  pickupEnd: IsoDateTime
  timezone: 'Asia/Tashkent'
  allergens: string[]
  dietaryBadges: string[]
  pickupInstructions: string | null
  cancellationPolicy: string | null
  lastVerifiedAt: IsoDateTime
  status: MarketplaceOfferStatusV2
}

export interface BuyerReservationV2 {
  id: string
  version: number
  offerId: string
  status: ReservationStatusV2
  quantity: 1
  offerSnapshot: MarketplaceOfferV2
  pickupCodeHint: string
  holdExpiresAt: IsoDateTime
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

export interface ReserveOfferV2Input {
  offerId: string
  quantity: 1
  clientReservationId: string
  installationId: string
  expectedOfferVersion: number
}

/**
 * A reserve response. The raw pickup code is issued exactly once, on the call
 * that actually created the reservation, and is never re-issued afterwards.
 *
 * A replay of an already used clientReservationId therefore carries
 * pickupCode null and a reservation projected from the CURRENT row, not a
 * frozen snapshot of how it looked when it was first created. A replay after
 * a cancellation reports cancelled_by_buyer, a replay after the hold expired
 * reports expired_no_show, and so on. Callers read pickupCode null as "this
 * was a replay, whatever you already stored for this reservation is still the
 * only copy of the raw code".
 */
export interface ReserveOfferV2Result {
  reservation: BuyerReservationV2
  pickupCode: string | null
}

export interface CancelReservationV2Input {
  reservationId: string
  installationId: string
  idempotencyKey: string
}

export type { Result }

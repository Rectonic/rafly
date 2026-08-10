import type { IsoDate, IsoDateTime, StoreRole } from './common'
import type { MarketplaceOfferV2, ReservationStatusV2 } from './marketplace'

export type StockConfidenceV2 = 'high' | 'medium' | 'low'

export interface InventorySummaryV2 {
  storeProductId: string
  storeId: string
  productName: string
  barcode: string | null
  category: string | null
  onHandQuantity: number
  confidence: StockConfidenceV2
  lastVerifiedAt: IsoDateTime | null
  maxOfferableQuantity: number
  allocatedQuantity: number
  expiryDate: IsoDate | null
  hasOpenExceptions: boolean
  version: number
}

export interface RecordInventoryCountV2Input {
  storeId: string
  countSessionId: string
  lines: Array<{ storeProductId: string, observedQuantity: number }>
}

export interface StockAdjustmentProposalV2 {
  id: string
  storeId: string
  storeProductId: string
  productName: string
  currentQuantity: number
  proposedQuantity: number
  delta: number
  reason: 'count'
  status: 'pending' | 'approved' | 'rejected' | 'applied'
  createdByRole: StoreRole
  createdAt: IsoDateTime
  version: number
}

export interface ApproveStockAdjustmentV2Input {
  storeId: string
  proposalId: string
  decision: 'approve' | 'reject'
  idempotencyKey: string
  expectedVersion: number
}

export interface PublishOfferV2Input {
  storeId: string
  idempotencyKey: string
  allocation: {
    storeProductId: string
    quantity: number
    physicallySetAside: boolean
  }
  title: string
  category: string
  imageUrl: string | null
  contents: string[]
  offerPriceUzs: number
  referencePriceUzs: number | null
  pickupStart: IsoDateTime
  pickupEnd: IsoDateTime
  allergens: string[]
  dietaryBadges: string[]
  pickupInstructions: string | null
  cancellationPolicy: string | null
}

export interface PauseOfferV2Input {
  storeId: string
  offerId: string
  idempotencyKey: string
  expectedVersion: number
}

export interface SellerPickupV2 {
  reservationId: string
  offerId: string
  offerTitle: string
  status: ReservationStatusV2
  pickupCodeHint: string
  holdExpiresAt: IsoDateTime
  pickupStart: IsoDateTime
  pickupEnd: IsoDateTime
  createdAt: IsoDateTime
  version: number
}

export interface FulfillReservationV2Input {
  storeId: string
  pickupCode: string
  idempotencyKey: string
}

export interface ReportStockMismatchV2Input {
  storeId: string
  offerId: string
  observedQuantity: number
  reason: string
  idempotencyKey: string
}

export interface StoreExceptionV2 {
  id: string
  storeId: string
  kind: 'stock_mismatch' | 'import_conflict' | 'expiry_risk' | 'closeout_missed'
  message: string
  status: 'open' | 'resolved'
  relatedOfferId: string | null
  relatedStoreProductId: string | null
  createdAt: IsoDateTime
}

export interface StoreMembershipV2 {
  storeId: string
  storeName: string
  role: StoreRole
  storeFlags: { pilotModeEnabled: boolean, shopSellerBetaEnabled: boolean }
}

export type { MarketplaceOfferV2 }

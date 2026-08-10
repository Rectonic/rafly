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

export interface ExpiryWatchItemV2 {
  storeProductId: string
  productName: string
  expiryDate: IsoDate
  daysToExpiry: number
  onHandQuantity: number
  confidence: StockConfidenceV2
  hasOpenExceptions: boolean
  activeOfferId: string | null
}

export interface OwnerDigestV2 {
  storeName: string
  generatedAt: IsoDateTime
  staleVerification: {
    productName: string
    onHand: number
    lastVerifiedAt: IsoDateTime | null
  }[]
  staleVerificationTotal: number
  expiryRisk: {
    productName: string
    expiryDate: IsoDate
    daysToExpiry: number
    onHand: number
  }[]
  expiryRiskTotal: number
  openExceptions: {
    kind: StoreExceptionV2['kind']
    message: string
    createdAt: IsoDateTime
  }[]
  openExceptionsTotal: number
  pausedOffers: {
    title: string
    pausedSinceVersionNote: null
  }[]
  pausedOffersTotal: number
  countActivity7d: {
    daysWithCountSession: number
    days: 7
  }
  offers7d: {
    published: number
    fulfilled: number
    cancelledBySeller: number
    expiredNoShow: number
    failedStockMismatch: number
  }
}

export interface RecordInventoryCountV2Input {
  storeId: string
  countSessionId: string
  lines: { storeProductId: string, observedQuantity: number }[]
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

export interface ResolveStoreExceptionV2Input {
  storeId: string;
  exceptionId: string;
  resolutionNote: string;
  idempotencyKey: string;
}

export interface ImportBatchV2 {
  id: string
  storeId: string
  filename: string
  status: 'uploaded' | 'needs_review' | 'completed'
  totalRecords: number
  pendingRecords: number
  createdAt: IsoDateTime
}

export interface StagedSourceRecordV2 {
  id: string
  batchId: string
  storeId: string
  rawName: string
  rawBarcode: string | null
  rawQuantity: number | null
  rawPrice: number | null
  matchStatus: 'auto_matched' | 'ambiguous' | 'unmatched' | 'approved' | 'rejected'
  matchedStoreProductId: string | null
  candidates: {
    storeProductId: string
    productName: string
    reason: string
  }[]
  createdAt: IsoDateTime
}

export interface UploadImportBatchV2Input {
  storeId: string
  filename: string
  records: {
    rawName: string
    rawBarcode?: string
    rawQuantity?: number
    rawPrice?: number
  }[]
  idempotencyKey: string
}

export interface DecideStagedRecordV2Input {
  storeId: string
  recordId: string
  decision: 'approve' | 'reject'
  targetStoreProductId: string | null
  idempotencyKey: string
}

export interface StoreExceptionV2 {
  id: string
  storeId: string
  kind: 'stock_mismatch' | 'import_conflict' | 'expiry_risk' | 'closeout_missed'
  message: string
  status: 'open' | 'resolved'
  resolutionNote: string | null;
  resolvedAt: IsoDateTime | null;
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

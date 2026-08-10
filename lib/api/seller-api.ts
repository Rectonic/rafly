import type { Result } from '@/lib/contracts/common'
import type { MarketplaceOfferV2 } from '@/lib/contracts/marketplace'
import type {
  ApproveStockAdjustmentV2Input,
  FulfillReservationV2Input,
  InventorySummaryV2,
  PauseOfferV2Input,
  PublishOfferV2Input,
  RecordInventoryCountV2Input,
  ReportStockMismatchV2Input,
  SellerPickupV2,
  StockAdjustmentProposalV2,
  StoreExceptionV2,
  StoreMembershipV2,
} from '@/lib/contracts/seller'

export interface SellerStoreApiV2 {
  getMyStoreMembershipsV2(): Promise<Result<StoreMembershipV2[]>>
  listStoreOffersV2(storeId: string): Promise<Result<MarketplaceOfferV2[]>>
  listStoreInventoryV2(storeId: string): Promise<Result<InventorySummaryV2[]>>
  recordInventoryCountV2(input: RecordInventoryCountV2Input): Promise<Result<StockAdjustmentProposalV2[]>>
  approveStockAdjustmentV2(input: ApproveStockAdjustmentV2Input): Promise<Result<StockAdjustmentProposalV2>>
  approveAndPublishOfferV2(input: PublishOfferV2Input): Promise<Result<MarketplaceOfferV2>>
  pauseOfferV2(input: PauseOfferV2Input): Promise<Result<MarketplaceOfferV2>>
  listSellerPickupsV2(storeId: string): Promise<Result<SellerPickupV2[]>>
  fulfillReservationV2(input: FulfillReservationV2Input): Promise<Result<SellerPickupV2>>
  reportStockMismatchV2(input: ReportStockMismatchV2Input): Promise<Result<{ offer: MarketplaceOfferV2, exception: StoreExceptionV2 }>>
  listStoreExceptionsV2(storeId: string): Promise<Result<StoreExceptionV2[]>>
}

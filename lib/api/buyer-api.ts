import type { Result } from '@/lib/contracts/common'
import type {
  BuyerReservationV2,
  CancelReservationV2Input,
  MarketplaceOfferV2,
  ReserveOfferV2Input,
  ReserveOfferV2Result,
} from '@/lib/contracts/marketplace'

export interface BuyerMarketplaceApiV2 {
  listMarketplaceOffersV2(): Promise<Result<MarketplaceOfferV2[]>>
  getMarketplaceOfferV2(offerId: string): Promise<Result<MarketplaceOfferV2>>
  reserveOfferV2(input: ReserveOfferV2Input): Promise<Result<ReserveOfferV2Result>>
  cancelReservationV2(input: CancelReservationV2Input): Promise<Result<BuyerReservationV2>>
  getBuyerReservationsV2(installationId: string): Promise<Result<BuyerReservationV2[]>>
}

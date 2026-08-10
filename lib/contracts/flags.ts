export type MarketplaceModeV2 = 'demo' | 'pilot'

export interface FeatureFlagsV2 {
  marketplaceMode: MarketplaceModeV2
}

export const FAIL_CLOSED_FLAGS: FeatureFlagsV2 = { marketplaceMode: 'demo' }

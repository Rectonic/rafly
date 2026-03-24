import type { Offer } from '@/types/offer';

export interface OffersMapProps {
  offers: Offer[];
  activeOfferId: string | null;
  onMarkerPress: (offerId: string) => void;
  onCalloutPress: (offerId: string) => void;
  formatCalloutMeta: (offer: Offer) => string;
  height?: number;
}

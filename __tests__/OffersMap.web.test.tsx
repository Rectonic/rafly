import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { OffersMap } from '@/components/OffersMap.web';
import type { Offer } from '@/types/offer';

const offers: Offer[] = [
  {
    id: 'offer-1',
    title: 'Pasta Box',
    restaurant: 'Green Fork',
    image: 'https://example.com/pasta.jpg',
    oldPrice: 12,
    newPrice: 6,
    discount: 50,
    distance: '0.4 km',
    endTime: '20:00',
    rating: 4.8,
    reviews: 120,
    category: 'Meals',
    location: {
      lat: 41.31,
      lng: 69.27,
      address: 'Tashkent',
    },
  },
];

describe('OffersMap.web', () => {
  it('renders a web-safe fallback without native maps', () => {
    const { getByText } = render(
      <OffersMap
        offers={offers}
        activeOfferId={null}
        onMarkerPress={jest.fn()}
        onCalloutPress={jest.fn()}
        formatCalloutMeta={(offer) => `${offer.distance} • collect by ${offer.endTime}`}
      />
    );

    expect(getByText('Map preview')).toBeTruthy();
    expect(getByText('Pasta Box')).toBeTruthy();
    expect(getByText('Green Fork')).toBeTruthy();
  });

  it('forwards presses through the fallback card', () => {
    const onMarkerPress = jest.fn();
    const onCalloutPress = jest.fn();
    const { getByText } = render(
      <OffersMap
        offers={offers}
        activeOfferId={null}
        onMarkerPress={onMarkerPress}
        onCalloutPress={onCalloutPress}
        formatCalloutMeta={(offer) => `${offer.distance} • collect by ${offer.endTime}`}
      />
    );

    fireEvent.press(getByText('Pasta Box'));

    expect(onMarkerPress).toHaveBeenCalledWith('offer-1');
    expect(onCalloutPress).toHaveBeenCalledWith('offer-1');
  });
});

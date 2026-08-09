import React from "react";
import { render } from "@testing-library/react-native";
import { View } from "react-native";

import { OffersMap } from "@/components/OffersMap";
import type { Offer } from "@/types/offer";

const mockMapView = jest.fn(
  ({ children }: { children: React.ReactNode }) => <View>{children}</View>
);
const mockMarker = ({ children }: { children: React.ReactNode }) => (
  <View>{children}</View>
);
const mockCallout = ({ children }: { children: React.ReactNode }) => (
  <View>{children}</View>
);

jest.mock("react-native-maps", () => ({
  __esModule: true,
  Callout: mockCallout,
  default: mockMapView,
  Marker: mockMarker,
}));

describe("OffersMap", () => {
  beforeEach(() => {
    mockMapView.mockClear();
  });

  it("uses an initial region without controlling user pan and zoom gestures", () => {
    const offers: Offer[] = [
      {
        category: "Meals",
        discount: 50,
        distance: "1 km",
        endTime: "20:00",
        id: "offer-1",
        image: "",
        location: {
          address: "Tashkent",
          lat: 41.31,
          lng: 69.27,
        },
        newPrice: 5,
        oldPrice: 10,
        quantityAvailable: 2,
        rating: 4.5,
        restaurant: "Cafe",
        reviews: 10,
        title: "Dinner pack",
      },
    ];

    render(
      <OffersMap
        activeOfferId={null}
        offers={offers}
        onSelectOffer={jest.fn()}
      />
    );

    expect(mockMapView).toHaveBeenCalledTimes(1);
    expect(mockMapView.mock.calls[0][0].initialRegion).toEqual({
      latitude: 41.31,
      latitudeDelta: 0.02,
      longitude: 69.27,
      longitudeDelta: 0.02,
    });
    expect(mockMapView.mock.calls[0][0].region).toBeUndefined();
  });
});

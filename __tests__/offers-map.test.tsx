/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render } from "@testing-library/react-native";

import type { Offer } from "@/types/offer";

let mockLocale: "en" | "ru" = "en";

jest.mock("react-native-maps", () => {
  const React = require("react");
  const { View } = require("react-native");
  const MapView = jest.fn(({ children }: { children: React.ReactNode }) =>
    React.createElement(View, null, children)
  );
  const Marker = ({
    children,
    onPress,
    testID,
  }: {
    children: React.ReactNode;
    onPress?: () => void;
    testID?: string;
  }) => React.createElement(View, { onPress, testID }, children);
  const Callout = ({
    children,
    onPress,
    testID,
  }: {
    children: React.ReactNode;
    onPress?: () => void;
    testID?: string;
  }) => React.createElement(View, { onPress, testID }, children);

  return {
    __esModule: true,
    __mockMapView: MapView,
    Callout,
    default: MapView,
    Marker,
  };
});

jest.mock("@/lib/locale-store", () => ({
  useLocale: () => mockLocale,
}));

const { OffersMap } = require("@/components/OffersMap");
const { __mockMapView: mockMapView } = require("react-native-maps");

const offer: Offer = {
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
};

describe("OffersMap", () => {
  beforeEach(() => {
    mockLocale = "en";
    mockMapView.mockClear();
  });

  it("uses an initial region without controlling user pan and zoom gestures", () => {
    render(
      <OffersMap
        activeOfferId={null}
        offers={[offer]}
        onSelectOffer={jest.fn()}
      />
    );

    expect(mockMapView).toHaveBeenCalledTimes(1);
    expect(mockMapView.mock.calls[0][0].initialRegion).toEqual({
      latitude: 41.31,
      latitudeDelta: 0.04,
      longitude: 69.27,
      longitudeDelta: 0.04,
    });
    expect(mockMapView.mock.calls[0][0].region).toBeUndefined();
  });

  it("keeps the native map layer aligned inside a stable rounded frame", () => {
    const screen = render(
      <OffersMap
        activeOfferId={null}
        offers={[offer]}
        onSelectOffer={jest.fn()}
      />
    );

    expect(screen.getByTestId("offers-map-frame")).toBeTruthy();
    expect(mockMapView.mock.calls[0][0].style).toEqual(
      expect.objectContaining({
        bottom: 0,
        left: 0,
        position: "absolute",
        right: 0,
        top: 0,
      })
    );
    expect(mockMapView.mock.calls[0][0].mapPadding).toEqual({
      bottom: 24,
      left: 24,
      right: 24,
      top: 24,
    });
  });

  it("selects the tapped location marker from a stable touch target", () => {
    const onSelectOffer = jest.fn();
    const screen = render(
      <OffersMap
        activeOfferId={null}
        offers={[offer]}
        onSelectOffer={onSelectOffer}
      />
    );

    fireEvent.press(screen.getByTestId("map-marker-offer-1"));

    expect(onSelectOffer).toHaveBeenCalledWith("offer-1");
  });

  it("localizes marker callout copy for the Russian locale", () => {
    mockLocale = "ru";

    const screen = render(
      <OffersMap
        activeOfferId={null}
        offers={[offer]}
        onSelectOffer={jest.fn()}
      />
    );

    expect(
      screen.getByTestId("map-callout-offer-1").props.children.props.style
    ).toEqual(expect.objectContaining({ width: 220 }));
    expect(screen.getByText("Скидка 50% · Забрать до 20:00")).toBeTruthy();
    expect(screen.queryByText("Save 50% · Collect by 20:00")).toBeNull();
  });

  it("opens an offer from its map callout without hijacking marker selection", () => {
    const onOpenOffer = jest.fn();
    const onSelectOffer = jest.fn();
    const screen = render(
      <OffersMap
        activeOfferId={null}
        offers={[offer]}
        onOpenOffer={onOpenOffer}
        onSelectOffer={onSelectOffer}
      />
    );

    fireEvent.press(screen.getByTestId("map-callout-offer-1"));

    expect(onOpenOffer).toHaveBeenCalledWith("offer-1");
    expect(onSelectOffer).not.toHaveBeenCalled();
  });

  it("renders the user location marker and frames the map around it", () => {
    const screen = render(
      <OffersMap
        activeOfferId={null}
        offers={[]}
        onSelectOffer={jest.fn()}
        userLocation={{ lat: 41.32, lng: 69.29 }}
      />
    );

    expect(screen.getByTestId("map-user-location")).toBeTruthy();
    expect(mockMapView.mock.calls[0][0].initialRegion).toEqual({
      latitude: 41.32,
      latitudeDelta: 0.04,
      longitude: 69.29,
      longitudeDelta: 0.04,
    });
  });
});

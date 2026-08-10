import { render } from "@testing-library/react-native";

import { OfferCard } from "@/components/OfferCard";
import { OffersMap } from "@/components/OffersMap";
import type { Offer } from "@/types/offer";

jest.mock("@/lib/locale-store", () => ({
  useLocale: () => "en",
}));

/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock("react-native-maps", () => {
  const React = require("react");
  const { View } = require("react-native");
  const MapView = ({ children }: { children: React.ReactNode }) =>
    React.createElement(View, null, children);
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
    Callout,
    default: MapView,
    Marker,
  };
});
/* eslint-enable @typescript-eslint/no-require-imports */

const baseOffer: Offer = {
  id: "offer-1",
  title: "Bakery rescue box",
  restaurant: "Chorsu Corner Market",
  image: "",
  oldPrice: 50000,
  newPrice: 20000,
  discount: 60,
  distance: "0.4 km",
  endTime: "20:00",
  rating: 0,
  reviews: 0,
  category: "Groceries",
  location: { address: "Tashkent", lat: 41.31, lng: 69.28 },
};

describe("OfferCard honesty and currency", () => {
  it("shows the struck old price for a real discount (v1 seed shape unchanged)", () => {
    const screen = render(
      <OfferCard
        isFavorite={false}
        offer={baseOffer}
        onPress={jest.fn()}
        onToggleFavorite={jest.fn()}
      />
    );

    expect(screen.getByText("$20000.00")).toBeTruthy();
    expect(screen.getByText("$50000.00")).toBeTruthy();
  });

  it("suppresses the struck old price when discount is zero and prices are equal", () => {
    const noDiscountOffer: Offer = { ...baseOffer, oldPrice: 20000, discount: 0 };

    const screen = render(
      <OfferCard
        isFavorite={false}
        offer={noDiscountOffer}
        onPress={jest.fn()}
        onToggleFavorite={jest.fn()}
      />
    );

    expect(screen.getByText("$20000.00")).toBeTruthy();
    expect(screen.queryByText("$50000.00")).toBeNull();
  });

  it("suppresses the struck old price when discount is positive but the prices do not actually differ", () => {
    const inconsistentOffer: Offer = { ...baseOffer, oldPrice: 20000, discount: 15 };

    const screen = render(
      <OfferCard
        isFavorite={false}
        offer={inconsistentOffer}
        onPress={jest.fn()}
        onToggleFavorite={jest.fn()}
      />
    );

    const priceMatches = screen.queryAllByText("$20000.00");
    expect(priceMatches).toHaveLength(1);
  });

  it("keeps the seed and v1 dollar formatting byte identical when no currency prop is passed", () => {
    const screen = render(
      <OfferCard
        isFavorite={false}
        offer={baseOffer}
        onPress={jest.fn()}
        onToggleFavorite={jest.fn()}
      />
    );

    expect(screen.queryByText(/UZS/)).toBeNull();
  });

  it('formats v2 sourced offers with UZS currency when currency="UZS" is passed', () => {
    const screen = render(
      <OfferCard
        currency="UZS"
        isFavorite={false}
        offer={baseOffer}
        onPress={jest.fn()}
        onToggleFavorite={jest.fn()}
      />
    );

    expect(screen.getByText("UZS 20,000")).toBeTruthy();
    expect(screen.getByText("UZS 50,000")).toBeTruthy();
    expect(screen.queryByText("$20000.00")).toBeNull();
  });
});

describe("OffersMap honesty", () => {
  it("shows the discount number on the marker and a discount claim in the callout for a real discount", () => {
    const screen = render(
      <OffersMap
        activeOfferId={null}
        offers={[baseOffer]}
        onSelectOffer={jest.fn()}
      />
    );

    expect(screen.getByText("60")).toBeTruthy();
    expect(screen.getByText("Save 60% · Collect by 20:00")).toBeTruthy();
  });

  it("suppresses the discount badge number and the discount claim in the callout when there is no discount", () => {
    const noDiscountOffers: Offer[] = [{ ...baseOffer, oldPrice: 20000, discount: 0 }];

    const screen = render(
      <OffersMap
        activeOfferId={null}
        offers={noDiscountOffers}
        onSelectOffer={jest.fn()}
      />
    );

    expect(screen.queryByText("0")).toBeNull();
    expect(screen.queryByText(/Save 0%/)).toBeNull();
    expect(screen.getByText("Collect by 20:00")).toBeTruthy();
  });
});

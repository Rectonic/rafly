/* eslint-disable @typescript-eslint/no-require-imports */
import { act, fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import FeedScreen from "@/app/(tabs)/index";

const mockPush = jest.fn();
const mockToggleFavorite = jest.fn();
const mockFeedScrollTo = jest.fn();
let mockFavorites: string[] = [];
let mockLocale: "en" | "ru" = "en";
let mockPublishedOffers: unknown[] = [];
let mockMarketplaceError: string | null = null;
let mockMarketplaceIsLoading = false;
let mockSearchQuery = "";
const mockGetCurrentCoordinates = jest.fn();
const mockRefreshPublishedOffers = jest.fn();
const mockUseSafeAreaInsets = jest.mocked(useSafeAreaInsets);

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: jest.fn(),
}));

jest.mock("@/i18n", () => ({
  useT: () => ({
    categories: {
      All: "All",
      "Baked Goods": "Baked Goods",
      Groceries: "Groceries",
      Meals: "Meals",
      "Surprise Bags": "Surprise Bags",
      Vegan: "Vegan",
    },
    home: {
      noOffersCategory: "No offers in this category yet",
      noOffersHint: "Try another filter or reset to view all available offers.",
      noOffersSearch: (query: string) => `No offers matching "${query}"`,
      marketplaceErrorHint:
        "Showing saved offers while the marketplace reconnects.",
      marketplaceErrorTitle: "Live marketplace unavailable",
      marketplaceLoading: "Syncing live marketplace...",
      retryMarketplace: "Retry marketplace",
      nearMe: {
        active: "Using your location",
        denied: "Location permission denied. Showing saved distances.",
        failed: "Unable to find your location. Showing saved distances.",
        idle: "Near Me",
        locating: "Locating...",
      },
      radius: {
        accessibilityLabel: (label: string) => `Show offers within ${label}`,
        all: "All distances",
        option: (km: number) => `${km} km`,
        title: "Radius",
      },
      offersShowing: (n: number) => `${n} offers showing`,
      sort: {
        discount: "Biggest Discount",
        distance: "Closest First",
        expiry: "Expiring Soon",
        price: "Lowest Price",
      },
      title: "Discover nearby surplus food offers",
    },
    offer: {
      addToFavorites: "Add to favorites",
      portionsLeft: (n: number) => `${n} portions left`,
      removeFromFavorites: "Remove from favorites",
    },
    nav: {
      search: "Search for restaurants, bakeries, or specific food...",
    },
  }),
}));

jest.mock("@/components/ScreenScrollView", () => {
  const ReactMock = require("react");
  const { ScrollView } = require("react-native");

  return {
    ScreenScrollView: ReactMock.forwardRef(
      (
        {
          children,
          ...props
        }: {
          children: React.ReactNode;
        },
        ref: React.Ref<{ scrollTo: typeof mockFeedScrollTo }>
      ) => {
        ReactMock.useImperativeHandle(ref, () => ({
          scrollTo: mockFeedScrollTo,
        }));
        return ReactMock.createElement(ScrollView, props, children);
      }
    ),
  };
});

jest.mock("@/components/OffersMap", () => {
  const ReactMock = require("react");
  const { Pressable, Text, View } = require("react-native");

  return {
    OffersMap: ({
      activeOfferId,
      offers,
      onOpenOffer,
      onSelectOffer,
      userLocation,
    }: {
      activeOfferId: string | null;
      offers: { id: string; title: string }[];
      onOpenOffer?: (offerId: string) => void;
      onSelectOffer: (offerId: string) => void;
      userLocation?: { lat: number; lng: number } | null;
    }) =>
      ReactMock.createElement(
        View,
        null,
        ReactMock.createElement(
          Text,
          { testID: "active-map-offer" },
          activeOfferId ?? "none"
        ),
        ReactMock.createElement(
          Text,
          { testID: "map-offers-count" },
          String(offers.length)
        ),
        ReactMock.createElement(
          Text,
          { testID: "map-user-location-prop" },
          userLocation ? `${userLocation.lat},${userLocation.lng}` : "none"
        ),
        offers.map((offer) =>
          ReactMock.createElement(
            Pressable,
            {
              key: `open-${offer.id}`,
              onPress: () => onOpenOffer?.(offer.id),
              testID: `map-open-${offer.id}`,
            },
            ReactMock.createElement(Text, null, `Open ${offer.title}`)
          )
        ),
        offers.map((offer) =>
          ReactMock.createElement(
            Pressable,
            {
              key: offer.id,
              onPress: () => onSelectOffer(offer.id),
              testID: `map-select-${offer.id}`,
            },
            ReactMock.createElement(Text, null, `Map ${offer.title}`)
          )
        )
      ),
  };
});

jest.mock(
  "@/lib/device-location",
  () => ({
    getCurrentCoordinates: () => mockGetCurrentCoordinates(),
    isLocationPermissionDeniedError: (error: unknown) =>
      Boolean(
        error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "LOCATION_PERMISSION_DENIED"
      ),
  }),
  { virtual: true }
);

jest.mock("@/lib/favorites-store", () => ({
  useFavorites: () => mockFavorites,
  useToggleFavorite: () => mockToggleFavorite,
}));

jest.mock("@/lib/marketplace-store", () => ({
  useMarketplaceState: () => ({
    error: mockMarketplaceError,
    isLoading: mockMarketplaceIsLoading,
    publishedOffers: mockPublishedOffers,
    refreshPublishedOffers: mockRefreshPublishedOffers,
  }),
}));

jest.mock("@/lib/locale-store", () => ({
  useLocale: () => mockLocale,
}));

jest.mock("@/lib/search-store", () => ({
  useSearchQuery: () => mockSearchQuery,
  useSetSearchQuery: () => (nextQuery: string) => {
    mockSearchQuery = nextQuery;
  },
}));

describe("FeedScreen", () => {
  beforeEach(() => {
    mockFavorites = [];
    mockLocale = "en";
    mockPublishedOffers = [];
    mockMarketplaceError = null;
    mockMarketplaceIsLoading = false;
    mockUseSafeAreaInsets.mockReturnValue({
      bottom: 34,
      left: 0,
      right: 0,
      top: 47,
    });
    mockGetCurrentCoordinates.mockReset();
    mockFeedScrollTo.mockClear();
    mockPush.mockClear();
    mockRefreshPublishedOffers.mockReset();
    mockSearchQuery = "";
    mockToggleFavorite.mockClear();
  });

  it("filters, favorites, selects from the map, and opens offer details", () => {
    const screen = render(<FeedScreen />);

    expect(screen.getByTestId("feed-screen")).toBeTruthy();
    expect(screen.getByTestId("feed-search-input")).toBeTruthy();
    expect(screen.getByTestId("category-filter-Meals")).toBeTruthy();
    expect(screen.getByTestId("sort-option-price")).toBeTruthy();
    expect(screen.getByTestId("offer-card-9")).toHaveProp(
      "accessibilityRole",
      "button"
    );
    expect(screen.getByTestId("favorite-toggle-9")).toBeTruthy();
    expect(screen.getByText("Morning Pastry Pack")).toBeTruthy();
    expect(screen.getByText("Sushi Mix Platter")).toBeTruthy();

    fireEvent.changeText(
      screen.getByPlaceholderText(
        "Search for restaurants, bakeries, or specific food..."
      ),
      "bread"
    );
    screen.rerender(<FeedScreen />);

    expect(screen.getByText("Artisan Bread Bundle")).toBeTruthy();
    expect(screen.queryByText("Morning Pastry Pack")).toBeNull();

    fireEvent.changeText(
      screen.getByPlaceholderText(
        "Search for restaurants, bakeries, or specific food..."
      ),
      ""
    );
    screen.rerender(<FeedScreen />);

    fireEvent.press(screen.getByText("Meals"));

    expect(screen.getByText("Sushi Mix Platter")).toBeTruthy();
    expect(screen.getByText("Family Pasta Tray")).toBeTruthy();
    expect(screen.queryByText("Artisan Bread Bundle")).toBeNull();

    fireEvent.press(screen.getByTestId("map-select-3"));
    expect(screen.getByTestId("active-map-offer")).toHaveTextContent("3");
    expect(screen.getByTestId("offer-card-3")).toHaveProp(
      "accessibilityState",
      { selected: true }
    );

    fireEvent.press(screen.getByTestId("map-open-3"));
    expect(mockPush).toHaveBeenCalledWith("/offer/3");

    fireEvent.press(screen.getAllByText("♡")[1]);
    expect(mockToggleFavorite).toHaveBeenCalledWith("3");

    fireEvent.press(screen.getByTestId("offer-card-3"));
    expect(mockPush).toHaveBeenCalledWith("/offer/3");
  });

  it("marks favorited offers in the feed", () => {
    mockFavorites = ["9"];

    const screen = render(<FeedScreen />);

    expect(screen.getByText("Morning Pastry Pack")).toBeTruthy();
    expect(screen.getByText("♥")).toBeTruthy();
  });

  it("localizes seller-published multilingual offers before rendering the feed", () => {
    mockLocale = "ru";
    mockPublishedOffers = [
      {
        category: "Meals",
        contents: ["Pasta tray"],
        discount: 60,
        distance: "0.0 km",
        endTime: "21:00",
        id: "seller-offer-1",
        image: "",
        location: {
          address: "Chilonzor District, Tashkent",
          lat: 41.31,
          lng: 69.28,
        },
        newPrice: 8,
        oldPrice: 20,
        quantityAvailable: 4,
        rating: 4.8,
        restaurant: "Roma Kitchen",
        reviews: 24,
        source: "seller",
        title: "Closing pasta bundle",
        translations: {
          ru: {
            locationAddress: "Чиланзарский район, Ташкент",
            restaurant: "Кухня Roma",
            title: "Вечерний набор пасты",
          },
        },
      },
    ];

    const screen = render(<FeedScreen />);

    expect(screen.getByText("Вечерний набор пасты")).toBeTruthy();
    expect(screen.getByText("Кухня Roma")).toBeTruthy();
    expect(screen.queryByText("Closing pasta bundle")).toBeNull();
  });

  it("keeps seed discovery visible while live marketplace loading or retry states are shown", () => {
    mockMarketplaceIsLoading = true;
    mockMarketplaceError = "Network unavailable";

    const screen = render(<FeedScreen />);

    expect(screen.getByTestId("feed-marketplace-loading-state")).toBeTruthy();
    expect(screen.getByTestId("feed-marketplace-error-state")).toBeTruthy();
    expect(screen.getByText("Morning Pastry Pack")).toBeTruthy();

    fireEvent.press(screen.getByText("Retry marketplace"));

    expect(mockRefreshPublishedOffers).toHaveBeenCalledTimes(1);
  });

  it("filters the feed and map by radius and clears stale map selection", () => {
    const screen = render(<FeedScreen />);

    expect(screen.getByTestId("radius-filter-1")).toBeTruthy();
    expect(screen.getByTestId("map-offers-count")).toHaveTextContent("10");

    fireEvent.press(screen.getByTestId("map-select-3"));
    expect(screen.getByTestId("active-map-offer")).toHaveTextContent("3");

    fireEvent.press(screen.getByTestId("radius-filter-1"));

    expect(screen.getByText("Surprise Bakery Bag")).toBeTruthy();
    expect(screen.getByText("Surprise Dinner Bag")).toBeTruthy();
    expect(screen.queryByText("Sushi Mix Platter")).toBeNull();
    expect(screen.getByTestId("active-map-offer")).toHaveTextContent("none");
    expect(screen.getByTestId("map-offers-count")).toHaveTextContent("2");
  });

  it("uses device location for Near Me and keeps the map/list synchronized", async () => {
    mockGetCurrentCoordinates.mockResolvedValue({
      lat: 41.31348,
      lng: 69.25726,
    });

    const screen = render(<FeedScreen />);

    await act(async () => {
      fireEvent.press(screen.getByTestId("near-me-button"));
    });

    expect(mockGetCurrentCoordinates).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Using your location")).toBeTruthy();
    expect(screen.getByTestId("map-user-location-prop")).toHaveTextContent(
      "41.31348,69.25726"
    );
    expect(screen.getByText("Surprise Bakery Bag")).toBeTruthy();
  });

  it("handles denied location permission without hiding discoverable offers", async () => {
    mockGetCurrentCoordinates.mockRejectedValue(
      Object.assign(new Error("Denied"), {
        code: "LOCATION_PERMISSION_DENIED",
      })
    );

    const screen = render(<FeedScreen />);

    await act(async () => {
      fireEvent.press(screen.getByTestId("near-me-button"));
    });

    expect(
      screen.getByText("Location permission denied. Showing saved distances.")
    ).toBeTruthy();
    expect(screen.getByTestId("map-user-location-prop")).toHaveTextContent(
      "none"
    );
    expect(screen.getByText("Morning Pastry Pack")).toBeTruthy();
  });

  it("scrolls the matching offer card into view when a map marker is selected", () => {
    const screen = render(<FeedScreen />);

    act(() => {
      screen.getByTestId("offer-card-layout-3").props.onLayout({
        nativeEvent: {
          layout: {
            y: 720,
          },
        },
      });
    });

    fireEvent.press(screen.getByTestId("map-select-3"));

    expect(mockFeedScrollTo).toHaveBeenCalledWith({
      animated: true,
      y: 680,
    });
    expect(screen.getByTestId("offer-card-3")).toHaveProp(
      "accessibilityState",
      { selected: true }
    );
  });
});

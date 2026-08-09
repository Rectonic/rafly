import { fireEvent, render } from "@testing-library/react-native";
import React, { type ReactNode } from "react";
import { ScrollView } from "react-native";

import FavoritesScreen from "@/app/(tabs)/favorites";

const mockPush = jest.fn();
const mockToggleFavorite = jest.fn();
const mockCreateElement = React.createElement;
const mockScrollView = ScrollView;
let mockFavorites: string[] = [];
let mockSearchQuery = "";

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

jest.mock("@/components/ScreenScrollView", () => ({
  ScreenScrollView: ({
    children,
    ...props
  }: {
    children: ReactNode;
  }) => mockCreateElement(mockScrollView, props, children),
}));

jest.mock("@/lib/favorites-store", () => ({
  useFavorites: () => mockFavorites,
  useToggleFavorite: () => mockToggleFavorite,
}));

jest.mock("@/lib/marketplace-store", () => ({
  usePublishedSellerOffers: () => [],
}));

jest.mock("@/lib/search-store", () => ({
  useSearchQuery: () => mockSearchQuery,
}));

jest.mock("@/lib/locale-store", () => ({
  useLocale: () => "en",
}));

describe("FavoritesScreen", () => {
  beforeEach(() => {
    mockFavorites = [];
    mockPush.mockClear();
    mockSearchQuery = "";
    mockToggleFavorite.mockClear();
  });

  it("exposes an empty state for native and Jest verification", () => {
    const screen = render(<FavoritesScreen />);

    expect(screen.getByTestId("favorites-screen")).toBeTruthy();
    expect(screen.getByTestId("favorites-empty-state")).toHaveTextContent(
      "No favorite offers yet."
    );
  });

  it("renders persisted favorites and keeps shared search filtering", () => {
    mockFavorites = ["4", "9"];

    const screen = render(<FavoritesScreen />);

    expect(screen.getByTestId("favorites-screen")).toBeTruthy();
    expect(screen.getByText("Morning Pastry Pack")).toBeTruthy();
    expect(screen.getByText("Artisan Bread Bundle")).toBeTruthy();

    mockSearchQuery = "bread";
    screen.rerender(<FavoritesScreen />);

    expect(screen.getByText("Artisan Bread Bundle")).toBeTruthy();
    expect(screen.queryByText("Morning Pastry Pack")).toBeNull();

    fireEvent.press(screen.getByTestId("favorite-toggle-4"));
    expect(mockToggleFavorite).toHaveBeenCalledWith("4");
    expect(mockPush).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId("offer-card-4"));
    expect(mockPush).toHaveBeenCalledWith("/offer/4");
  });

  it("distinguishes no favorites from no search matches", () => {
    mockFavorites = ["9"];
    mockSearchQuery = "sushi";

    const screen = render(<FavoritesScreen />);

    expect(screen.getByTestId("favorites-screen")).toBeTruthy();
    expect(screen.getByTestId("favorites-empty-state")).toHaveTextContent(
      "No favorite offers match your search."
    );
  });
});

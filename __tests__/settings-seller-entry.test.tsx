import { fireEvent, render } from "@testing-library/react-native";
import React, { type ReactNode } from "react";
import { ScrollView } from "react-native";

import SettingsScreen from "@/app/(tabs)/settings";

const mockPush = jest.fn();
const mockSetLocale = jest.fn();
let mockSession: unknown = null;
let mockSellerProfile: unknown = null;
const mockCreateElement = React.createElement;
const mockScrollView = ScrollView;

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

jest.mock("@/lib/locale-store", () => ({
  useLocale: () => "en",
  useSetLocale: () => mockSetLocale,
}));

jest.mock("@/lib/seller/auth-store", () => ({
  useAuth: () => ({
    sellerProfile: mockSellerProfile,
    session: mockSession,
  }),
}));

describe("SettingsScreen seller entry", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockSetLocale.mockClear();
    mockSession = null;
    mockSellerProfile = null;
  });

  it("exposes stable controls for native seller auth entry", () => {
    const screen = render(<SettingsScreen />);

    expect(screen.getByTestId("settings-screen")).toBeTruthy();
    expect(screen.getByTestId("settings-language-ru")).toBeTruthy();
    expect(screen.getByTestId("settings-language-en")).toBeTruthy();
    expect(screen.getByTestId("settings-seller-mode-button")).toBeTruthy();

    fireEvent.press(screen.getByTestId("settings-seller-mode-button"));

    expect(mockPush).toHaveBeenCalledWith("/auth/login");
  });

  it("routes complete sellers to seller tabs", () => {
    mockSession = { user: { id: "seller-user" } };
    mockSellerProfile = { id: "seller-profile" };

    const screen = render(<SettingsScreen />);

    expect(screen.getByText("Switch to Seller")).toBeTruthy();

    fireEvent.press(screen.getByTestId("settings-seller-mode-button"));

    expect(mockPush).toHaveBeenCalledWith("/(seller-tabs)");
  });
});

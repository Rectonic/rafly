import { fireEvent, render } from "@testing-library/react-native";
import React, { type ReactNode } from "react";
import { ScrollView, Text } from "react-native";

import BusinessTypeScreen from "@/app/auth/business-type";
import LoginScreen from "@/app/auth/login";
import SignupScreen from "@/app/auth/signup";

const mockCreateElement = React.createElement;
const mockScrollView = ScrollView;
const mockText = Text;
const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  Link: ({ children, ...props }: { children: ReactNode }) =>
    mockCreateElement(mockText, props, children),
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

jest.mock("@expo/vector-icons/Ionicons", () => ({
  __esModule: true,
  default: ({ name }: { name: string }) =>
    mockCreateElement(mockText, { testID: `icon-${name}` }, name),
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
}));

jest.mock("@/lib/seller/auth-store", () => ({
  useAuth: () => ({
    completeBusinessTypeSelection: jest.fn(),
    error: null,
    signIn: jest.fn(),
    signUp: jest.fn(),
  }),
}));

describe("auth screen automation selectors", () => {
  beforeEach(() => {
    mockReplace.mockClear();
  });

  it("exposes seller login controls", () => {
    const screen = render(<LoginScreen />);

    expect(screen.getByTestId("seller-login-screen")).toBeTruthy();
    expect(screen.getByTestId("seller-login-close-button")).toBeTruthy();
    expect(screen.getByTestId("seller-login-email-input")).toBeTruthy();
    expect(screen.getByTestId("seller-login-password-input")).toBeTruthy();
    expect(screen.getByTestId("seller-login-submit-button")).toBeTruthy();
    expect(screen.getByTestId("seller-signup-link")).toBeTruthy();

    fireEvent.press(screen.getByTestId("seller-login-close-button"));

    expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
  });

  it("exposes seller signup controls", () => {
    const screen = render(<SignupScreen />);

    expect(screen.getByTestId("seller-signup-screen")).toBeTruthy();
    expect(screen.getByTestId("seller-signup-close-button")).toBeTruthy();
    expect(screen.getByTestId("seller-signup-email-input")).toBeTruthy();
    expect(screen.getByTestId("seller-signup-password-input")).toBeTruthy();
    expect(screen.getByTestId("seller-signup-submit-button")).toBeTruthy();

    fireEvent.press(screen.getByTestId("seller-signup-close-button"));

    expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
  });

  it("exposes business-type onboarding controls", () => {
    const screen = render(<BusinessTypeScreen />);

    expect(screen.getByTestId("seller-business-type-screen")).toBeTruthy();
    expect(screen.getByTestId("business-type-close-button")).toBeTruthy();
    expect(screen.getByTestId("business-type-restaurant-button")).toBeTruthy();
    expect(screen.getByTestId("business-type-shop-button")).toBeTruthy();
  });
});

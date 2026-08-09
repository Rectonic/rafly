import { render } from "@testing-library/react-native";
import React from "react";
import { Text, View } from "react-native";

import SellerTabsLayout from "@/app/(seller-tabs)/_layout";
import BuyerTabsLayout from "@/app/(tabs)/_layout";

type TabRecord = {
  name: string;
  options: {
    href?: string | null;
    tabBarIcon?: (props: { color: string; focused: boolean; size: number }) => {
      props: { name: string };
    };
    title?: string;
  };
};

const mockTabScreens: TabRecord[] = [];
const mockScreenOptions: unknown[] = [];
const mockCreateElement = React.createElement;
const mockText = Text;
const mockView = View;
let mockSellerBusinessType: "restaurant" | "shop" = "restaurant";

jest.mock("expo-router", () => {
  const Tabs = ({
    children,
    screenOptions,
  }: {
    children: React.ReactNode;
    screenOptions: unknown;
  }) => {
    mockScreenOptions.push(screenOptions);
    return mockCreateElement(mockView, null, children);
  };

  Tabs.Screen = function MockTabsScreen({ name, options }: TabRecord) {
    mockTabScreens.push({ name, options });
    return null;
  };

  return {
    Redirect: function MockRedirect({ href }: { href: string }) {
      return mockCreateElement(mockView, { testID: `redirect-${href}` });
    },
    Tabs,
  };
});

jest.mock("@expo/vector-icons/Ionicons", () => {
  return function MockIonicons(props: { name: string }) {
    return mockCreateElement(mockText, { testID: props.name }, props.name);
  };
});

jest.mock("@/lib/seller/auth-store", () => ({
  useAuth: () => ({
    isLoading: false,
    sellerProfile: {
      businessType: mockSellerBusinessType,
      id: "seller-profile",
    },
    session: { user: { id: "seller-user" } },
  }),
}));

jest.mock("@/lib/locale-store", () => ({
  useLocale: () => "en",
}));

function resetCapturedTabs() {
  mockTabScreens.length = 0;
  mockScreenOptions.length = 0;
}

function expectVisibleTabsToUseIcons() {
  const visibleTabs = mockTabScreens.filter(
    (screen) => screen.options.href !== null
  );

  expect(visibleTabs.length).toBeGreaterThan(0);

  for (const screen of visibleTabs) {
    expect(typeof screen.options.tabBarIcon).toBe("function");

    const icon = screen.options.tabBarIcon?.({
      color: "#111827",
      focused: false,
      size: 24,
    });

    expect(icon?.props.name).toBeTruthy();
    expect(icon?.props.name).not.toBe("triangle");
  }
}

describe("tab layout icons", () => {
  beforeEach(() => {
    resetCapturedTabs();
    mockSellerBusinessType = "restaurant";
  });

  it("uses explicit icons for buyer tabs", () => {
    render(<BuyerTabsLayout />);

    expectVisibleTabsToUseIcons();
  });

  it("uses explicit icons for restaurant seller tabs", () => {
    render(<SellerTabsLayout />);

    expectVisibleTabsToUseIcons();
  });

  it("uses explicit icons for shop seller tabs", () => {
    mockSellerBusinessType = "shop";

    render(<SellerTabsLayout />);

    expectVisibleTabsToUseIcons();
  });
});

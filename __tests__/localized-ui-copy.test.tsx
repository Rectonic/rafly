import { fireEvent, render } from "@testing-library/react-native";
import React, { type ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";

import { OfferCard } from "@/components/OfferCard";
import BusinessTypeScreen from "@/app/auth/business-type";
import CreateOfferScreen from "@/app/(seller-tabs)/create";
import LoginScreen from "@/app/auth/login";
import OrdersScreen from "@/app/(seller-tabs)/orders";
import SellerProfileScreen from "@/app/(seller-tabs)/profile";
import SellerDashboardScreen from "@/app/(seller-tabs)";
import SellerTabsLayout from "@/app/(seller-tabs)/_layout";
import SignupScreen from "@/app/auth/signup";
import InventoryScreen from "@/app/(seller-tabs)/inventory";
import BuyerTabsLayout from "@/app/(tabs)/_layout";
import FavoritesScreen from "@/app/(tabs)/favorites";
import SettingsScreen from "@/app/(tabs)/settings";

type TabRecord = {
  name: string;
  options: {
    href?: string | null;
    title?: string;
  };
};

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockSetLocale = jest.fn();
const mockTabScreens: TabRecord[] = [];
const mockCreateElement = React.createElement;
const mockScrollView = ScrollView;
const mockText = Text;
const mockView = View;
const mockSellerProfile = {
  address: "Ташкент",
  businessName: "Тестовая пекарня",
  businessType: "restaurant" as "restaurant" | "shop",
  category: "Пекарня",
  id: "seller-profile",
  latitude: 41.31,
  longitude: 69.27,
};

jest.mock("expo-router", () => {
  const Tabs = ({
    children,
  }: {
    children: React.ReactNode;
    screenOptions: unknown;
  }) => mockCreateElement(mockView, null, children);

  Tabs.Screen = function MockTabsScreen({ name, options }: TabRecord) {
    mockTabScreens.push({ name, options });
    return null;
  };

  return {
    Link: ({ children, ...props }: { children: ReactNode }) =>
      mockCreateElement(mockText, props, children),
    Redirect: function MockRedirect({ href }: { href: string }) {
      return mockCreateElement(mockView, { testID: `redirect-${href}` });
    },
    Tabs,
    useRouter: () => ({
      push: mockPush,
      replace: mockReplace,
    }),
  };
});

jest.mock("@/components/ScreenScrollView", () => ({
  ScreenScrollView: ({
    children,
    ...props
  }: {
    children: ReactNode;
  }) => mockCreateElement(mockScrollView, props, children),
}));

jest.mock("@/components/TabBarIcon", () => ({
  TabBarIcon: ({ name }: { name: string }) =>
    mockCreateElement(mockText, { testID: name }, name),
}));

jest.mock("@expo/vector-icons/Ionicons", () => ({
  __esModule: true,
  default: ({ name }: { name: string }) =>
    mockCreateElement(mockText, { testID: `icon-${name}` }, name),
}));

jest.mock("@/components/seller/InventoryCard", () => ({
  InventoryCard: () => null,
}));

jest.mock("@/components/seller/Scanner", () => ({
  Scanner: () => null,
}));

jest.mock("@/lib/locale-store", () => ({
  useLocale: () => "ru",
  useSetLocale: () => mockSetLocale,
}));

jest.mock("@/lib/favorites-store", () => ({
  useFavorites: () => [],
  useToggleFavorite: () => jest.fn(),
}));

jest.mock("@/lib/marketplace-store", () => ({
  usePublishedSellerOffers: () => [],
}));

jest.mock("@/lib/search-store", () => ({
  useSearchQuery: () => "",
}));

jest.mock("@/lib/seller/auth-store", () => ({
  useAuth: () => ({
    completeBusinessTypeSelection: jest.fn(),
    error: null,
    isLoading: false,
    sellerProfile: mockSellerProfile,
    session: { user: { id: "seller-user" } },
    signIn: jest.fn(),
    signOut: jest.fn(),
    signUp: jest.fn(),
  }),
}));

jest.mock("@/lib/seller/inventory-store", () => ({
  useInventory: () => ({
    addItem: jest.fn(),
    deleteItem: jest.fn(),
    items: [],
  }),
}));

jest.mock("@/lib/seller/offers-store", () => ({
  useSellerOffers: () => ({
    isLoading: false,
    offers: [],
    publishOffer: jest.fn(),
  }),
}));

jest.mock("@/lib/seller/orders-store", () => ({
  useOrders: () => ({
    error: null,
    isLoading: false,
    orders: [],
    refreshOrders: jest.fn(),
    verifyPickup: jest.fn(),
  }),
}));

jest.mock("@/lib/seller/profile-store", () => ({
  useSellerProfile: () => ({
    updateProfile: jest.fn(),
  }),
}));

function resetCapturedTabs() {
  mockTabScreens.length = 0;
}

function visibleTabTitles() {
  return mockTabScreens
    .filter((screen) => screen.options.href !== null)
    .map((screen) => screen.options.title);
}

describe("localized UI copy", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockReplace.mockClear();
    mockSetLocale.mockClear();
    mockSellerProfile.businessType = "restaurant";
    resetCapturedTabs();
  });

  it("renders buyer tabs and settings copy in Russian for the Russian locale", () => {
    render(<BuyerTabsLayout />);

    expect(visibleTabTitles()).toEqual([
      "Лента",
      "Избранное",
      "Брони",
      "Настройки",
    ]);

    const settings = render(<SettingsScreen />);

    expect(settings.getByText("Настройки")).toBeTruthy();
    expect(settings.getByText("Язык")).toBeTruthy();
    expect(settings.getByText("Продавец")).toBeTruthy();
    expect(settings.getByText("Перейти в режим продавца")).toBeTruthy();
    expect(settings.queryByText("Settings")).toBeNull();
    expect(settings.queryByText("Seller Mode")).toBeNull();
  });

  it("renders favorites empty copy in Russian for the Russian locale", () => {
    const screen = render(<FavoritesScreen />);

    expect(screen.getByText("Избранное")).toBeTruthy();
    expect(screen.getByTestId("favorites-empty-state")).toHaveTextContent(
      "Избранных предложений пока нет."
    );
    expect(screen.queryByText("No favorite offers yet.")).toBeNull();
  });

  it("renders buyer offer-card quantity copy in Russian", () => {
    const screen = render(
      <OfferCard
        isFavorite={false}
        offer={{
          category: "Baked Goods",
          distance: "2.8 km",
          endTime: "18:45",
          id: "offer-1",
          image: "",
          isSurpriseBag: false,
          discount: 65,
          location: {
            address: "Ташкент",
            lat: 41.31,
            lng: 69.28,
          },
          newPrice: 5.6,
          oldPrice: 16,
          quantityAvailable: 9,
          rating: 4.8,
          restaurant: "Тестовая пекарня",
          reviews: 12,
          title: "Набор выпечки",
        }}
        onPress={jest.fn()}
        onToggleFavorite={jest.fn()}
      />
    );

    expect(screen.getByText("9 порций осталось")).toBeTruthy();
    expect(screen.getByText("5,60 $")).toBeTruthy();
    expect(screen.getByText("16,00 $")).toBeTruthy();
    expect(screen.queryByText("$5.60")).toBeNull();
    expect(screen.queryByText("9 left")).toBeNull();
  });

  it("renders restaurant seller tabs and dashboard copy in Russian", () => {
    render(<SellerTabsLayout />);

    expect(visibleTabTitles()).toEqual([
      "Главная",
      "Пакеты",
      "История",
      "Профиль",
    ]);

    const dashboard = render(<SellerDashboardScreen />);

    expect(dashboard.getByText("Активные предложения")).toBeTruthy();
    expect(dashboard.getByText("Ожидают выдачи")).toBeTruthy();
    expect(dashboard.getByText("Товаров на учёте")).toBeTruthy();
    expect(dashboard.getByText("Создать предложение")).toBeTruthy();
    expect(dashboard.queryByText("Active offers")).toBeNull();
  });

  it("renders shop inventory copy in Russian", () => {
    mockSellerProfile.businessType = "shop";

    const screen = render(<InventoryScreen />);

    expect(screen.getByText("Приём товаров")).toBeTruthy();
    expect(screen.getByText("Сканировать штрих-код")).toBeTruthy();
    expect(screen.getByPlaceholderText("Название товара")).toBeTruthy();
    expect(screen.getByPlaceholderText("Количество")).toBeTruthy();
    expect(screen.getByText("Добавить товар")).toBeTruthy();
    expect(screen.queryByText("Inventory intake")).toBeNull();
  });

  it("renders auth and onboarding copy in Russian with a close action", () => {
    const login = render(<LoginScreen />);

    expect(login.getByText("Вход для продавца")).toBeTruthy();
    expect(login.getByText("Войти")).toBeTruthy();
    expect(login.getByText("Новый продавец? Создать аккаунт продавца")).toBeTruthy();
    expect(login.queryByText("Seller sign in")).toBeNull();

    const signup = render(<SignupScreen />);

    expect(signup.getByText("Зарегистрируйтесь как продавец")).toBeTruthy();
    expect(signup.getByText("Продолжить")).toBeTruthy();
    expect(signup.queryByText("Create seller account")).toBeNull();

    const onboarding = render(<BusinessTypeScreen />);

    expect(onboarding.getByText("Тип бизнеса")).toBeTruthy();
    expect(onboarding.getByText("Ресторан")).toBeTruthy();
    expect(onboarding.getByText("Магазин / Супермаркет")).toBeTruthy();

    fireEvent.press(onboarding.getByTestId("business-type-close-button"));

    expect(mockReplace).toHaveBeenCalledWith("/(tabs)/settings");
  });

  it("renders seller create, orders, and profile copy in Russian", () => {
    const create = render(<CreateOfferScreen />);

    expect(create.getByText("Создать пакет блюд")).toBeTruthy();
    expect(create.getByText("Опубликованные предложения")).toBeTruthy();
    expect(create.getByText("Использовать камеру")).toBeTruthy();
    expect(create.getByText("Выбрать фото")).toBeTruthy();
    expect(create.getByText("Сюрприз-пакет")).toBeTruthy();
    expect(create.queryByText("Create meal package")).toBeNull();

    const orders = render(<OrdersScreen />);

    expect(orders.getByText("Заказы на выдачу")).toBeTruthy();
    expect(orders.getByText("Обновить заказы")).toBeTruthy();
    expect(orders.getByText("Ожидает")).toBeTruthy();
    expect(orders.getByText("Получено")).toBeTruthy();
    expect(orders.getByText("Сканировать код бронирования")).toBeTruthy();
    expect(orders.getByPlaceholderText("Введите код вручную")).toBeTruthy();
    expect(orders.getByText("Нет ожидающих заказов.")).toBeTruthy();
    expect(orders.queryByText("Pickup orders")).toBeNull();

    const profile = render(<SellerProfileScreen />);

    expect(profile.getByText("Профиль продавца")).toBeTruthy();
    expect(profile.getByPlaceholderText("Название заведения")).toBeTruthy();
    expect(profile.getByPlaceholderText("Категория")).toBeTruthy();
    expect(profile.getByPlaceholderText("Адрес")).toBeTruthy();
    expect(profile.getByText("Сохранить профиль")).toBeTruthy();
    expect(profile.getByText("Перейти к покупателю")).toBeTruthy();
    expect(profile.getByText("Выйти")).toBeTruthy();
    expect(profile.queryByText("Seller profile")).toBeNull();
  });
});

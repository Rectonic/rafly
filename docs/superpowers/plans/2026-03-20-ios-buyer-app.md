# LastBite iOS Buyer App — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a buyer-only iOS app with Expo managed workflow: discover, filter, and map surplus food offers using Apple Maps, AsyncStorage stores, and local pickup reminders.

**Architecture:** Expo Router file-based navigation (3-tab layout + modal). React Context + `useReducer` for all stores (favorites, search, locale). Filtering/sorting extracted to pure `lib/filters.ts`. Apple Maps via `react-native-maps` default provider. Local notifications via `expo-notifications`.

**Tech Stack:** Expo SDK 52, expo-router v3, react-native-maps (Apple Maps/MapKit), @react-native-async-storage/async-storage, expo-notifications, react-native-reanimated, lucide-react-native, Jest + @testing-library/react-native

**Spec:** `../specs/2026-03-20-ios-buyer-app-design.md`

**Parent directory for new project:** `/Users/boiskhonkattakhodjaev/Desktop/Useful Materials/LastBite/` (sibling to `lastbite-web/`)

---

## File Map

```
lastbite-mobile/
  app.json                         # Expo config (bundle ID, notifications plugin)
  tsconfig.json                    # strict, paths @/* -> ./*
  babel.config.js                  # babel-preset-expo + module-resolver for @/
  jest.config.js                   # jest-expo preset
  jest.setup.ts                    # AsyncStorage mock, reanimated mock

  app/
    _layout.tsx                    # Root: StatusBar + all Context providers
    (tabs)/
      _layout.tsx                  # Tab bar: Feed | Favorites | Settings
      index.tsx                    # Feed screen (map + filters + cards)
      favorites.tsx                # Favorites screen
      settings.tsx                 # Settings screen
    offer/
      [id].tsx                     # Offer detail modal (slides up)

  components/
    OfferCard.tsx                  # Card row for FlatList
    OffersMap.tsx                  # Apple Maps + markers + bidirectional sync
    ui/
      Badge.tsx                    # Colored pill label
      Button.tsx                   # Primary / outline / ghost
      Card.tsx                     # Rounded container with shadow
      IconButton.tsx               # Circular pressable (favorites, share)

  hooks/
    useCountdown.ts                # Live 30s countdown, next-day wrap
    useColors.ts                   # Theme-aware token access (light/dark)

  lib/
    favorites-store.ts             # Context + useReducer + AsyncStorage
    search-store.ts                # Context + useReducer (in-memory)
    marketplace-store.ts           # No-op stub → Supabase later
    filters.ts                     # Pure filter/sort functions
    notifications.ts               # Schedule/cancel local notifications

  i18n/
    types.ts                       # MobileTranslations interface (buyer keys + mobile namespace)
    en.ts                          # English dictionary
    ru.ts                          # Russian dictionary with pluralRu
    index.ts                       # LocaleContext + useT() + setLocale()

  data/
    offers.ts                      # 10 seed offers (copied from web)

  types/
    offer.ts                       # Offer, OfferCategory, OfferFilterCategory, OfferLocation

  constants/
    colors.ts                      # Light + dark token map

  __tests__/
    filters.test.ts                # Filter/sort algorithms
    pluralRu.test.ts               # Russian pluralization edge cases
    useCountdown.test.ts           # Countdown logic (isolated from React)
    favorites-store.test.ts        # Reducer logic
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `lastbite-mobile/` (entire project)
- Create: `lastbite-mobile/tsconfig.json`
- Create: `lastbite-mobile/babel.config.js`
- Create: `lastbite-mobile/jest.config.js`
- Create: `lastbite-mobile/jest.setup.ts`

- [ ] **Step 1: Create Expo app with tabs template**

Run from `/Users/boiskhonkattakhodjaev/Desktop/Useful Materials/LastBite/`:
```bash
cd "/Users/boiskhonkattakhodjaev/Desktop/Useful Materials/LastBite"
npx create-expo-app@latest lastbite-mobile -t tabs
cd lastbite-mobile
```

Expected: Project created with `app/(tabs)/index.tsx`, `app/(tabs)/explore.tsx`, `app/_layout.tsx`.

- [ ] **Step 2: Install all project dependencies**

```bash
npx expo install react-native-maps
npx expo install @react-native-async-storage/async-storage
npx expo install expo-notifications
npx expo install react-native-reanimated
npm install lucide-react-native
npm install --save-dev @testing-library/react-native @testing-library/jest-native
npm install --save-dev babel-plugin-module-resolver
```

- [ ] **Step 3: Configure TypeScript with strict mode and `@/` path alias**

Replace `tsconfig.json`:
```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

- [ ] **Step 4: Configure Babel for `@/` alias resolution**

Replace `babel.config.js`:
```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['module-resolver', {
        root: ['.'],
        alias: { '@': '.' },
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
      }],
      'react-native-reanimated/plugin',
    ],
  };
};
```

> ⚠️ `react-native-reanimated/plugin` must be **last** in the plugins array.

- [ ] **Step 5: Configure Jest**

Create `jest.config.js`:
```js
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['./jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native|@react-native|expo|@expo|@unimodules|lucide-react-native)',
  ],
};
```

Create `jest.setup.ts`:
```ts
import '@testing-library/jest-native/extend-expect';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('test-notification-id'),
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
  getAllScheduledNotificationsAsync: jest.fn().mockResolvedValue([]),
}));

// Mock react-native-maps
jest.mock('react-native-maps', () => {
  const React = require('react');
  const MapView = (props: any) => React.createElement('MapView', props);
  const Marker = (props: any) => React.createElement('Marker', props);
  const Callout = (props: any) => React.createElement('Callout', props);
  return { default: MapView, Marker, Callout };
});

// Mock reanimated
jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock')
);
```

- [ ] **Step 6: Configure `app.json` with bundle identifier and notifications plugin**

Edit `app.json`:
```json
{
  "expo": {
    "name": "LastBite",
    "slug": "lastbite-mobile",
    "version": "1.0.0",
    "orientation": "portrait",
    "scheme": "lastbite",
    "userInterfaceStyle": "automatic",
    "ios": {
      "bundleIdentifier": "com.lastbite.app",
      "supportsTablet": false,
      "infoPlist": {
        "NSLocationWhenInUseUsageDescription": "LastBite uses your location to show nearby offers on the map."
      }
    },
    "plugins": [
      [
        "expo-notifications",
        {
          "icon": "./assets/images/notification-icon.png",
          "color": "#16C79A"
        }
      ]
    ]
  }
}
```

- [ ] **Step 7: Delete placeholder files from template**

```bash
rm app/(tabs)/explore.tsx
rm -rf components/  # template components — we'll build our own
```

- [ ] **Step 8: Verify project runs**

```bash
npx expo start --ios
```

Expected: Simulator opens, tabs navigation visible (Feed tab active). May show blank screens — that's OK at this stage.

- [ ] **Step 9: Commit**

```bash
git init
git add .
git commit -m "feat: scaffold Expo managed app with deps and tooling config"
```

> **What might be missing?**
> - `notification-icon.png` asset referenced in `app.json` — create a placeholder 96×96 teal PNG before building for device.
> - Splash screen and app icon not configured — use Expo's default until design assets are ready.

---

## Task 2: Types and Seed Data

**Files:**
- Create: `types/offer.ts`
- Create: `data/offers.ts`

- [ ] **Step 1: Copy Offer types**

Create `types/offer.ts` (identical to web version):
```ts
export type OfferCategory =
  | 'Meals'
  | 'Baked Goods'
  | 'Groceries'
  | 'Vegan'
  | 'Surprise Bags';

export type OfferFilterCategory = 'All' | OfferCategory;

export interface OfferLocation {
  lat: number;
  lng: number;
  address: string;
}

export interface Offer {
  id: string;
  title: string;
  restaurant: string;
  image: string;
  oldPrice: number;
  newPrice: number;
  discount: number;
  distance: string;
  endTime: string;       // "HH:MM" format
  rating: number;
  reviews: number;
  category: OfferCategory;
  location: OfferLocation;
  contents?: string[];
  pickupStart?: string;
  quantityAvailable?: number;
  source?: 'seed' | 'seller';
  businessType?: 'restaurant' | 'shop' | 'bakery';
  expiryDate?: string;
  isSurpriseBag?: boolean;
}
```

- [ ] **Step 2: Copy seed data**

Create `data/offers.ts` — copy the full `OFFERS` array and `OFFER_FILTERS` from `lastbite-web/src/data/offers.ts`. Change the import at the top:
```ts
import type { Offer, OfferFilterCategory } from '@/types/offer';
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add types/ data/
git commit -m "feat: add Offer types and seed data (ported from web)"
```

---

## Task 3: Design Tokens

**Files:**
- Create: `constants/colors.ts`
- Create: `hooks/useColors.ts`

- [ ] **Step 1: Create color token constants**

Create `constants/colors.ts`:
```ts
export const Colors = {
  light: {
    primary: '#16C79A',
    secondary: '#FF8C42',
    destructive: '#FF6B6B',
    background: '#FFFFFF',
    foreground: '#09090B',
    muted: '#F4F4F5',
    mutedForeground: '#71717A',
    card: '#FFFFFF',
    border: '#E4E4E7',
    // Specific UI uses
    amber: '#F59E0B',
    amberLight: '#FEF3C7',
    amberBorder: '#FCD34D',
    green: '#16A34A',
    greenLight: '#DCFCE7',
    markerActive: '#0f766e',
  },
  dark: {
    primary: '#16C79A',        // intentionally same — brand color preserved in dark mode
    secondary: '#FF8C42',      // intentionally same
    destructive: '#FF6B6B',    // intentionally same
    background: '#09090B',
    foreground: '#FAFAFA',
    muted: '#27272A',
    mutedForeground: '#A1A1AA',
    card: '#09090B',
    border: '#27272A',
    amber: '#F59E0B',
    amberLight: '#2D1F00',
    amberBorder: '#92400E',
    green: '#4ADE80',
    greenLight: '#052E16',
    markerActive: '#0f766e',
  },
} as const;

export type ColorScheme = keyof typeof Colors;
export type ColorTokens = typeof Colors.light;
```

- [ ] **Step 2: Create useColors hook**

Create `hooks/useColors.ts`:
```ts
import { useColorScheme } from 'react-native';
import { Colors } from '@/constants/colors';

export function useColors() {
  const scheme = useColorScheme() ?? 'light';
  return Colors[scheme];
}
```

- [ ] **Step 3: Commit**

```bash
git add constants/ hooks/useColors.ts
git commit -m "feat: add design token constants and useColors hook"
```

---

## Task 4: i18n System

**Files:**
- Create: `i18n/types.ts`
- Create: `i18n/en.ts`
- Create: `i18n/ru.ts`
- Create: `i18n/index.ts`
- Create: `__tests__/pluralRu.test.ts`

- [ ] **Step 1: Write failing test for Russian pluralization**

Create `__tests__/pluralRu.test.ts`:
```ts
import { pluralRu } from '@/i18n/ru';

describe('pluralRu', () => {
  it('returns "one" form for 1, 21, 31', () => {
    expect(pluralRu(1, 'штука', 'штуки', 'штук')).toBe('штука');
    expect(pluralRu(21, 'штука', 'штуки', 'штук')).toBe('штука');
    expect(pluralRu(31, 'штука', 'штуки', 'штук')).toBe('штука');
  });

  it('returns "few" form for 2, 3, 4, 22, 23, 24', () => {
    expect(pluralRu(2, 'штука', 'штуки', 'штук')).toBe('штуки');
    expect(pluralRu(4, 'штука', 'штуки', 'штук')).toBe('штуки');
    expect(pluralRu(22, 'штука', 'штуки', 'штук')).toBe('штуки');
  });

  it('returns "many" form for 5-20, 11, 12, 13, 14', () => {
    expect(pluralRu(5, 'штука', 'штуки', 'штук')).toBe('штук');
    expect(pluralRu(11, 'штука', 'штуки', 'штук')).toBe('штук');
    expect(pluralRu(12, 'штука', 'штуки', 'штук')).toBe('штук');
    expect(pluralRu(14, 'штука', 'штуки', 'штук')).toBe('штук');
    expect(pluralRu(20, 'штука', 'штуки', 'штук')).toBe('штук');
    expect(pluralRu(100, 'штука', 'штуки', 'штук')).toBe('штук');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/pluralRu.test.ts
```

Expected: FAIL — `Cannot find module '@/i18n/ru'`

- [ ] **Step 3: Create i18n/types.ts**

Create `i18n/types.ts` (buyer-only + mobile namespace):
```ts
export type Locale = 'en' | 'ru';

export interface MobileTranslations {
  home: {
    badge: string;
    title: string;
    subtitle: string;
    offersShowing: (n: number) => string;
    clearFilters: string;
    loadingMap: string;
    noOffersSearch: (q: string) => string;
    noOffersEmpty: string;
    noOffersCategory: string;
    noOffersHintFav: string;
    noOffersHint: string;
    sort: {
      expiry: string;
      price: string;
      discount: string;
      distance: string;
    };
  };
  offer: {
    surprise: string;
    onlyLeft: (n: number) => string;
    addToFavorites: string;
    removeFromFavorites: string;
    portionsLeft: (n: number) => string;
    collectBy: string;
    countdown: (label: string) => string;
    hoursMinLeft: (h: number, m: number) => string;
    minsLeft: (m: number) => string;
    qrAlt: string;
    portionsAvailable: string;
    onlyLeftDialog: (n: number) => string;
    remaining: (n: number) => string;
    whatYouMightGet: string;
    surpriseBagDesc: string;
    regularDesc: string;
    impactTeaser: (co2: number, water: number) => string;
    youSave: (amount: string) => string;
    includesTaxes: string;
    reserveNow: string;
    reserved: string;
    qrMessage: (restaurant: string, time: string) => string;
    yourRescueImpact: string;
    co2Avoided: string;
    waterSaved: string;
    youSavedStat: string;
    collectToday: string;
    pickupWindow: (start: string, end: string) => string;
    away: string;
  };
  categories: {
    All: string;
    Meals: string;
    'Baked Goods': string;
    Groceries: string;
    Vegan: string;
    'Surprise Bags': string;
  };
  mobile: {
    tabFeed: string;
    tabFavorites: string;
    tabSettings: string;
    searchPlaceholder: string;
    noFavorites: string;
    noFavoritesHint: string;
    settingsLanguage: string;
    settingsAbout: string;
    settingsVersion: string;
    settingsAppName: string;
    settingsTagline: string;
    notificationTitle: string;
    notificationBody: (restaurant: string) => string;
    notificationPermissionDenied: string;
  };
}
```

- [ ] **Step 4: Create i18n/en.ts**

Create `i18n/en.ts`:
```ts
import type { MobileTranslations } from './types';

export const en: MobileTranslations = {
  home: {
    badge: 'Live rescue feed',
    title: 'Discover nearby surplus food',
    subtitle: 'Filter by category, explore on the map.',
    offersShowing: (n) => `${n} offer${n === 1 ? '' : 's'}`,
    clearFilters: 'Clear filters',
    loadingMap: 'Loading map...',
    noOffersSearch: (q) => `No offers matching "${q}"`,
    noOffersEmpty: 'No saved offers yet',
    noOffersCategory: 'No offers in this category',
    noOffersHintFav: 'Tap ♥ on an offer to save it.',
    noOffersHint: 'Try another filter or clear all.',
    sort: {
      expiry: 'Expiring Soon',
      price: 'Lowest Price',
      discount: 'Biggest Discount',
      distance: 'Closest First',
    },
  },
  offer: {
    surprise: 'Surprise',
    onlyLeft: (n) => `Only ${n} left!`,
    addToFavorites: 'Add to favorites',
    removeFromFavorites: 'Remove from favorites',
    portionsLeft: (n) => `${n} portions left`,
    collectBy: 'Collect by',
    countdown: (label) => `Collect today · ${label}`,
    hoursMinLeft: (h, m) => `${h}h ${m}m left`,
    minsLeft: (m) => `${m}m left`,
    qrAlt: 'QR Code',
    portionsAvailable: 'Portions available',
    onlyLeftDialog: (n) => `Only ${n} left!`,
    remaining: (n) => `${n} remaining`,
    whatYouMightGet: 'What you might get',
    surpriseBagDesc:
      "This is a surprise bag! You'll get a selection of items that didn't sell in time — perfectly good to eat. Contents revealed at pickup.",
    regularDesc:
      'Fresh food saved from going to waste. Enjoy a great meal while helping the planet!',
    impactTeaser: (co2, water) =>
      `Rescuing this saves ~${co2} kg CO₂ and ~${water}L of water`,
    youSave: (amount) => `You save $${amount}`,
    includesTaxes: 'Includes taxes',
    reserveNow: 'Reserve Now',
    reserved: 'Reserved!',
    qrMessage: (restaurant, time) =>
      `Show this QR code at ${restaurant} before ${time} to collect your food.`,
    yourRescueImpact: 'Your rescue impact',
    co2Avoided: 'CO₂ avoided',
    waterSaved: 'water saved',
    youSavedStat: 'you saved',
    collectToday: 'Collect today',
    pickupWindow: (start, end) => `Between ${start} and ${end}`,
    away: 'away',
  },
  categories: {
    All: 'All',
    Meals: 'Meals',
    'Baked Goods': 'Baked Goods',
    Groceries: 'Groceries',
    Vegan: 'Vegan',
    'Surprise Bags': 'Surprise Bags',
  },
  mobile: {
    tabFeed: 'Feed',
    tabFavorites: 'Favorites',
    tabSettings: 'Settings',
    searchPlaceholder: 'Search restaurants, food...',
    noFavorites: 'No favorites yet',
    noFavoritesHint: 'Tap the ♥ on any offer to save it here.',
    settingsLanguage: 'Language',
    settingsAbout: 'About',
    settingsVersion: 'Version',
    settingsAppName: 'LastBite',
    settingsTagline: 'Save food, save money',
    notificationTitle: 'Pickup reminder',
    notificationBody: (restaurant) =>
      `Your pickup at ${restaurant} ends in 30 minutes!`,
    notificationPermissionDenied:
      'Enable notifications in Settings to get pickup reminders.',
  },
};
```

- [ ] **Step 5: Create i18n/ru.ts**

Create `i18n/ru.ts`:
```ts
import type { MobileTranslations } from './types';

export function pluralRu(
  n: number,
  one: string,
  few: string,
  many: string
): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

export const ru: MobileTranslations = {
  home: {
    badge: 'Живая лента спасения',
    title: 'Найдите ближайшую лишнюю еду',
    subtitle: 'Фильтруйте по категориям, смотрите на карте.',
    offersShowing: (n) =>
      `${n} ${pluralRu(n, 'предложение', 'предложения', 'предложений')}`,
    clearFilters: 'Сбросить',
    loadingMap: 'Загрузка карты...',
    noOffersSearch: (q) => `Нет предложений по «${q}»`,
    noOffersEmpty: 'Нет сохранённых предложений',
    noOffersCategory: 'В этой категории нет предложений',
    noOffersHintFav: 'Нажмите ♥ на карточке, чтобы сохранить.',
    noOffersHint: 'Попробуйте другой фильтр или сбросьте.',
    sort: {
      expiry: 'Скоро истекает',
      price: 'Самая низкая цена',
      discount: 'Наибольшая скидка',
      distance: 'Ближе всего',
    },
  },
  offer: {
    surprise: 'Сюрприз',
    onlyLeft: (n) => `Осталось ${n}!`,
    addToFavorites: 'Добавить в избранное',
    removeFromFavorites: 'Убрать из избранного',
    portionsLeft: (n) =>
      `${n} ${pluralRu(n, 'порция', 'порции', 'порций')} осталось`,
    collectBy: 'Забрать до',
    countdown: (label) => `Забрать сегодня · ${label}`,
    hoursMinLeft: (h, m) => `${h} ч ${m} мин`,
    minsLeft: (m) => `${m} мин`,
    qrAlt: 'QR-код',
    portionsAvailable: 'Доступно порций',
    onlyLeftDialog: (n) => `Осталось всего ${n}!`,
    remaining: (n) =>
      `${n} ${pluralRu(n, 'порция', 'порции', 'порций')} доступно`,
    whatYouMightGet: 'Что вы получите',
    surpriseBagDesc:
      'Сюрприз-пакет! Вы получите набор свежих блюд, не проданных вовремя. Состав — сюрприз до момента получения.',
    regularDesc:
      'Свежая еда, спасённая от утилизации. Вкусно и полезно для планеты!',
    impactTeaser: (co2, water) =>
      `Спасение сэкономит ~${co2} кг CO₂ и ~${water} л воды`,
    youSave: (amount) => `Вы экономите $${amount}`,
    includesTaxes: 'Включая налоги',
    reserveNow: 'Забронировать',
    reserved: 'Забронировано!',
    qrMessage: (restaurant, time) =>
      `Покажите QR в «${restaurant}» до ${time}, чтобы забрать еду.`,
    yourRescueImpact: 'Ваш вклад',
    co2Avoided: 'CO₂ предотвращено',
    waterSaved: 'воды сэкономлено',
    youSavedStat: 'ваша экономия',
    collectToday: 'Забрать сегодня',
    pickupWindow: (start, end) => `С ${start} до ${end}`,
    away: 'от вас',
  },
  categories: {
    All: 'Все',
    Meals: 'Блюда',
    'Baked Goods': 'Выпечка',
    Groceries: 'Продукты',
    Vegan: 'Веганское',
    'Surprise Bags': 'Сюрприз-пакеты',
  },
  mobile: {
    tabFeed: 'Лента',
    tabFavorites: 'Избранное',
    tabSettings: 'Настройки',
    searchPlaceholder: 'Поиск ресторанов, еды...',
    noFavorites: 'Нет избранных',
    noFavoritesHint: 'Нажмите ♥ на предложении, чтобы сохранить.',
    settingsLanguage: 'Язык',
    settingsAbout: 'О приложении',
    settingsVersion: 'Версия',
    settingsAppName: 'LastBite',
    settingsTagline: 'Экономьте еду, экономьте деньги',
    notificationTitle: 'Напоминание о самовывозе',
    notificationBody: (restaurant) =>
      `Самовывоз в «${restaurant}» заканчивается через 30 минут!`,
    notificationPermissionDenied:
      'Включите уведомления в Настройках, чтобы получать напоминания.',
  },
};
```

- [ ] **Step 6: Create i18n/index.ts (Context + useT + setLocale)**

Create `i18n/index.ts`:
```ts
import React, { createContext, useContext, useEffect, useReducer } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Locale, MobileTranslations } from './types';
import { en } from './en';
import { ru } from './ru';

const DICTIONARIES: Record<Locale, MobileTranslations> = { en, ru };
const STORAGE_KEY = 'lastbite-locale';
const DEFAULT_LOCALE: Locale = 'ru'; // intentionally Russian for Tashkent users

interface LocaleState {
  locale: Locale;
  t: MobileTranslations;
  loaded: boolean;
}

type LocaleAction =
  | { type: 'SET_LOCALE'; locale: Locale }
  | { type: 'LOADED'; locale: Locale };

function localeReducer(state: LocaleState, action: LocaleAction): LocaleState {
  switch (action.type) {
    case 'SET_LOCALE':
      return { locale: action.locale, t: DICTIONARIES[action.locale], loaded: true };
    case 'LOADED':
      return { locale: action.locale, t: DICTIONARIES[action.locale], loaded: true };
    default:
      return state;
  }
}

interface LocaleContextValue {
  locale: Locale;
  t: MobileTranslations;
  setLocale: (locale: Locale) => void;
  loaded: boolean;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(localeReducer, {
    locale: DEFAULT_LOCALE,
    t: DICTIONARIES[DEFAULT_LOCALE],
    loaded: false,
  });

  // Load persisted locale on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      const locale = (stored === 'en' || stored === 'ru') ? stored : DEFAULT_LOCALE;
      dispatch({ type: 'LOADED', locale });
    });
  }, []);

  const setLocale = async (locale: Locale) => {
    dispatch({ type: 'SET_LOCALE', locale });
    await AsyncStorage.setItem(STORAGE_KEY, locale);
  };

  return (
    <LocaleContext.Provider value={{ ...state, setLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useT(): MobileTranslations {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useT must be used inside LocaleProvider');
  return ctx.t;
}

export function useLocale(): { locale: Locale; setLocale: (l: Locale) => void; loaded: boolean } {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used inside LocaleProvider');
  return { locale: ctx.locale, setLocale: ctx.setLocale, loaded: ctx.loaded };
}
```

- [ ] **Step 7: Run pluralRu test to verify it passes**

```bash
npx jest __tests__/pluralRu.test.ts
```

Expected: PASS (3 test cases, all green)

- [ ] **Step 8: Commit**

```bash
git add i18n/ __tests__/pluralRu.test.ts
git commit -m "feat: add i18n system with EN/RU dictionaries, LocaleProvider, and pluralRu"
```

> **What might be missing?**
> - The `loaded` flag prevents flickering when locale is being read from AsyncStorage. Make sure the root layout doesn't render children until `loaded === true` (handled in Task 9).

---

## Task 5: Stores

**Files:**
- Create: `lib/favorites-store.ts`
- Create: `lib/search-store.ts`
- Create: `lib/marketplace-store.ts`
- Create: `lib/locale-store.ts` (re-exports from i18n — locale is already in i18n/index.ts)
- Create: `__tests__/favorites-store.test.ts`

- [ ] **Step 1: Write failing tests for favorites reducer**

Create `__tests__/favorites-store.test.ts`:
```ts
import { favoritesReducer } from '@/lib/favorites-store';

describe('favoritesReducer', () => {
  it('adds an id when toggling a non-favorite', () => {
    const next = favoritesReducer([], { type: 'TOGGLE', id: 'offer-1' });
    expect(next).toEqual(['offer-1']);
  });

  it('removes an id when toggling an existing favorite', () => {
    const next = favoritesReducer(
      ['offer-1', 'offer-2'],
      { type: 'TOGGLE', id: 'offer-1' }
    );
    expect(next).toEqual(['offer-2']);
  });

  it('loads favorites from storage', () => {
    const next = favoritesReducer([], { type: 'LOAD', ids: ['a', 'b', 'c'] });
    expect(next).toEqual(['a', 'b', 'c']);
  });

  it('is idempotent — toggling twice returns to original state', () => {
    const state1 = favoritesReducer([], { type: 'TOGGLE', id: 'x' });
    const state2 = favoritesReducer(state1, { type: 'TOGGLE', id: 'x' });
    expect(state2).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/favorites-store.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/favorites-store'`

- [ ] **Step 3: Implement favorites-store.ts**

Create `lib/favorites-store.ts`:
```ts
import React, { createContext, useContext, useEffect, useReducer } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'lastbite-favorites';

type FavoritesAction =
  | { type: 'TOGGLE'; id: string }
  | { type: 'LOAD'; ids: string[] };

export function favoritesReducer(state: string[], action: FavoritesAction): string[] {
  switch (action.type) {
    case 'TOGGLE':
      return state.includes(action.id)
        ? state.filter((id) => id !== action.id)
        : [...state, action.id];
    case 'LOAD':
      return action.ids;
    default:
      return state;
  }
}

interface FavoritesContextValue {
  favorites: string[];
  toggleFavorite: (id: string) => void;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favorites, dispatch] = useReducer(favoritesReducer, []);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      try {
        const ids = stored ? JSON.parse(stored) : [];
        dispatch({ type: 'LOAD', ids: Array.isArray(ids) ? ids : [] });
      } catch {
        dispatch({ type: 'LOAD', ids: [] });
      }
    });
  }, []);

  const toggleFavorite = (id: string) => {
    dispatch({ type: 'TOGGLE', id });
  };

  // Write to AsyncStorage whenever favorites state changes (avoids stale closure)
  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  }, [favorites]);

  return (
    <FavoritesContext.Provider value={{ favorites, toggleFavorite }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites(): string[] {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be inside FavoritesProvider');
  return ctx.favorites;
}

export function useToggleFavorite(): (id: string) => void {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useToggleFavorite must be inside FavoritesProvider');
  return ctx.toggleFavorite;
}
```

- [ ] **Step 4: Create search-store.ts (in-memory)**

Create `lib/search-store.ts`:
```ts
import React, { createContext, useContext, useReducer } from 'react';

type SearchAction = { type: 'SET'; query: string };

function searchReducer(_: string, action: SearchAction): string {
  return action.type === 'SET' ? action.query : _;
}

interface SearchContextValue {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}

const SearchContext = createContext<SearchContextValue | null>(null);

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [searchQuery, dispatch] = useReducer(searchReducer, '');
  const setSearchQuery = (q: string) => dispatch({ type: 'SET', query: q });

  return (
    <SearchContext.Provider value={{ searchQuery, setSearchQuery }}>
      {children}
    </SearchContext.Provider>
  );
}

export function useSearchQuery(): string {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error('useSearchQuery must be inside SearchProvider');
  return ctx.searchQuery;
}

export function useSetSearchQuery(): (q: string) => void {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error('useSetSearchQuery must be inside SearchProvider');
  return ctx.setSearchQuery;
}
```

- [ ] **Step 5: Create marketplace-store.ts (no-op stub)**

Create `lib/marketplace-store.ts`:
```ts
import type { Offer } from '@/types/offer';

/**
 * MVP stub — always returns [].
 * When Supabase is added, replace this hook body with a query
 * to the published_offers table. The hook signature stays the same.
 *
 * TODO(supabase): Replace stub with real Supabase query.
 */
export function usePublishedSellerOffers(): Offer[] {
  return [];
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npx jest __tests__/favorites-store.test.ts
```

Expected: PASS (4 tests)

- [ ] **Step 7: Commit**

```bash
git add lib/ __tests__/favorites-store.test.ts
git commit -m "feat: add favorites, search, and marketplace stores with Context+useReducer"
```

> **What might be missing?**
> - The `toggleFavorite` function computes the next state locally to avoid a stale closure when writing to AsyncStorage. This is correct but can drift if the state is modified elsewhere between dispatch and the write. For MVP this is fine; at scale, move the AsyncStorage write into a `useEffect` that reacts to `favorites` changes.

---

## Task 6: Filters Utility

**Files:**
- Create: `lib/filters.ts`
- Create: `__tests__/filters.test.ts`

- [ ] **Step 1: Write failing filter tests**

Create `__tests__/filters.test.ts`:
```ts
import { filterAndSort } from '@/lib/filters';
import { OFFERS } from '@/data/offers';
import type { Offer } from '@/types/offer';

const offers = OFFERS;

describe('filterAndSort — category filter', () => {
  it('returns all offers when category is "All"', () => {
    const result = filterAndSort(offers, { category: 'All', searchQuery: '', sortMode: 'expiry' });
    expect(result).toHaveLength(offers.length);
  });

  it('filters to only Meals offers', () => {
    const result = filterAndSort(offers, { category: 'Meals', searchQuery: '', sortMode: 'expiry' });
    expect(result.every((o) => o.category === 'Meals')).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns empty array for category with no matches', () => {
    const noCategory = filterAndSort(
      [{ ...offers[0], category: 'Meals' }],
      { category: 'Vegan', searchQuery: '', sortMode: 'expiry' }
    );
    expect(noCategory).toHaveLength(0);
  });
});

describe('filterAndSort — search filter', () => {
  it('filters by restaurant name (case-insensitive)', () => {
    const result = filterAndSort(offers, { category: 'All', searchQuery: 'tokyo', sortMode: 'expiry' });
    expect(result.some((o) => o.restaurant === 'Tokyo Bites')).toBe(true);
  });

  it('filters by offer title', () => {
    const result = filterAndSort(offers, { category: 'All', searchQuery: 'pasta', sortMode: 'expiry' });
    expect(result.some((o) => o.title.toLowerCase().includes('pasta'))).toBe(true);
  });

  it('returns empty for no match', () => {
    const result = filterAndSort(offers, { category: 'All', searchQuery: 'zzzzzzzz', sortMode: 'expiry' });
    expect(result).toHaveLength(0);
  });
});

describe('filterAndSort — favorites filter', () => {
  it('returns only favorited offers', () => {
    const favoriteIds = [offers[0].id, offers[2].id];
    const result = filterAndSort(offers, {
      category: 'All',
      searchQuery: '',
      sortMode: 'expiry',
      showFavoritesOnly: true,
      favoriteIds,
    });
    expect(result).toHaveLength(2);
    expect(result.map((o) => o.id)).toEqual(expect.arrayContaining(favoriteIds));
  });

  it('returns all when showFavoritesOnly is false', () => {
    const result = filterAndSort(offers, {
      category: 'All',
      searchQuery: '',
      sortMode: 'expiry',
      showFavoritesOnly: false,
      favoriteIds: [offers[0].id],
    });
    expect(result).toHaveLength(offers.length);
  });

  it('returns empty array when showFavoritesOnly is true with empty favoriteIds', () => {
    const result = filterAndSort(offers, {
      category: 'All',
      searchQuery: '',
      sortMode: 'expiry',
      showFavoritesOnly: true,
      favoriteIds: [],
    });
    expect(result).toHaveLength(0);
  });
});

describe('filterAndSort — sort modes', () => {
  it('sorts by price ascending', () => {
    const result = filterAndSort(offers, { category: 'All', searchQuery: '', sortMode: 'price' });
    for (let i = 1; i < result.length; i++) {
      expect(result[i].newPrice).toBeGreaterThanOrEqual(result[i - 1].newPrice);
    }
  });

  it('sorts by discount descending', () => {
    const result = filterAndSort(offers, { category: 'All', searchQuery: '', sortMode: 'discount' });
    for (let i = 1; i < result.length; i++) {
      expect(result[i].discount).toBeLessThanOrEqual(result[i - 1].discount);
    }
  });

  it('sorts by distance ascending', () => {
    const result = filterAndSort(offers, { category: 'All', searchQuery: '', sortMode: 'distance' });
    for (let i = 1; i < result.length; i++) {
      const prev = parseFloat(result[i - 1].distance);
      const curr = parseFloat(result[i].distance);
      expect(curr).toBeGreaterThanOrEqual(prev);
    }
  });

  it('sorts by expiry ascending (minutes from midnight)', () => {
    const result = filterAndSort(offers, { category: 'All', searchQuery: '', sortMode: 'expiry' });
    function toMins(t: string) {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    }
    for (let i = 1; i < result.length; i++) {
      expect(toMins(result[i].endTime)).toBeGreaterThanOrEqual(toMins(result[i - 1].endTime));
    }
  });
});

describe('filterAndSort — edge cases', () => {
  it('returns empty array for empty input', () => {
    expect(filterAndSort([], { category: 'All', searchQuery: '', sortMode: 'expiry' })).toEqual([]);
  });

  it('combines category and search filters', () => {
    const result = filterAndSort(offers, { category: 'Vegan', searchQuery: 'green', sortMode: 'price' });
    expect(result.every((o) => o.category === 'Vegan')).toBe(true);
    expect(result.some((o) => o.restaurant.toLowerCase().includes('green'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/filters.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/filters'`

- [ ] **Step 3: Implement filters.ts**

Create `lib/filters.ts`:
```ts
import type { Offer, OfferFilterCategory } from '@/types/offer';

export type SortMode = 'expiry' | 'price' | 'discount' | 'distance';

export interface FilterOptions {
  category: OfferFilterCategory;
  searchQuery: string;
  sortMode: SortMode;
  showFavoritesOnly?: boolean;
  favoriteIds?: string[];
}

function parseMinutes(endTime: string): number {
  const [h, m] = endTime.split(':').map(Number);
  return h * 60 + m;
}

function parseDistance(distance: string): number {
  return parseFloat(distance);
}

export function filterAndSort(offers: Offer[], options: FilterOptions): Offer[] {
  const { category, searchQuery, sortMode, showFavoritesOnly, favoriteIds } = options;

  let result = offers;

  // 1. Category filter
  if (category !== 'All') {
    result = result.filter((o) => o.category === category);
  }

  // 2. Favorites filter (Favorites screen only)
  if (showFavoritesOnly && favoriteIds) {
    const favSet = new Set(favoriteIds);
    result = result.filter((o) => favSet.has(o.id));
  }

  // 3. Search filter
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    result = result.filter(
      (o) =>
        o.title.toLowerCase().includes(q) ||
        o.restaurant.toLowerCase().includes(q) ||
        o.category.toLowerCase().includes(q)
    );
  }

  // 4. Sort
  const sorted = [...result];
  switch (sortMode) {
    case 'expiry':
      sorted.sort((a, b) => parseMinutes(a.endTime) - parseMinutes(b.endTime));
      break;
    case 'price':
      sorted.sort((a, b) => a.newPrice - b.newPrice);
      break;
    case 'discount':
      sorted.sort((a, b) => b.discount - a.discount);
      break;
    case 'distance':
      sorted.sort((a, b) => parseDistance(a.distance) - parseDistance(b.distance));
      break;
  }

  return sorted;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/filters.test.ts
```

Expected: PASS (all test suites green)

- [ ] **Step 5: Commit**

```bash
git add lib/filters.ts __tests__/filters.test.ts
git commit -m "feat: add filterAndSort utility with full test coverage"
```

---

## Task 7: useCountdown Hook

**Files:**
- Create: `hooks/useCountdown.ts`
- Create: `__tests__/useCountdown.test.ts`

- [ ] **Step 1: Write failing test for countdown calculation logic**

Create `__tests__/useCountdown.test.ts`:
```ts
import { calcCountdown } from '@/hooks/useCountdown';

// Helper: build a fixed "now" at a given HH:MM
function at(h: number, m: number): Date {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

describe('calcCountdown', () => {
  it('returns hours + minutes when more than 60 min remain', () => {
    // endTime 20:00, now 17:30 → 2h 30m remain
    const result = calcCountdown('20:00', at(17, 30));
    expect(result.hours).toBe(2);
    expect(result.mins).toBe(30);
    expect(result.urgent).toBe(false);
  });

  it('returns 0 hours when under 60 min remain', () => {
    // endTime 20:00, now 19:45 → 0h 15m
    const result = calcCountdown('20:00', at(19, 45));
    expect(result.hours).toBe(0);
    expect(result.mins).toBe(15);
  });

  it('marks urgent when under 30 min remain', () => {
    const result = calcCountdown('20:00', at(19, 31));
    expect(result.urgent).toBe(true);
  });

  it('wraps to next day when endTime has passed', () => {
    // endTime 08:00, now 22:00 → wraps: ~10h remain
    const result = calcCountdown('08:00', at(22, 0));
    expect(result.hours).toBeGreaterThan(0);
    expect(result.urgent).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/useCountdown.test.ts
```

Expected: FAIL — `Cannot find module '@/hooks/useCountdown'`

- [ ] **Step 3: Implement useCountdown.ts**

Create `hooks/useCountdown.ts`:
```ts
import { useEffect, useState } from 'react';

export interface CountdownResult {
  hours: number;
  mins: number;
  urgent: boolean;
}

// Pure calculation — exported so it can be tested without React
export function calcCountdown(endTime: string, now: Date = new Date()): CountdownResult {
  const end = new Date(now);
  const [h, m] = endTime.split(':').map(Number);
  end.setHours(h, m, 0, 0);

  // Wrap to next day if endTime has already passed today
  if (end.getTime() <= now.getTime()) {
    end.setDate(end.getDate() + 1);
  }

  const diff = end.getTime() - now.getTime();
  const totalMins = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;

  return { hours, mins, urgent: diff < 30 * 60 * 1000 };
}

export function useCountdown(endTime: string): CountdownResult & { label: string } {
  const [result, setResult] = useState<CountdownResult>(() => calcCountdown(endTime));

  useEffect(() => {
    function tick() {
      setResult(calcCountdown(endTime));
    }
    tick();
    const interval = setInterval(tick, 30_000);
    return () => clearInterval(interval);
  }, [endTime]);

  const label =
    result.hours > 0
      ? `${result.hours}h ${result.mins}m`
      : `${result.mins}m`;

  return { ...result, label };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/useCountdown.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add hooks/useCountdown.ts __tests__/useCountdown.test.ts
git commit -m "feat: add useCountdown hook with isolated calcCountdown tests"
```

---

## Task 8: UI Primitives

**Files:**
- Create: `components/ui/Badge.tsx`
- Create: `components/ui/Button.tsx`
- Create: `components/ui/Card.tsx`
- Create: `components/ui/IconButton.tsx`

- [ ] **Step 1: Create Badge component**

Create `components/ui/Badge.tsx`:
```tsx
import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useColors } from '@/hooks/useColors';

interface BadgeProps {
  label: string;
  color?: string;
  bg?: string;
  style?: ViewStyle;
}

export function Badge({ label, color, bg, style }: BadgeProps) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.container,
        { backgroundColor: bg ?? colors.muted },
        style,
      ]}
    >
      <Text style={[styles.label, { color: color ?? colors.mutedForeground }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
```

- [ ] **Step 2: Create Button component**

Create `components/ui/Button.tsx`:
```tsx
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type ViewStyle,
} from 'react-native';
import { useColors } from '@/hooks/useColors';

interface ButtonProps extends PressableProps {
  label: string;
  variant?: 'primary' | 'outline' | 'ghost';
  loading?: boolean;
  style?: ViewStyle;
}

export function Button({
  label,
  variant = 'primary',
  loading = false,
  style,
  disabled,
  ...rest
}: ButtonProps) {
  const colors = useColors();

  const isPrimary = variant === 'primary';
  const isOutline = variant === 'outline';

  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        isPrimary && { backgroundColor: colors.primary },
        isOutline && { borderWidth: 1.5, borderColor: colors.primary },
        (pressed || disabled) && styles.pressed,
        style,
      ]}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? '#fff' : colors.primary} />
      ) : (
        <Text
          style={[
            styles.label,
            isPrimary && { color: '#fff' },
            isOutline && { color: colors.primary },
            variant === 'ghost' && { color: colors.mutedForeground },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  pressed: { opacity: 0.75 },
  label: { fontSize: 16, fontWeight: '600' },
});
```

- [ ] **Step 3: Create Card component**

Create `components/ui/Card.tsx`:
```tsx
import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { useColors } from '@/hooks/useColors';

export function Card({ style, children, ...rest }: ViewProps) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    // iOS shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
});
```

- [ ] **Step 4: Create IconButton component**

Create `components/ui/IconButton.tsx`:
```tsx
import React from 'react';
import { Pressable, StyleSheet, type PressableProps, type ViewStyle } from 'react-native';

interface IconButtonProps extends PressableProps {
  style?: ViewStyle;
  size?: number;
  children: React.ReactNode;
}

export function IconButton({ children, style, size = 36, ...rest }: IconButtonProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        { width: size, height: size, borderRadius: size / 2 },
        pressed && styles.pressed,
        style,
      ]}
      {...rest}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  pressed: { opacity: 0.7 },
});
```

- [ ] **Step 5: Commit**

```bash
git add components/ui/
git commit -m "feat: add Badge, Button, Card, IconButton UI primitives"
```

---

## Task 9: Notifications

**Files:**
- Create: `lib/notifications.ts`

- [ ] **Step 1: Implement notifications utility**

Create `lib/notifications.ts`:
```ts
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'lastbite-notification-ids';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function loadNotificationIds(): Promise<Record<string, string>> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

async function saveNotificationIds(ids: Record<string, string>): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

/**
 * Request notification permission.
 * Returns true if granted, false otherwise.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * Schedule a local notification 30 minutes before endTime for an offer.
 * Cancels any existing notification for the same offer first.
 *
 * @param offerId - Unique offer ID (used to cancel later)
 * @param restaurant - Restaurant name (shown in notification body)
 * @param endTime - Pickup end time in "HH:MM" format
 * @param body - Localized notification body string
 * @param title - Localized notification title
 */
export async function schedulePickupReminder(
  offerId: string,
  restaurant: string,
  endTime: string,
  body: string,
  title: string,
): Promise<void> {
  // Cancel existing notification for this offer
  await cancelPickupReminder(offerId);

  const [h, m] = endTime.split(':').map(Number);
  const trigger = new Date();
  trigger.setHours(h, m, 0, 0);
  trigger.setTime(trigger.getTime() - 30 * 60 * 1000); // 30 min before

  // If trigger time is in the past, don't schedule
  if (trigger.getTime() <= Date.now()) return;

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger,
  });

  const ids = await loadNotificationIds();
  ids[offerId] = notificationId;
  await saveNotificationIds(ids);
}

/**
 * Cancel the scheduled notification for a specific offer.
 */
export async function cancelPickupReminder(offerId: string): Promise<void> {
  const ids = await loadNotificationIds();
  if (ids[offerId]) {
    await Notifications.cancelScheduledNotificationAsync(ids[offerId]);
    delete ids[offerId];
    await saveNotificationIds(ids);
  }
}

/**
 * On app launch: remove stale notification ID references.
 * Notifications that already fired won't be in the scheduled list.
 */
export async function cleanupExpiredNotifications(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const scheduledIds = new Set(scheduled.map((n) => n.identifier));
  const ids = await loadNotificationIds();
  const cleaned: Record<string, string> = {};
  for (const [offerId, notifId] of Object.entries(ids)) {
    if (scheduledIds.has(notifId)) cleaned[offerId] = notifId;
  }
  await saveNotificationIds(cleaned);
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/notifications.ts
git commit -m "feat: add local notification scheduling/cancellation with AsyncStorage tracking"
```

> **What might be missing?**
> - iOS simulator doesn't deliver local notifications — test on a real device.
> - If `endTime` wraps to next day (past midnight), the 30-min-before trigger calculation doesn't account for it. For MVP this is acceptable; most offers close before midnight.
> - `TODO(scale)`: When Supabase push notifications are added, this module becomes the adapter — swap `scheduleNotificationAsync` for `supabase.functions.invoke('send-push')`.

---

## Task 10: Root Layout & Context Providers

**Files:**
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Rewrite root layout with all providers**

Replace `app/_layout.tsx`:
```tsx
import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { LocaleProvider } from '@/i18n';
import { FavoritesProvider } from '@/lib/favorites-store';
import { SearchProvider } from '@/lib/search-store';
import { cleanupExpiredNotifications } from '@/lib/notifications';

export default function RootLayout() {
  const scheme = useColorScheme();

  useEffect(() => {
    // Clean up stale notification references on every app launch
    cleanupExpiredNotifications();
  }, []);

  return (
    <LocaleProvider>
      <FavoritesProvider>
        <SearchProvider>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="offer/[id]"
              options={{
                presentation: 'modal',
                headerShown: false,
              }}
            />
          </Stack>
        </SearchProvider>
      </FavoritesProvider>
    </LocaleProvider>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat: add root layout with all Context providers and modal stack config"
```

---

## Task 11: Tab Navigation

**Files:**
- Modify: `app/(tabs)/_layout.tsx`

- [ ] **Step 1: Configure 3-tab layout with icons and i18n labels**

Replace `app/(tabs)/_layout.tsx`:
```tsx
import { Tabs } from 'expo-router';
import { Utensils, Heart, Settings } from 'lucide-react-native';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/i18n';

export default function TabLayout() {
  const colors = useColors();
  const t = useT();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t.mobile.tabFeed,
          tabBarIcon: ({ color, size }) => (
            <Utensils color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: t.mobile.tabFavorites,
          tabBarIcon: ({ color, size }) => (
            <Heart color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t.mobile.tabSettings,
          tabBarIcon: ({ color, size }) => (
            <Settings color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/(tabs)/_layout.tsx
git commit -m "feat: add 3-tab navigation with localized labels and teal active color"
```

---

## Task 12: OffersMap Component

**Files:**
- Create: `components/OffersMap.tsx`

- [ ] **Step 1: Implement OffersMap with Apple Maps and bidirectional sync**

Create `components/OffersMap.tsx`:
```tsx
import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Callout, type Region } from 'react-native-maps';
import { Text } from 'react-native';
import type { Offer } from '@/types/offer';

const TASHKENT_REGION: Region = {
  latitude: 41.3111,
  longitude: 69.2797,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

interface OffersMapProps {
  offers: Offer[];
  activeOfferId: string | null;
  onMarkerPress: (offerId: string) => void;
  onCalloutPress: (offerId: string) => void;
  formatCalloutMeta: (offer: Offer) => string;
  height?: number;
}

export function OffersMap({
  offers,
  activeOfferId,
  onMarkerPress,
  onCalloutPress,
  formatCalloutMeta,
  height = 250,
}: OffersMapProps) {
  const mapRef = useRef<MapView>(null);

  // Auto-fit to markers when offers change
  useEffect(() => {
    if (!mapRef.current || offers.length === 0) return;
    const coords = offers.map((o) => ({
      latitude: o.location.lat,
      longitude: o.location.lng,
    }));
    if (offers.length === 1) {
      mapRef.current.animateToRegion({
        latitude: coords[0].latitude,
        longitude: coords[0].longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
    } else {
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 48, right: 48, bottom: 48, left: 48 },
        animated: true,
      });
    }
  }, [offers]);

  // Pan to active marker when selection changes
  useEffect(() => {
    if (!activeOfferId || !mapRef.current) return;
    const offer = offers.find((o) => o.id === activeOfferId);
    if (!offer) return;
    mapRef.current.animateToRegion({
      latitude: offer.location.lat,
      longitude: offer.location.lng,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    }, 300);
  }, [activeOfferId, offers]);

  return (
    <View style={{ height, borderRadius: 16, overflow: 'hidden' }}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={TASHKENT_REGION}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {offers.map((offer) => {
          const isActive = offer.id === activeOfferId;
          return (
            <Marker
              key={offer.id}
              coordinate={{
                latitude: offer.location.lat,
                longitude: offer.location.lng,
              }}
              onPress={() => onMarkerPress(offer.id)}
              pinColor={isActive ? '#0f766e' : '#16C79A'}
            >
              {/* Custom circular marker */}
              <View
                style={[
                  styles.marker,
                  isActive && styles.markerActive,
                ]}
              />
              <Callout onPress={() => onCalloutPress(offer.id)}>
                <View style={styles.callout}>
                  <Text style={styles.calloutTitle}>{offer.title}</Text>
                  <Text style={styles.calloutSub}>{offer.restaurant}</Text>
                  <Text style={styles.calloutMeta}>
                    {formatCalloutMeta(offer)}
                  </Text>
                </View>
              </Callout>
            </Marker>
          );
        })}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  marker: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#16C79A',
    borderWidth: 2,
    borderColor: '#fff',
  },
  markerActive: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#0f766e',
  },
  callout: {
    width: 200,
    padding: 8,
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  calloutSub: {
    fontSize: 12,
    color: '#71717A',
    marginTop: 2,
  },
  calloutMeta: {
    fontSize: 12,
    color: '#16C79A',
    fontWeight: '600',
    marginTop: 4,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add components/OffersMap.tsx
git commit -m "feat: add OffersMap with Apple Maps, custom markers, callouts, and bidirectional sync"
```

> **What might be missing?**
> - `showsUserLocation` requires `NSLocationWhenInUseUsageDescription` in `app.json` (already added in Task 1).
> - Custom `<View>` markers may not cluster well with many offers. For MVP the 10 seed offers are fine. `TODO(scale)`: Add `react-native-maps-marker-clustering` when offer count grows beyond ~50.

---

## Task 13: OfferCard Component

**Files:**
- Create: `components/OfferCard.tsx`

- [ ] **Step 1: Implement OfferCard for FlatList**

Create `components/OfferCard.tsx`:
```tsx
import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Heart, Clock, Star, MapPin } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import Animated, {
  FadeInDown,
} from 'react-native-reanimated';
import { Badge } from '@/components/ui/Badge';
import { IconButton } from '@/components/ui/IconButton';
import { useCountdown } from '@/hooks/useCountdown';
import { useFavorites, useToggleFavorite } from '@/lib/favorites-store';
import { useT } from '@/i18n';
import { useColors } from '@/hooks/useColors';
import type { Offer } from '@/types/offer';

interface OfferCardProps {
  offer: Offer;
  index: number;
  isActive?: boolean;
}

function StockBar({ qty }: { qty: number }) {
  const colors = useColors();
  const barColor = qty <= 2 ? colors.destructive : qty <= 4 ? colors.amber : colors.primary;
  const width = `${Math.min(100, (qty / 10) * 100)}%` as const;
  return (
    <View style={styles.stockBarBg}>
      <View style={[styles.stockBarFill, { width, backgroundColor: barColor }]} />
    </View>
  );
}

export function OfferCard({ offer, index, isActive }: OfferCardProps) {
  const t = useT();
  const colors = useColors();
  const router = useRouter();
  const favorites = useFavorites();
  const toggleFavorite = useToggleFavorite();
  const isFavorited = favorites.includes(offer.id);
  const { label: countdownLabel, urgent } = useCountdown(offer.endTime);
  const isLowStock = (offer.quantityAvailable ?? 99) <= 3;

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 40).duration(250)}
      style={[
        styles.wrapper,
        { backgroundColor: colors.card, borderColor: isActive ? colors.primary : colors.border },
        isActive && { borderWidth: 2 },
      ]}
    >
      <Pressable onPress={() => router.push(`/offer/${offer.id}`)}>
        {/* Image */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: offer.image }}
            style={styles.image}
            resizeMode="cover"
          />
          {/* Badges — top right */}
          <View style={styles.badgesTopRight}>
            <Badge
              label={`-${offer.discount}%`}
              bg={colors.secondary}
              color="#fff"
            />
            {offer.isSurpriseBag && (
              <Badge
                label={t.offer.surprise}
                bg={colors.destructive}
                color="#fff"
                style={{ marginTop: 4 }}
              />
            )}
            {isLowStock && (
              <Badge
                label={t.offer.onlyLeft(offer.quantityAvailable!)}
                bg={colors.amber}
                color="#fff"
                style={{ marginTop: 4 }}
              />
            )}
          </View>
          {/* Favorite — top left */}
          <IconButton
            style={styles.favoriteBtn}
            onPress={() => toggleFavorite(offer.id)}
            accessibilityLabel={
              isFavorited ? t.offer.removeFromFavorites : t.offer.addToFavorites
            }
          >
            <Heart
              size={16}
              color={isFavorited ? '#FF6B6B' : '#fff'}
              fill={isFavorited ? '#FF6B6B' : 'transparent'}
            />
          </IconButton>
          {/* Countdown — bottom left */}
          <View
            style={[
              styles.countdown,
              { backgroundColor: urgent ? 'rgba(220,38,38,0.8)' : 'rgba(0,0,0,0.6)' },
            ]}
          >
            <Clock size={12} color={urgent ? '#fff' : colors.secondary} />
            <Text style={styles.countdownText}>
              {countdownLabel
                ? t.offer.countdown(countdownLabel)
                : `${t.offer.collectBy} ${offer.endTime}`}
            </Text>
          </View>
        </View>

        {/* Card body */}
        <View style={styles.body}>
          <Text style={[styles.restaurant, { color: colors.mutedForeground }]}>
            {offer.restaurant.toUpperCase()}
          </Text>
          <View style={styles.ratingRow}>
            <Star size={12} color={colors.secondary} fill={colors.secondary} />
            <Text style={[styles.rating, { color: colors.foreground }]}>
              {offer.rating}
            </Text>
          </View>
          <Text
            style={[styles.title, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {offer.title}
          </Text>

          {offer.quantityAvailable != null && (
            <View style={styles.stockRow}>
              <Text style={[styles.stockLabel, { color: colors.mutedForeground }]}>
                {t.offer.portionsLeft(offer.quantityAvailable)}
              </Text>
              <StockBar qty={offer.quantityAvailable} />
            </View>
          )}

          <View style={styles.priceRow}>
            <View style={styles.priceGroup}>
              <Text style={[styles.newPrice, { color: colors.primary }]}>
                ${offer.newPrice.toFixed(2)}
              </Text>
              <Text style={[styles.oldPrice, { color: colors.mutedForeground }]}>
                ${offer.oldPrice.toFixed(2)}
              </Text>
            </View>
            <View style={styles.distanceBadge}>
              <MapPin size={12} color={colors.mutedForeground} />
              <Text style={[styles.distance, { color: colors.mutedForeground }]}>
                {offer.distance}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 16,
    overflow: 'hidden',
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    borderWidth: 1,
  },
  imageContainer: { height: 200, position: 'relative' },
  image: { width: '100%', height: '100%' },
  badgesTopRight: { position: 'absolute', top: 10, right: 10 },
  favoriteBtn: { position: 'absolute', top: 10, left: 10 },
  countdown: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  countdownText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  body: { padding: 12 },
  restaurant: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  rating: { fontSize: 12, fontWeight: '500' },
  title: { fontSize: 16, fontWeight: '600', marginTop: 4 },
  stockRow: { marginTop: 8, gap: 4 },
  stockLabel: { fontSize: 12 },
  stockBarBg: { height: 3, backgroundColor: '#E4E4E7', borderRadius: 2 },
  stockBarFill: { height: 3, borderRadius: 2 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  priceGroup: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  newPrice: { fontSize: 20, fontWeight: '700' },
  oldPrice: { fontSize: 14, textDecorationLine: 'line-through' },
  distanceBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  distance: { fontSize: 12 },
});
```

- [ ] **Step 2: Commit**

```bash
git add components/OfferCard.tsx
git commit -m "feat: add OfferCard with countdown, badges, favorites, animated entrance"
```

---

## Task 14: Feed Screen

**Files:**
- Modify: `app/(tabs)/index.tsx`

- [ ] **Step 1: Implement the Feed screen**

Replace `app/(tabs)/index.tsx`:
```tsx
import React, { useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Search, ChevronDown } from 'lucide-react-native';
import { OFFERS, OFFER_FILTERS } from '@/data/offers';
import { usePublishedSellerOffers } from '@/lib/marketplace-store';
import { filterAndSort, type SortMode } from '@/lib/filters';
import { useSearchQuery, useSetSearchQuery } from '@/lib/search-store';
import { useFavorites } from '@/lib/favorites-store';
import { useT } from '@/i18n';
import { useColors } from '@/hooks/useColors';
import { OfferCard } from '@/components/OfferCard';
import { OffersMap } from '@/components/OffersMap';
import type { Offer, OfferFilterCategory } from '@/types/offer';

export default function FeedScreen() {
  const t = useT();
  const colors = useColors();
  const searchQuery = useSearchQuery();
  const setSearchQuery = useSetSearchQuery();
  const favorites = useFavorites();
  const publishedOffers = usePublishedSellerOffers();
  const flatListRef = useRef<FlatList<Offer>>(null);

  const [activeCategory, setActiveCategory] = useState<OfferFilterCategory>('All');
  const [sortMode, setSortMode] = useState<SortMode>('expiry');
  const [activeOfferId, setActiveOfferId] = useState<string | null>(null);
  const [showSortMenu, setShowSortMenu] = useState(false);

  const allOffers = useMemo(
    () => [...publishedOffers, ...OFFERS],
    [publishedOffers]
  );

  const sortedOffers = useMemo(
    () => filterAndSort(allOffers, { category: activeCategory, searchQuery, sortMode }),
    [allOffers, activeCategory, searchQuery, sortMode]
  );

  const handleMarkerPress = (offerId: string) => {
    setActiveOfferId(offerId);
    const idx = sortedOffers.findIndex((o) => o.id === offerId);
    if (idx >= 0) flatListRef.current?.scrollToIndex({ index: idx, animated: true });
  };

  const sortLabels: Record<SortMode, string> = {
    expiry: t.home.sort.expiry,
    price: t.home.sort.price,
    discount: t.home.sort.discount,
    distance: t.home.sort.distance,
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.logo, { color: colors.primary }]}>LastBite</Text>
        <View style={[styles.searchBar, { backgroundColor: colors.muted }]}>
          <Search size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder={t.mobile.searchPlaceholder}
            placeholderTextColor={colors.mutedForeground}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
        </View>
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        <OffersMap
          offers={sortedOffers}
          activeOfferId={activeOfferId}
          onMarkerPress={handleMarkerPress}
          onCalloutPress={(id) => setActiveOfferId(id)}
          formatCalloutMeta={(offer) =>
            `${t.offer.youSave((offer.oldPrice - offer.newPrice).toFixed(2))} · ${t.offer.collectBy} ${offer.endTime}`
          }
          height={250}
        />
      </View>

      {/* Filter chips + sort row */}
      <View style={[styles.controlsRow, { borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
          {OFFER_FILTERS.map((cat) => {
            const isActive = cat === activeCategory;
            return (
              <Pressable
                key={cat}
                onPress={() => setActiveCategory(cat)}
                style={[
                  styles.chip,
                  { borderColor: isActive ? colors.primary : colors.border },
                  isActive && { backgroundColor: colors.primary },
                ]}
              >
                <Text
                  style={[
                    styles.chipLabel,
                    { color: isActive ? '#fff' : colors.mutedForeground },
                  ]}
                >
                  {t.categories[cat as keyof typeof t.categories] ?? cat}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Sort dropdown */}
        <View style={styles.sortArea}>
          <Pressable
            style={[styles.sortPill, { borderColor: colors.border }]}
            onPress={() => setShowSortMenu((v) => !v)}
          >
            <Text style={[styles.sortLabel, { color: colors.foreground }]}>
              {sortLabels[sortMode]}
            </Text>
            <ChevronDown size={14} color={colors.mutedForeground} />
          </Pressable>
          {showSortMenu && (
            <View style={[styles.sortMenu, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {(Object.keys(sortLabels) as SortMode[]).map((mode) => (
                <Pressable
                  key={mode}
                  onPress={() => { setSortMode(mode); setShowSortMenu(false); }}
                  style={styles.sortMenuItem}
                >
                  <Text style={[styles.sortMenuLabel, { color: colors.foreground }]}>
                    {sortLabels[mode]}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* Offer count */}
      <Text style={[styles.offerCount, { color: colors.mutedForeground }]}>
        {t.home.offersShowing(sortedOffers.length)}
      </Text>

      {/* Offer list */}
      <FlatList
        ref={flatListRef}
        data={sortedOffers}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <OfferCard
            offer={item}
            index={index}
            isActive={item.id === activeOfferId}
          />
        )}
        onScrollToIndexFailed={() => {}}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {searchQuery
                ? t.home.noOffersSearch(searchQuery)
                : t.home.noOffersCategory}
            </Text>
            <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
              {t.home.noOffersHint}
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    gap: 12,
    borderBottomWidth: 1,
  },
  logo: { fontSize: 20, fontWeight: '700', letterSpacing: -0.5 },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 38,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14 },
  mapContainer: { marginHorizontal: 16, marginTop: 12, borderRadius: 16, overflow: 'hidden' },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingVertical: 8,
  },
  chips: { flex: 1, paddingLeft: 16 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 8,
  },
  chipLabel: { fontSize: 13, fontWeight: '500' },
  sortArea: { paddingRight: 16, position: 'relative' },
  sortPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sortLabel: { fontSize: 13, fontWeight: '500' },
  sortMenu: {
    position: 'absolute',
    right: 16,
    top: 44,
    borderWidth: 1,
    borderRadius: 10,
    zIndex: 100,
    minWidth: 160,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  sortMenuItem: { paddingHorizontal: 14, paddingVertical: 10 },
  sortMenuLabel: { fontSize: 14 },
  offerCount: { fontSize: 12, paddingHorizontal: 16, paddingVertical: 6 },
  emptyState: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 32 },
  emptyText: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  emptyHint: { fontSize: 14, textAlign: 'center', marginTop: 8 },
});
```

- [ ] **Step 2: Verify the app renders**

```bash
npx expo start --ios
```

Expected: Feed screen shows map + filter chips + offer cards. Tapping a chip filters the list.

- [ ] **Step 3: Commit**

```bash
git add app/(tabs)/index.tsx
git commit -m "feat: implement Feed screen with map, filter chips, sort, and FlatList"
```

> **What might be missing?**
> - The sort dropdown is a basic absolute-positioned overlay. On small screens it may clip. `TODO(polish)`: Replace with `@gorhom/bottom-sheet` or ActionSheet for a more native feel.
> - `onScrollToIndexFailed` is silently swallowed. If the active offer isn't visible, the scroll may not work. Good enough for MVP; add layout-aware fallback at scale.

---

## Task 15: Offer Detail Modal

**Files:**
- Create: `app/offer/[id].tsx`

- [ ] **Step 1: Create the directory and modal file**

```bash
mkdir -p app/offer
```

Create `app/offer/[id].tsx`:
```tsx
import React, { useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Heart, Share2, X, Clock, Leaf, CheckCircle2, Star, MapPin } from 'lucide-react-native';
import { OFFERS } from '@/data/offers';
import { usePublishedSellerOffers } from '@/lib/marketplace-store';
import { useFavorites, useToggleFavorite } from '@/lib/favorites-store';
import { schedulePickupReminder, cancelPickupReminder, requestNotificationPermission } from '@/lib/notifications';
import { useCountdown } from '@/hooks/useCountdown';
import { useT } from '@/i18n';
import { useColors } from '@/hooks/useColors';
import { Button } from '@/components/ui/Button';

export default function OfferDetailModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const t = useT();
  const colors = useColors();
  const favorites = useFavorites();
  const toggleFavorite = useToggleFavorite();
  const publishedOffers = usePublishedSellerOffers();
  const [isReserved, setIsReserved] = useState(false);

  // Find offer from all available offers
  const allOffers = [...publishedOffers, ...OFFERS];
  const offer = allOffers.find((o) => o.id === id);

  const { label: countdownLabel, urgent } = useCountdown(offer?.endTime ?? '23:59');
  const isFavorited = offer ? favorites.includes(offer.id) : false;

  if (!offer) {
    return (
      <View style={styles.notFound}>
        <Text style={{ color: colors.mutedForeground }}>Offer not found.</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: colors.primary }}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const savings = (offer.oldPrice - offer.newPrice).toFixed(2);
  const co2 = (offer.oldPrice * 0.2).toFixed(1);
  const water = Math.round((offer.oldPrice - offer.newPrice) * 35);

  const handleReserve = async () => {
    const granted = await requestNotificationPermission();
    if (!granted) {
      Alert.alert('', t.mobile.notificationPermissionDenied);
    }
    await schedulePickupReminder(
      offer.id,
      offer.restaurant,
      offer.endTime,
      t.mobile.notificationBody(offer.restaurant),
      t.mobile.notificationTitle,
    );
    setIsReserved(true);
  };

  const handleClose = async () => {
    if (isReserved) {
      await cancelPickupReminder(offer.id);
    }
    router.back();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Close button */}
      <Pressable onPress={handleClose} style={styles.closeBtn}>
        <X size={20} color={colors.foreground} />
      </Pressable>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Image */}
        <View style={styles.imageContainer}>
          <Image source={{ uri: offer.image }} style={styles.image} resizeMode="cover" />
          <View style={styles.imageActions}>
            <Pressable
              onPress={() => toggleFavorite(offer.id)}
              style={styles.imageActionBtn}
            >
              <Heart
                size={20}
                color={isFavorited ? '#FF6B6B' : '#fff'}
                fill={isFavorited ? '#FF6B6B' : 'transparent'}
              />
            </Pressable>
            <Pressable style={styles.imageActionBtn}>
              <Share2 size={20} color="#fff" />
            </Pressable>
          </View>
        </View>

        <View style={styles.content}>
          {isReserved ? (
            /* Reservation confirmation */
            <View style={styles.reservedContainer}>
              <CheckCircle2 size={64} color={colors.primary} />
              <Text style={[styles.reservedTitle, { color: colors.foreground }]}>
                {t.offer.reserved}
              </Text>
              <Image
                source={{
                  uri: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${offer.id}-mock`,
                }}
                style={styles.qrCode}
                accessibilityLabel={t.offer.qrAlt}
              />
              <Text style={[styles.qrMessage, { color: colors.mutedForeground }]}>
                {t.offer.qrMessage(offer.restaurant, offer.endTime)}
              </Text>
              {/* Impact stats */}
              <View style={styles.impactGrid}>
                <View style={[styles.impactCard, { backgroundColor: colors.greenLight }]}>
                  <Text style={[styles.impactValue, { color: colors.green }]}>{co2} kg</Text>
                  <Text style={[styles.impactLabel, { color: colors.green }]}>
                    {t.offer.co2Avoided}
                  </Text>
                </View>
                <View style={[styles.impactCard, { backgroundColor: '#EFF6FF' }]}>
                  <Text style={[styles.impactValue, { color: '#3B82F6' }]}>{water}L</Text>
                  <Text style={[styles.impactLabel, { color: '#3B82F6' }]}>
                    {t.offer.waterSaved}
                  </Text>
                </View>
                <View style={[styles.impactCard, { backgroundColor: colors.amberLight }]}>
                  <Text style={[styles.impactValue, { color: colors.amber }]}>${savings}</Text>
                  <Text style={[styles.impactLabel, { color: colors.amber }]}>
                    {t.offer.youSavedStat}
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            /* Offer details */
            <>
              <Text style={[styles.restaurant, { color: colors.mutedForeground }]}>
                {offer.restaurant.toUpperCase()}
              </Text>
              <Text style={[styles.title, { color: colors.foreground }]}>{offer.title}</Text>
              <View style={styles.metaRow}>
                <Star size={13} color={colors.secondary} fill={colors.secondary} />
                <Text style={[styles.metaText, { color: colors.foreground }]}>
                  {offer.rating} ({offer.reviews})
                </Text>
                <MapPin size={13} color={colors.mutedForeground} />
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                  {offer.distance} {t.offer.away}
                </Text>
              </View>

              {/* Countdown */}
              <View
                style={[
                  styles.countdownBox,
                  {
                    backgroundColor: urgent ? '#FEF2F2' : colors.amberLight,
                    borderColor: urgent ? '#FECACA' : colors.amberBorder,
                  },
                ]}
              >
                <Clock size={16} color={urgent ? colors.destructive : colors.amber} />
                <View>
                  <Text
                    style={[
                      styles.countdownText,
                      { color: urgent ? colors.destructive : '#92400E' },
                    ]}
                  >
                    {t.offer.collectToday}
                    {countdownLabel ? ` · ${countdownLabel}` : ''}
                  </Text>
                  {offer.pickupStart && (
                    <Text style={[styles.pickupWindow, { color: '#A16207' }]}>
                      {t.offer.pickupWindow(offer.pickupStart, offer.endTime)}
                    </Text>
                  )}
                </View>
              </View>

              {/* Portions */}
              {offer.quantityAvailable != null && (
                <View style={[styles.portionsRow, { backgroundColor: colors.muted }]}>
                  <Text style={[styles.portionsLabel, { color: colors.foreground }]}>
                    {t.offer.portionsAvailable}
                  </Text>
                  <Text
                    style={[
                      styles.portionsValue,
                      {
                        color:
                          offer.quantityAvailable <= 2
                            ? colors.destructive
                            : offer.quantityAvailable <= 4
                            ? colors.amber
                            : colors.primary,
                      },
                    ]}
                  >
                    {offer.quantityAvailable}
                  </Text>
                </View>
              )}

              {/* Contents */}
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                {t.offer.whatYouMightGet}
              </Text>
              {offer.contents && offer.contents.length > 0 ? (
                offer.contents.map((item) => (
                  <Text key={item} style={[styles.contentItem, { color: colors.foreground }]}>
                    • {item}
                  </Text>
                ))
              ) : (
                <Text style={[styles.desc, { color: colors.mutedForeground }]}>
                  {offer.isSurpriseBag ? t.offer.surpriseBagDesc : t.offer.regularDesc}
                </Text>
              )}

              {/* Impact teaser */}
              <View style={[styles.impactTeaser, { backgroundColor: colors.greenLight }]}>
                <Leaf size={16} color={colors.green} />
                <Text style={[styles.impactTeaserText, { color: colors.green }]}>
                  {t.offer.impactTeaser(parseFloat(co2), water)}
                </Text>
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {/* Sticky footer — only when not reserved */}
      {!isReserved && (
        <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
          <View>
            <View style={styles.priceRow}>
              <Text style={[styles.newPrice, { color: colors.primary }]}>
                ${offer.newPrice.toFixed(2)}
              </Text>
              <Text style={[styles.oldPrice, { color: colors.mutedForeground }]}>
                ${offer.oldPrice.toFixed(2)}
              </Text>
            </View>
            <Text style={[styles.saveText, { color: colors.secondary }]}>
              {t.offer.youSave(savings)}
            </Text>
          </View>
          <Button
            label={t.offer.reserveNow}
            onPress={handleReserve}
            style={styles.reserveBtn}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  closeBtn: {
    position: 'absolute',
    top: 52,
    right: 16,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageContainer: { height: 250, position: 'relative' },
  image: { width: '100%', height: '100%' },
  imageActions: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    gap: 8,
  },
  imageActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { padding: 16 },
  restaurant: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
  title: { fontSize: 22, fontWeight: '700', marginTop: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  metaText: { fontSize: 13 },
  countdownBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
  },
  countdownText: { fontSize: 14, fontWeight: '600' },
  pickupWindow: { fontSize: 12, marginTop: 2 },
  portionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  portionsLabel: { fontSize: 14 },
  portionsValue: { fontSize: 18, fontWeight: '700' },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginTop: 20, marginBottom: 8 },
  contentItem: { fontSize: 14, lineHeight: 22 },
  desc: { fontSize: 14, lineHeight: 22 },
  impactTeaser: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
  },
  impactTeaserText: { flex: 1, fontSize: 14, lineHeight: 20 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
  },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  newPrice: { fontSize: 24, fontWeight: '700' },
  oldPrice: { fontSize: 16, textDecorationLine: 'line-through' },
  saveText: { fontSize: 13, fontWeight: '500', marginTop: 2 },
  reserveBtn: { flex: 1, marginLeft: 16 },
  // Reservation confirmation
  reservedContainer: { alignItems: 'center', paddingTop: 16 },
  reservedTitle: { fontSize: 24, fontWeight: '700', marginTop: 16 },
  qrCode: { width: 150, height: 150, marginTop: 20 },
  qrMessage: { fontSize: 14, textAlign: 'center', marginTop: 12, lineHeight: 20 },
  impactGrid: { flexDirection: 'row', gap: 12, marginTop: 24, flexWrap: 'wrap' },
  impactCard: {
    flex: 1,
    minWidth: 80,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  impactValue: { fontSize: 20, fontWeight: '700' },
  impactLabel: { fontSize: 11, textAlign: 'center', marginTop: 4 },
});
```

- [ ] **Step 2: Commit**

```bash
git add app/offer/
git commit -m "feat: add offer detail modal with reservation flow, QR code, and local notification"
```

---

## Task 16: Favorites Screen

**Files:**
- Create: `app/(tabs)/favorites.tsx`

- [ ] **Step 1: Implement Favorites screen**

Create `app/(tabs)/favorites.tsx`:
```tsx
import React, { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Heart } from 'lucide-react-native';
import { OFFERS } from '@/data/offers';
import { usePublishedSellerOffers } from '@/lib/marketplace-store';
import { filterAndSort } from '@/lib/filters';
import { useFavorites } from '@/lib/favorites-store';
import { useT } from '@/i18n';
import { useColors } from '@/hooks/useColors';
import { OfferCard } from '@/components/OfferCard';

export default function FavoritesScreen() {
  const t = useT();
  const colors = useColors();
  const favorites = useFavorites();
  const publishedOffers = usePublishedSellerOffers();

  const allOffers = useMemo(
    () => [...publishedOffers, ...OFFERS],
    [publishedOffers]
  );

  const favoriteOffers = useMemo(
    () =>
      filterAndSort(allOffers, {
        category: 'All',
        searchQuery: '',
        sortMode: 'expiry',
        showFavoritesOnly: true,
        favoriteIds: favorites,
      }),
    [allOffers, favorites]
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          {t.mobile.tabFavorites}
        </Text>
      </View>

      <FlatList
        data={favoriteOffers}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => <OfferCard offer={item} index={index} />}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 24, flexGrow: 1 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Heart size={48} color={colors.border} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              {t.mobile.noFavorites}
            </Text>
            <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
              {t.mobile.noFavoritesHint}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  title: { fontSize: 28, fontWeight: '700' },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptyHint: { fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 32 },
});
```

- [ ] **Step 2: Commit**

```bash
git add app/(tabs)/favorites.tsx
git commit -m "feat: add Favorites screen with empty state"
```

---

## Task 17: Settings Screen

**Files:**
- Create: `app/(tabs)/settings.tsx`

- [ ] **Step 1: Implement Settings screen**

Create `app/(tabs)/settings.tsx`:
```tsx
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { useT, useLocale } from '@/i18n';
import { useColors } from '@/hooks/useColors';
import type { Locale } from '@/i18n/types';

const LOCALES: { value: Locale; label: string }[] = [
  { value: 'ru', label: 'RU' },
  { value: 'en', label: 'EN' },
];

export default function SettingsScreen() {
  const t = useT();
  const colors = useColors();
  const { locale, setLocale } = useLocale();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          {t.mobile.tabSettings}
        </Text>
      </View>

      <View style={styles.body}>
        {/* Language section */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          {t.mobile.settingsLanguage.toUpperCase()}
        </Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.languagePill, { backgroundColor: colors.muted }]}>
            {LOCALES.map(({ value, label }) => {
              const isActive = locale === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setLocale(value)}
                  style={[
                    styles.langBtn,
                    isActive && { backgroundColor: colors.primary },
                  ]}
                >
                  <Text
                    style={[
                      styles.langLabel,
                      { color: isActive ? '#fff' : colors.mutedForeground },
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* About section */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          {t.mobile.settingsAbout.toUpperCase()}
        </Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.aboutRow}>
            <Text style={[styles.aboutLabel, { color: colors.foreground }]}>
              {t.mobile.settingsAppName}
            </Text>
            <Text style={[styles.aboutValue, { color: colors.mutedForeground }]}>
              {t.mobile.settingsTagline}
            </Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.aboutRow}>
            <Text style={[styles.aboutLabel, { color: colors.foreground }]}>
              {t.mobile.settingsVersion}
            </Text>
            <Text style={[styles.aboutValue, { color: colors.mutedForeground }]}>
              {Constants.expoConfig?.version ?? '1.0.0'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  title: { fontSize: 28, fontWeight: '700' },
  body: { padding: 16, gap: 8 },
  sectionLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.8, marginBottom: 6 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 24,
    padding: 16,
  },
  languagePill: {
    flexDirection: 'row',
    borderRadius: 999,
    padding: 3,
    alignSelf: 'flex-start',
  },
  langBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 999,
  },
  langLabel: { fontSize: 14, fontWeight: '600' },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  aboutLabel: { fontSize: 15 },
  aboutValue: { fontSize: 14 },
  divider: { height: 1, marginVertical: 8 },
});
```

- [ ] **Step 2: Commit**

```bash
git add app/(tabs)/settings.tsx
git commit -m "feat: add Settings screen with RU/EN language toggle and app version"
```

---

## Task 18: Final Verification

- [ ] **Step 1: Run full test suite**

```bash
npx jest --coverage
```

Expected: All tests pass. Coverage report shows `lib/filters.ts`, `hooks/useCountdown.ts`, and `i18n/ru.ts` well covered.

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Run on iOS simulator**

```bash
npx expo start --ios
```

Manual checks:
- [ ] Feed screen loads with map + cards
- [ ] Filter chips work (category filtering)
- [ ] Sort dropdown works (4 modes)
- [ ] Tapping an offer card opens detail modal
- [ ] "Reserve Now" → shows QR + impact stats
- [ ] Dismissing modal cancels the notification
- [ ] Heart button toggles favorites (persists on restart)
- [ ] Favorites tab shows saved offers, empty state when none
- [ ] Settings tab shows language toggle (RU/EN), switches language instantly
- [ ] Default language is Russian

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete LastBite iOS buyer app MVP

- Expo managed workflow, expo-router v3
- Apple Maps (MapKit), bidirectional card-map sync
- EN/RU i18n, Russian default, instant switching
- Favorites persisted in AsyncStorage
- Local pickup reminder notification
- Filter by category, search, sort by 4 modes
- Offer detail modal with reservation + QR code
"
```

---

## Open Questions & Scale Notes

These are gaps that won't block MVP but should be addressed before wider release:

| # | Issue | When to fix |
|---|-------|-------------|
| 1 | **Offer images**: Unsplash URLs are public but not cached. Expo `Image` (SDK 52+) has built-in disk caching — use `<Image>` from `expo-image` instead of `react-native` `Image`. | Before public launch |
| 2 | **iOS notification icon**: `assets/images/notification-icon.png` referenced in `app.json` but not created. Create a 96×96 teal PNG. | Before device testing |
| 3 | **Map clustering**: 10 seed offers are fine. At 50+ offers, markers overlap. Add `react-native-maps-marker-clustering`. | When offer count grows |
| 4 | **Sort dropdown on small screens**: May clip on iPhone SE. Replace with `@gorhom/bottom-sheet` ActionSheet. | Polish pass |
| 5 | **`endTime` next-day wrap for notifications**: If `endTime` is 08:00 and user reserves at 22:00, the 30-min trigger fires 7.5h later — correct, but `schedulePickupReminder` doesn't handle multi-day wrap explicitly. | Before production |
| 6 | **`toggleFavorite` AsyncStorage write**: Computes next state locally, which can drift under concurrent updates. Move write to a `useEffect` reacting to `favorites` state at scale. | Scale prep |
| 7 | **No error boundary**: A crash in `OfferCard` or `OffersMap` brings down the whole screen. Add an `ErrorBoundary` wrapper around the FlatList. | Production hardening |
| 8 | **Supabase integration point**: `lib/marketplace-store.ts` is a stub. Add a `TODO(supabase)` comment in every file that will change when real backend arrives. | Tracked in spec |

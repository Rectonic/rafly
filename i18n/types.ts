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

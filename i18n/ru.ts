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

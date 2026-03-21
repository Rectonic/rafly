import type { Translations } from "./types";

function pluralRu(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

export const ru: Translations = {
  nav: {
    search: "Поиск ресторанов, пекарен или конкретной еды...",
    location: "Ташкент, центр города",
    sellerCrm: "CRM продавца",
    sellerLogin: "Вход для продавца",
    signOut: "Выйти",
    favorites: "Избранное",
    openSellerCrm: "Открыть CRM продавца",
    openSellerAccess: "Открыть доступ продавца",
  },
  home: {
    badge: "Живая лента спасения",
    title: "Найдите ближайшие предложения лишней еды",
    subtitle:
      "Фильтруйте по категориям и смотрите рестораны прямо на карте. Наведите на карточку, чтобы выделить метку.",
    offersShowing: (n) =>
      `${n} ${pluralRu(n, "предложение", "предложения", "предложений")}`,
    clearFilters: "Сбросить фильтры",
    saved: "Сохранённые",
    loadingMap: "Загрузка карты...",
    noOffersSearch: (q) => `Нет предложений по запросу «${q}»`,
    noOffersEmpty: "Нет сохранённых предложений",
    noOffersCategory: "В этой категории нет предложений",
    noOffersHintFav: "Нажмите ♥ на карточке, чтобы сохранить.",
    noOffersHint: "Попробуйте другой фильтр или сбросьте все.",
    sort: {
      expiry: "Скоро истекает",
      price: "Самая низкая цена",
      discount: "Наибольшая скидка",
      distance: "Ближе всего",
    },
    map: {
      clean: "Чистая",
      standard: "Стандарт",
      dark: "Тёмная",
    },
    stats: {
      meals: "блюд спасено",
      co2: "CO₂ предотвращено",
      rescuers: "активных участников",
      businesses: "местных заведений",
    },
  },
  offer: {
    surprise: "Сюрприз",
    onlyLeft: (n) => `Осталось ${n}!`,
    addToFavorites: "Добавить в избранное",
    removeFromFavorites: "Убрать из избранного",
    portionsLeft: (n) =>
      `${n} ${pluralRu(n, "порция", "порции", "порций")} осталось`,
    collectBy: "Забрать до",
    countdown: (label) => `Забрать сегодня · ${label}`,
    hoursMinLeft: (h, m) => `${h} ч ${m} мин`,
    minsLeft: (m) => `${m} мин`,
    qrAlt: "QR-код",
    portionsAvailable: "Доступно порций",
    onlyLeftDialog: (n) => `Осталось всего ${n}!`,
    remaining: (n) =>
      `${n} ${pluralRu(n, "порция", "порции", "порций")} доступно`,
    whatYouMightGet: "Что вы можете получить",
    surpriseBagDesc:
      "Это сюрприз-пакет! Вы получите набор вкусных блюд, которые не успели продать вовремя, но они абсолютно свежие. Содержимое — сюрприз до момента получения.",
    regularDesc:
      "Вкусный набор свежей еды, спасённой от утилизации. Наслаждайтесь отличной едой, помогая планете!",
    impactTeaser: (co2, water) =>
      `Это спасение сохранит ~${co2} кг CO₂ и ~${water} л воды`,
    youSave: (amount) => `Вы экономите $${amount}`,
    includesTaxes: "Включая налоги",
    reserveNow: "Забронировать",
    reserved: "Забронировано!",
    qrMessage: (restaurant, time) =>
      `Покажите QR-код в «${restaurant}» до ${time}, чтобы забрать еду.`,
    yourRescueImpact: "Ваш вклад в спасение",
    co2Avoided: "CO₂ предотвращено",
    waterSaved: "воды сэкономлено",
    youSavedStat: "ваша экономия",
    collectToday: "Забрать сегодня",
    pickupWindow: (start, end) => `С ${start} до ${end}`,
    away: "от вас",
  },
  categories: {
    All: "Все",
    Meals: "Блюда",
    "Baked Goods": "Выпечка",
    Groceries: "Продукты",
    Vegan: "Веганское",
    "Surprise Bags": "Сюрприз-пакеты",
  },
  seller: {
    nav: {
      dashboard: "Дашборд",
      mealPackages: "Пакеты блюд",
      stockIntake: "Приём товаров",
      orderHistory: "История заказов",
      insights: "Аналитика",
      settings: "Настройки",
    },
    dashboard: {
      badgeRestaurant: "CRM ресторана",
      badgeShop: "CRM магазина",
      titleRestaurant: "Публикуйте пакеты блюд и управляйте самовывозом",
      titleShop: "Принимайте товары с истекающим сроком и отслеживайте излишки",
      subtitleRestaurant:
        "Создавайте пакеты из остатков, задавайте окна самовывоза и подтверждайте бронирования в реальном времени.",
      subtitleShop:
        "Сканируйте штрих-коды, читайте даты истечения срока через OCR и формируйте очередь товаров с подходящим сроком.",
      openSettings: "Открыть настройки продавца",
      viewMarketplace: "Перейти на витрину",
    },
    metrics: {
      salesTitle: "Прогноз продаж",
      salesDesc: (count) =>
        `${count} ${pluralRu(count, "пакет", "пакета", "пакетов")} видно покупателям`,
      inventoryTitle: "Товары на учёте",
      inventoryDesc: (expiring) =>
        `${expiring} ${pluralRu(expiring, "товар", "товара", "товаров")} истекает через 3 дня`,
      packagesTitle: "Готовых пакетов",
      packagesDesc: "Порции видны покупателям и ожидают самовывоза",
      foodSavedTitle: "Спасено еды",
      foodSavedDesc: "Приблизительный объём предотвращённых отходов",
    },
    stockIntake: {
      cardTitle: "Штрих-коды для магазинов и продуктовых",
      productName: "Название товара",
      productNamePlaceholder: "Молоко, набор для салата, йогурт...",
      quantity: "Количество",
      scanLive: "Сканировать штрих-код",
      decodeBarcodeImage: "Загрузить фото штрих-кода",
      stopCamera: "Остановить камеру",
      cameraPreview: "Предпросмотр камеры появится здесь при сканировании.",
      barcode: "Штрих-код",
      barcodePlaceholder: "Ввод вручную",
      expiryDate: "Срок годности",
      readingExpiry: "Читаю дату...",
      ocrFromImage: "OCR с фото этикетки",
      ocrSnapshot: "Снимок OCR",
      addToStock: "Добавить товар в учёт",
      scanInitial: "Сканируйте камерой, загрузите фото или введите код вручную.",
      scanOpeningCamera: "Открытие камеры. Наведите на штрих-код.",
      scanCamera: (code) => `Штрих-код считан камерой: ${code}`,
      scanActive: "Камера активна, но штрих-код пока не распознан.",
      scanCameraError:
        "Не удалось запустить сканирование. Используйте фото или ввод вручную.",
      scanImageResult: (code) => `Штрих-код из изображения: ${code}`,
      scanImageError: "Штрих-код на изображении не найден.",
      ocrInitial: "Загрузите фото этикетки для автоопределения даты.",
      ocrReading: "Читаю этикетку...",
      ocrSuccess: (date) => `Дата найдена: ${date}`,
      ocrNoDate: "OCR завершён, но дата не найдена. Введите вручную.",
      ocrError: "OCR не смог обработать изображение. Попробуйте чётче.",
      itemAdded: "Товар добавлен. Сканируйте следующий продукт.",
    },
    mealPackages: {
      cardTitle: "Конструктор пакетов блюд для ресторанов",
      packageTitle: "Название пакета",
      packageTitlePlaceholder: "Вечерняя паста",
      category: "Категория",
      imageUrl: "URL фото",
      imageUrlPlaceholder: "Необязательная ссылка на фото",
      contents: "Состав пакета",
      contentsPlaceholder: "Паста\nЧесночный хлеб\nТирамису",
      originalPrice: "Исходная цена",
      customerPrice: "Цена для покупателя",
      portionsAvailable: "Количество порций",
      pickupStarts: "Начало самовывоза",
      pickupEnds: "Конец самовывоза",
      visibilityTitle: "Видимость для покупателей",
      visibilityDesc:
        "Публикация записывает пакет в общий магазин — он сразу появляется в ленте и на карте покупателей.",
      publishButton: "Опубликовать пакет для покупателей",
    },
    orderHistory: {
      pickupTitle: "Верификация самовывоза",
      scanQr: "Сканировать QR покупателя",
      decodeQrImage: "Загрузить QR-код",
      stopScanner: "Остановить сканер",
      qrPreview: "Предпросмотр QR-камеры появится здесь при верификации.",
      verifyCode: "Проверить код",
      collected: "Получено",
      pending: "Ожидает",
      packagesTitle: "Активные пакеты покупателей",
      noPackages: "Пакеты ещё не опубликованы",
      noPackagesDesc:
        "Используйте конструктор для публикации блюд, которые покупатели смогут забронировать.",
      mealPackageFallback: "Пакет блюд",
      pickupWindow: (start, end) => `Самовывоз с ${start} до ${end}`,
      visibleOnFeed: "Видно в ленте покупателей",
      portions: (n) =>
        `${n} ${pluralRu(n, "порция", "порции", "порций")}`,
      pickupInitial:
        "Сканируйте QR или код бронирования покупателя для подтверждения выдачи.",
      pickupConfirmed: (name, title) =>
        `Выдача подтверждена для ${name} (${title}).`,
      pickupNotFound: "Бронирование с таким кодом не найдено.",
      pickupScannerStart: "Открытие камеры. Наведите на QR-код покупателя.",
      pickupScannerActive: "Камера активна, но код пока не распознан.",
      pickupScannerError:
        "Не удалось запустить сканер. Загрузите фото или введите код вручную.",
      pickupImageError: "QR-код или штрих-код на изображении не найден.",
    },
    insights: {
      cardTitle: "Товары на учёте и очередь истечения",
      noGoods: "Товары ещё не добавлены",
      noGoodsDesc:
        "Сканируйте штрих-коды и этикетки, чтобы сформировать очередь товаров с истекающим сроком.",
      barcodeLabel: (code) => `Штрих-код ${code}`,
      qtyLabel: (n) => `Кол-во: ${n}`,
      capturedVia: (source) => `Источник: ${source}`,
    },
    settings: {
      cardTitle: "Настройки витрины",
      businessName: "Название заведения",
      businessNamePlaceholder: "Кафе «Уют»",
      businessType: "Тип бизнеса",
      restaurant: "Ресторан",
      shop: "Магазин",
      category: "Категория",
      categoryPlaceholder: "Пекарня",
      address: "Адрес",
      addressPlaceholder: "Шайхантахурский район, Ташкент",
      latitude: "Широта",
      longitude: "Долгота",
      pickupOpsTitle: "Параметры самовывоза",
      pickupOpsDesc: (start, end) =>
        `Стандартное окно самовывоза: с ${start} до ${end}`,
      marketplaceTitle: "Видимость на платформе",
      marketplaceDesc:
        "Пакеты публикуются через общий бэкенд при настроенном Supabase, иначе используется локальный режим прототипа.",
      saving: "Сохранение профиля...",
      saveButton: "Сохранить настройки витрины",
      profileInitial:
        "Данные бизнеса готовы к синхронизации с аутентифицированным бэкендом.",
      profileSaved:
        "Профиль продавца сохранён. Будущие предложения будут использовать эти данные.",
      profileError: "Не удалось сохранить профиль продавца.",
      profileValidationError:
        "Заполните все поля бизнеса перед сохранением.",
    },
  },
  auth: {
    signUpTitle: "Зарегистрируйтесь как продавец",
    signUpSubtitle:
      "Выберите тип бизнеса — он определяет инструменты в CRM продавца.",
    signInTitle: "Вход для продавца",
    signInSubtitle:
      "Войдите, чтобы получить доступ к CRM продавца и синхронизированным данным.",
    email: "Эл. почта",
    password: "Пароль",
    emailPlaceholder: "hello@yourbusiness.com",
    passwordPlaceholder: "Не менее 8 символов",
    createAccount: "Создать аккаунт продавца",
    signIn: "Войти",
    alreadyHaveAccount: "Уже есть аккаунт?",
    newSeller: "Новый продавец?",
    supabaseWarning:
      "Supabase не настроен. Создайте .env.local из .env.example перед использованием авторизации.",
    businessType: "Тип бизнеса",
    restaurantLabel: "Ресторан",
    restaurantSubtitle: "Публикуйте пакеты блюд для бронирования клиентами",
    shopLabel: "Магазин / Супермаркет",
    shopSubtitle: "Отслеживайте товары с истекающим сроком по штрих-коду",
    minPassword: "Не менее 8 символов",
  },
};

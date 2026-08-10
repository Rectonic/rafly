/**
 * Seller v2 strings for the Shop Seller beta: role aware navigation,
 * inventory confidence, count sessions, and offer publication. Demo and v1
 * Restaurant Seller screens keep using the existing top level seller
 * translation group, this namespace is additive and only rendered once a
 * screen has confirmed Shop Seller beta access through
 * useStoreMembershipV2.
 */
function pluralRu(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

export interface SellerTranslations {
  access: {
    loading: string;
    unavailable: string;
    noMembership: string;
    disabled: string;
    errorTitle: string;
    retry: string;
  };
  nav: {
    bannerTitle: string;
    bannerSubtitle: string;
    bannerOpen: string;
  };
  roles: {
    staff: string;
    manager: string;
    owner: string;
    operator: string;
  };
  inventory: {
    title: string;
    itemCount: (n: number) => string;
    loadingItems: string;
    emptyTitle: string;
    emptyHint: string;
    errorTitle: string;
    retry: string;
    confidenceHigh: string;
    confidenceMedium: string;
    confidenceLow: string;
    lastVerified: (timestamp: string) => string;
    neverVerified: string;
    barcodeLabel: (code: string) => string;
    expiryLabel: (date: string) => string;
    onHandLabel: (n: number) => string;
    maxOfferableLabel: (n: number) => string;
    exceptionsSummary: (n: number) => string;
    noExceptions: string;
    exceptionActionButton: string;
    recordCountButton: string;
    publishButton: string;
  };
}

export const sellerEn: SellerTranslations = {
  access: {
    loading: "Checking Shop Seller beta access...",
    unavailable: "Shop Seller beta is not available yet.",
    noMembership: "You are not a member of a Shop Seller beta store.",
    disabled: "Shop Seller beta is not enabled for your store yet.",
    errorTitle: "Unable to check Shop Seller beta access",
    retry: "Retry",
  },
  nav: {
    bannerTitle: "Shop Seller beta",
    bannerSubtitle:
      "Verified inventory, backend approved offers, and safe pickup fulfillment.",
    bannerOpen: "Open Shop Seller beta",
  },
  roles: {
    staff: "Staff",
    manager: "Manager",
    owner: "Owner",
    operator: "Operator",
  },
  inventory: {
    title: "Shop Seller beta inventory",
    itemCount: (n) => `${n} product${n === 1 ? "" : "s"} tracked`,
    loadingItems: "Loading inventory...",
    emptyTitle: "No tracked products yet",
    emptyHint: "Products appear here after a canonical import or manual entry.",
    errorTitle: "Unable to load inventory",
    retry: "Retry",
    confidenceHigh: "High confidence",
    confidenceMedium: "Medium confidence",
    confidenceLow: "Low confidence",
    lastVerified: (timestamp) => `Verified ${timestamp}`,
    neverVerified: "Never verified",
    barcodeLabel: (code) => `Barcode ${code}`,
    expiryLabel: (date) => `Expires ${date}`,
    onHandLabel: (n) => `${n} on hand`,
    maxOfferableLabel: (n) => `Up to ${n} offerable`,
    exceptionsSummary: (n) =>
      n === 0
        ? "No open exceptions"
        : `${n} item${n === 1 ? "" : "s"} need${n === 1 ? "s" : ""} attention`,
    noExceptions: "No open exceptions",
    exceptionActionButton: "Recount",
    recordCountButton: "Record a count",
    publishButton: "New offer",
  },
};

export const sellerRu: SellerTranslations = {
  access: {
    loading: "Проверяем доступ к бета-версии для магазинов...",
    unavailable: "Бета-версия для магазинов пока недоступна.",
    noMembership: "Вы не состоите в магазине бета-программы.",
    disabled: "Бета-версия для магазинов не включена для вашего магазина.",
    errorTitle: "Не удалось проверить доступ к бета-версии",
    retry: "Повторить",
  },
  nav: {
    bannerTitle: "Бета-версия для магазинов",
    bannerSubtitle:
      "Проверенные остатки, предложения с подтверждением бэкенда и безопасная выдача.",
    bannerOpen: "Открыть бета-версию",
  },
  roles: {
    staff: "Сотрудник",
    manager: "Менеджер",
    owner: "Владелец",
    operator: "Оператор",
  },
  inventory: {
    title: "Инвентарь бета-версии для магазинов",
    itemCount: (n) => `${n} ${pluralRu(n, "товар", "товара", "товаров")} на учёте`,
    loadingItems: "Загрузка инвентаря...",
    emptyTitle: "Товары ещё не добавлены",
    emptyHint: "Товары появятся здесь после импорта или ручного ввода.",
    errorTitle: "Не удалось загрузить инвентарь",
    retry: "Повторить",
    confidenceHigh: "Высокая уверенность",
    confidenceMedium: "Средняя уверенность",
    confidenceLow: "Низкая уверенность",
    lastVerified: (timestamp) => `Проверено ${timestamp}`,
    neverVerified: "Ещё не проверено",
    barcodeLabel: (code) => `Штрих-код ${code}`,
    expiryLabel: (date) => `Истекает ${date}`,
    onHandLabel: (n) => `${n} в наличии`,
    maxOfferableLabel: (n) => `Доступно к продаже: ${n}`,
    exceptionsSummary: (n) =>
      n === 0
        ? "Нет открытых расхождений"
        : `${n} ${pluralRu(n, "товар требует", "товара требуют", "товаров требуют")} внимания`,
    noExceptions: "Нет открытых расхождений",
    exceptionActionButton: "Пересчитать",
    recordCountButton: "Записать пересчёт",
    publishButton: "Новое предложение",
  },
};

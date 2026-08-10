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
  count: {
    title: string;
    forbiddenTitle: string;
    forbiddenMessage: string;
    selectProductsTitle: string;
    selectLabel: string;
    selectedLabel: string;
    observedQuantityLabel: string;
    submitButton: string;
    submitting: string;
    submitErrorFallback: string;
    retry: string;
    proposalsTitle: string;
    noChangesTitle: string;
    proposalLine: (current: number, proposed: number) => string;
    pendingApproval: string;
    approveButton: string;
    rejectButton: string;
    deciding: string;
    approvedLabel: string;
    rejectedLabel: string;
    staleTitle: string;
    staleMessage: string;
    alreadyDecidedTitle: string;
    decisionErrorFallback: string;
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
  count: {
    title: "Count session",
    forbiddenTitle: "Counts are staff, manager, and owner only",
    forbiddenMessage: "Your role cannot record a physical count for this store.",
    selectProductsTitle: "Select the products you physically counted",
    selectLabel: "Select",
    selectedLabel: "Selected",
    observedQuantityLabel: "Observed quantity",
    submitButton: "Submit count",
    submitting: "Submitting count...",
    submitErrorFallback: "Unable to submit this count.",
    retry: "Retry",
    proposalsTitle: "Adjustment proposals",
    noChangesTitle: "No changes, every observed quantity matched on hand stock.",
    proposalLine: (current, proposed) => `${current} on record, ${proposed} counted`,
    pendingApproval: "Awaiting manager approval",
    approveButton: "Approve",
    rejectButton: "Reject",
    deciding: "Saving decision...",
    approvedLabel: "Approved",
    rejectedLabel: "Rejected",
    staleTitle: "This proposal changed",
    staleMessage: "Someone else decided this proposal first. Refreshed to the latest version.",
    alreadyDecidedTitle: "Already decided",
    decisionErrorFallback: "Unable to save this decision.",
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
  count: {
    title: "Сессия пересчёта",
    forbiddenTitle: "Пересчёт доступен только сотрудникам, менеджерам и владельцам",
    forbiddenMessage: "Ваша роль не позволяет записывать физический пересчёт для этого магазина.",
    selectProductsTitle: "Выберите товары, которые вы физически пересчитали",
    selectLabel: "Выбрать",
    selectedLabel: "Выбрано",
    observedQuantityLabel: "Фактическое количество",
    submitButton: "Отправить пересчёт",
    submitting: "Отправка пересчёта...",
    submitErrorFallback: "Не удалось отправить этот пересчёт.",
    retry: "Повторить",
    proposalsTitle: "Предложения по корректировке",
    noChangesTitle: "Изменений нет, все фактические количества совпали с учётными.",
    proposalLine: (current, proposed) => `${current} по учёту, ${proposed} по пересчёту`,
    pendingApproval: "Ожидает решения менеджера",
    approveButton: "Одобрить",
    rejectButton: "Отклонить",
    deciding: "Сохраняем решение...",
    approvedLabel: "Одобрено",
    rejectedLabel: "Отклонено",
    staleTitle: "Это предложение изменилось",
    staleMessage: "Кто-то другой уже принял решение по этому предложению. Показана последняя версия.",
    alreadyDecidedTitle: "Уже решено",
    decisionErrorFallback: "Не удалось сохранить это решение.",
  },
};

/**
 * Seller v2 strings for the Shop Seller beta: role aware navigation,
 * inventory confidence, count sessions, and offer publication. Demo and v1
 * Restaurant Seller screens keep using the existing top level seller
 * translation group, this namespace is additive and only rendered once a
 * screen has confirmed Shop Seller beta access through
 * useStoreMembershipV2.
 */
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
};

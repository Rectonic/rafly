import type { ReservationStatusV2 } from "@/lib/contracts";

/**
 * Buyer v2 strings for the pilot mode live marketplace, offer detail, and
 * reservation experience. Demo mode keeps using the existing top level
 * translation groups (home, offer, buyerReservations), this namespace is
 * additive and only rendered once a screen has confirmed pilot mode is
 * active through the coordinator feature flags.
 */
export interface BuyerTranslations {
  feed: {
    loading: string;
    errorTitle: string;
    errorHint: string;
    retry: string;
  };
  offerDetail: {
    loading: string;
    notFound: string;
    errorTitle: string;
    errorHint: string;
    retry: string;
    lastVerified: (timestamp: string) => string;
    pickupWindow: (window: string) => string;
    soldOut: string;
    expired: string;
    paused: string;
    withdrawn: string;
    quantityAvailable: (n: number) => string;
    discountBadge: (percent: number) => string;
    reserveNow: string;
    reserving: string;
    reserveRetry: string;
    viewReservation: string;
    close: string;
    addToFavorites: string;
    removeFromFavorites: string;
    whatYouMightGet: string;
    pickupInstructionsTitle: string;
    dietaryTitle: string;
    allergensTitle: string;
    cancellationPolicyTitle: string;
  };
  reservation: {
    title: string;
    pickupCode: string;
    pickupCodeHint: (hint: string) => string;
    showPickupCode: string;
    secureRecoveryNote: string;
    holdExpiresAt: (timestamp: string) => string;
    cancel: string;
    cancelling: string;
    cancelConfirmTitle: string;
    cancelConfirmMessage: string;
    cancelConfirmConfirm: string;
    cancelConfirmDismiss: string;
    staleVersionTitle: string;
    staleVersionMessage: string;
    soldOutMessage: string;
    offerNotLiveMessage: string;
    networkErrorMessage: string;
    genericErrorMessage: string;
    statusLabel: Record<ReservationStatusV2, string>;
    statusDescription: Record<ReservationStatusV2, string>;
  };
  reservationsList: {
    title: string;
    loading: string;
    empty: string;
    errorTitle: string;
    retry: string;
  };
}

export const buyerEn: BuyerTranslations = {
  feed: {
    loading: "Loading live offers...",
    errorTitle: "Live marketplace unavailable",
    errorHint: "Check your connection and try again.",
    retry: "Retry",
  },
  offerDetail: {
    loading: "Loading offer...",
    notFound: "This offer is no longer available.",
    errorTitle: "Unable to load this offer",
    errorHint: "Check your connection and try again.",
    retry: "Retry",
    lastVerified: (timestamp) => `Stock last verified ${timestamp}`,
    pickupWindow: (window) => `Pickup ${window}`,
    soldOut: "Sold out",
    expired: "This offer has expired",
    paused: "This offer is temporarily paused",
    withdrawn: "This offer was withdrawn",
    quantityAvailable: (n) => `${n} left`,
    discountBadge: (percent) => `${percent}% off`,
    reserveNow: "Reserve now",
    reserving: "Reserving...",
    reserveRetry: "Try again",
    viewReservation: "View reservation",
    close: "Close",
    addToFavorites: "Add to favorites",
    removeFromFavorites: "Remove from favorites",
    whatYouMightGet: "What you might get",
    pickupInstructionsTitle: "Pickup instructions",
    dietaryTitle: "Dietary",
    allergensTitle: "Allergens",
    cancellationPolicyTitle: "Cancellation & refund policy",
  },
  reservation: {
    title: "Reservation",
    pickupCode: "Pickup code",
    pickupCodeHint: (hint) => `Code ending in ${hint}`,
    showPickupCode: "Show pickup code",
    secureRecoveryNote: "Your pickup code is stored securely on this device.",
    holdExpiresAt: (timestamp) => `Hold expires ${timestamp}`,
    cancel: "Cancel reservation",
    cancelling: "Cancelling...",
    cancelConfirmTitle: "Cancel this reservation?",
    cancelConfirmMessage: "The seller will release this unit for other buyers.",
    cancelConfirmConfirm: "Cancel reservation",
    cancelConfirmDismiss: "Keep reservation",
    staleVersionTitle: "This offer just changed",
    staleVersionMessage:
      "Someone else updated this offer. We refreshed the details, please review and try again.",
    soldOutMessage: "The last unit was just reserved by another buyer.",
    offerNotLiveMessage: "This offer is no longer accepting reservations.",
    networkErrorMessage: "Network problem. Please try again.",
    genericErrorMessage: "Something went wrong. Please try again.",
    statusLabel: {
      cancelled_by_buyer: "Cancelled",
      cancelled_by_seller: "Cancelled by seller",
      expired_no_show: "Expired",
      failed_stock_mismatch: "Unavailable",
      fulfilled: "Picked up",
      held: "Reserved",
    },
    statusDescription: {
      cancelled_by_buyer: "You cancelled this reservation.",
      cancelled_by_seller: "The seller cancelled this reservation. Your unit was released.",
      expired_no_show: "The pickup window closed before this reservation was collected.",
      failed_stock_mismatch:
        "The seller found a stock mismatch. This reservation could not be honored.",
      fulfilled: "This reservation was picked up.",
      held: "Ready for pickup during the offer window.",
    },
  },
  reservationsList: {
    title: "Reservations",
    loading: "Loading reservations...",
    empty: "No reservations yet.",
    errorTitle: "Unable to load reservations",
    retry: "Retry",
  },
};

export const buyerRu: BuyerTranslations = {
  feed: {
    loading: "Загрузка актуальных предложений...",
    errorTitle: "Витрина недоступна",
    errorHint: "Проверьте соединение и повторите попытку.",
    retry: "Повторить",
  },
  offerDetail: {
    loading: "Загрузка предложения...",
    notFound: "Это предложение больше недоступно.",
    errorTitle: "Не удалось загрузить предложение",
    errorHint: "Проверьте соединение и повторите попытку.",
    retry: "Повторить",
    lastVerified: (timestamp) => `Остаток проверен ${timestamp}`,
    pickupWindow: (window) => `Самовывоз ${window}`,
    soldOut: "Раскуплено",
    expired: "Срок этого предложения истёк",
    paused: "Это предложение временно приостановлено",
    withdrawn: "Это предложение отозвано",
    quantityAvailable: (n) => `Осталось: ${n}`,
    discountBadge: (percent) => `Скидка ${percent}%`,
    reserveNow: "Забронировать",
    reserving: "Бронирование...",
    reserveRetry: "Повторить попытку",
    viewReservation: "Посмотреть бронь",
    close: "Закрыть",
    addToFavorites: "Добавить в избранное",
    removeFromFavorites: "Убрать из избранного",
    whatYouMightGet: "Что вы можете получить",
    pickupInstructionsTitle: "Инструкции по самовывозу",
    dietaryTitle: "Диетические отметки",
    allergensTitle: "Аллергены",
    cancellationPolicyTitle: "Правила отмены и возврата",
  },
  reservation: {
    title: "Бронирование",
    pickupCode: "Код самовывоза",
    pickupCodeHint: (hint) => `Код оканчивается на ${hint}`,
    showPickupCode: "Показать код самовывоза",
    secureRecoveryNote: "Код самовывоза надёжно хранится на этом устройстве.",
    holdExpiresAt: (timestamp) => `Бронь действует до ${timestamp}`,
    cancel: "Отменить бронь",
    cancelling: "Отмена...",
    cancelConfirmTitle: "Отменить эту бронь?",
    cancelConfirmMessage: "Продавец освободит этот товар для других покупателей.",
    cancelConfirmConfirm: "Отменить бронь",
    cancelConfirmDismiss: "Оставить бронь",
    staleVersionTitle: "Это предложение только что изменилось",
    staleVersionMessage:
      "Кто-то другой обновил это предложение. Мы обновили данные, проверьте их и попробуйте снова.",
    soldOutMessage: "Последнюю единицу только что забронировал другой покупатель.",
    offerNotLiveMessage: "Это предложение больше не принимает брони.",
    networkErrorMessage: "Проблема с сетью. Попробуйте ещё раз.",
    genericErrorMessage: "Что-то пошло не так. Попробуйте ещё раз.",
    statusLabel: {
      cancelled_by_buyer: "Отменено",
      cancelled_by_seller: "Отменено продавцом",
      expired_no_show: "Истекло",
      failed_stock_mismatch: "Недоступно",
      fulfilled: "Получено",
      held: "Забронировано",
    },
    statusDescription: {
      cancelled_by_buyer: "Вы отменили эту бронь.",
      cancelled_by_seller: "Продавец отменил эту бронь. Товар снова доступен другим.",
      expired_no_show: "Окно самовывоза закрылось до получения брони.",
      failed_stock_mismatch:
        "Продавец обнаружил расхождение остатков. Эту бронь нельзя было выполнить.",
      fulfilled: "Эта бронь была получена.",
      held: "Готово к самовывозу в течение окна предложения.",
    },
  },
  reservationsList: {
    title: "Брони",
    loading: "Загрузка броней...",
    empty: "Броней пока нет.",
    errorTitle: "Не удалось загрузить брони",
    retry: "Повторить",
  },
};

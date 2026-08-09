import type { Locale } from "@/i18n/types";
import type { LocalizedOfferContent, Offer } from "@/types/offer";

type OfferTranslation = {
  allergens?: string[];
  cancellationPolicy?: string;
  contents?: string[];
  dietaryBadges?: string[];
  locationAddress?: string;
  pickupInstructions?: string;
  restaurant?: string;
  title?: string;
};

const RU_SEED_OFFER_TRANSLATIONS: Record<string, OfferTranslation> = {
  "1": {
    restaurant: "Пекарня The Daily Crumb",
    title: "Сюрприз-пакет из пекарни",
    locationAddress: "Шайхантахурский район, Ташкент",
  },
  "2": {
    restaurant: "Green Bowl",
    title: "Овощной бокс",
    locationAddress: "Мирабадский район, Ташкент",
  },
  "3": {
    restaurant: "Tokyo Bites",
    title: "Суши-микс",
    locationAddress: "Юнусабадский район, Ташкент",
  },
  "4": {
    restaurant: "Le Pain",
    title: "Набор ремесленного хлеба",
    locationAddress: "Алмазарский район, Ташкент",
  },
  "5": {
    restaurant: "Roma Cucina",
    title: "Семейный поднос пасты",
    locationAddress: "Яккасарайский район, Ташкент",
  },
  "6": {
    restaurant: "Bazaar Fresh",
    title: "Корзина позднего урожая",
    locationAddress: "Чиланзарский район, Ташкент",
  },
  "7": {
    restaurant: "Root and Rise",
    title: "Растительный протеиновый набор",
    locationAddress: "Сергелийский район, Ташкент",
  },
  "8": {
    restaurant: "City Fork",
    title: "Сюрприз-пакет ужина",
    locationAddress: "Мирзо-Улугбекский район, Ташкент",
  },
  "9": {
    restaurant: "Булочная Butter House",
    title: "Утренний набор выпечки",
    locationAddress: "Яшнободский район, Ташкент",
    allergens: ["Содержит глютен", "Содержит молочные продукты"],
    cancellationPolicy:
      "Отмените за 30 минут до самовывоза, чтобы получить автоматический возврат.",
    contents: ["Круассаны", "пан-о-шоколад", "фруктовые слойки"],
    dietaryBadges: ["Вегетарианское"],
    pickupInstructions:
      "Войдите через боковой вход пекарни и покажите код самовывоза у стойки.",
  },
  "10": {
    restaurant: "Urban Pantry",
    title: "Соседский продуктовый набор",
    locationAddress: "Юнусабадский район, Ташкент",
  },
};

function applyOfferTranslation(
  offer: Offer,
  translation: OfferTranslation | undefined
): Offer {
  if (!translation) {
    return offer;
  }

  return {
    ...offer,
    allergens: translation.allergens ?? offer.allergens,
    cancellationPolicy:
      translation.cancellationPolicy ?? offer.cancellationPolicy,
    contents: translation.contents ?? offer.contents,
    dietaryBadges: translation.dietaryBadges ?? offer.dietaryBadges,
    location: {
      ...offer.location,
      address: translation.locationAddress ?? offer.location.address,
    },
    pickupInstructions:
      translation.pickupInstructions ?? offer.pickupInstructions,
    restaurant: translation.restaurant ?? offer.restaurant,
    title: translation.title ?? offer.title,
  };
}

export function localizeOffer(offer: Offer, locale: Locale): Offer {
  const sellerTranslation = offer.translations?.[locale];

  if (sellerTranslation) {
    return applyOfferTranslation(offer, sellerTranslation);
  }

  if (locale !== "ru") {
    return offer;
  }

  const seedTranslation = RU_SEED_OFFER_TRANSLATIONS[offer.id];

  if (!seedTranslation) {
    return offer;
  }

  return applyOfferTranslation(offer, seedTranslation);
}

export function localizeOffers(offers: Offer[], locale: Locale): Offer[] {
  return offers.map((offer) => localizeOffer(offer, locale));
}

export function mergeLocalizedOfferContent(
  base: LocalizedOfferContent | undefined,
  next: LocalizedOfferContent | undefined
): LocalizedOfferContent | undefined {
  if (!base && !next) {
    return undefined;
  }

  return {
    en: {
      ...base?.en,
      ...next?.en,
    },
    ru: {
      ...base?.ru,
      ...next?.ru,
    },
  };
}

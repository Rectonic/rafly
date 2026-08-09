import { OFFERS } from "@/data/offers";
import { localizeOffer, localizeOffers } from "@/lib/localized-offers";
import type { Offer } from "@/types/offer";

describe("localizeOffers", () => {
  it("keeps seed offer content in English for English locale", () => {
    const offers = localizeOffers(OFFERS, "en");

    expect(offers.find((offer) => offer.id === "9")?.title).toBe(
      "Morning Pastry Pack"
    );
    expect(offers.find((offer) => offer.id === "9")?.restaurant).toBe(
      "Butter House"
    );
  });

  it("localizes visible seed marketplace content for Russian locale", () => {
    const offers = localizeOffers(OFFERS, "ru");

    expect(offers.find((offer) => offer.id === "9")?.title).toBe(
      "Утренний набор выпечки"
    );
    expect(offers.find((offer) => offer.id === "9")?.restaurant).toBe(
      "Булочная Butter House"
    );
    expect(offers.find((offer) => offer.id === "4")?.title).toBe(
      "Набор ремесленного хлеба"
    );
    expect(offers.find((offer) => offer.id === "4")?.location.address).toBe(
      "Алмазарский район, Ташкент"
    );
  });

  it("localizes seller-published multilingual content with base fallbacks", () => {
    const sellerOffer: Offer = {
      ...OFFERS[0],
      contents: ["Pasta tray", "Garlic bread"],
      id: "seller-offer-1",
      location: {
        ...OFFERS[0].location,
        address: "Chilonzor District, Tashkent",
      },
      restaurant: "Roma Kitchen",
      source: "seller",
      title: "Closing pasta bundle",
      translations: {
        ru: {
          contents: ["Паста", "Чесночный хлеб"],
          locationAddress: "Чиланзарский район, Ташкент",
          restaurant: "Кухня Roma",
          title: "Вечерний набор пасты",
        },
      },
    };

    expect(localizeOffer(sellerOffer, "en").title).toBe(
      "Closing pasta bundle"
    );

    const localized = localizeOffer(sellerOffer, "ru");

    expect(localized.title).toBe("Вечерний набор пасты");
    expect(localized.restaurant).toBe("Кухня Roma");
    expect(localized.contents).toEqual(["Паста", "Чесночный хлеб"]);
    expect(localized.location.address).toBe("Чиланзарский район, Ташкент");
  });
});

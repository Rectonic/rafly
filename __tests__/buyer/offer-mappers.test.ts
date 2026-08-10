import {
  UnknownOfferStatusError,
  mapMarketplaceOfferV2ToOffer,
} from "@/lib/buyer/offer-mappers";
import type { MarketplaceOfferV2 } from "@/lib/contracts";

function buildOfferV2(overrides: Partial<MarketplaceOfferV2> = {}): MarketplaceOfferV2 {
  return {
    id: "offer-1",
    version: 3,
    storeId: "store-1",
    storeName: "Chorsu Corner Market",
    storeAddress: "12 Chorsu Street, Tashkent",
    latitude: 41.3111,
    longitude: 69.2797,
    title: "Bakery rescue box",
    category: "bakery",
    imageUrl: "https://example.com/box.jpg",
    contents: ["bread", "pastry"],
    offerPriceUzs: 20000,
    referencePriceUzs: 50000,
    discountPercent: 60,
    quantityAvailable: 4,
    pickupStart: "2026-08-10T17:00:00.000Z",
    pickupEnd: "2026-08-10T20:00:00.000Z",
    timezone: "Asia/Tashkent",
    allergens: ["gluten"],
    dietaryBadges: ["vegetarian"],
    pickupInstructions: "Ask at the counter",
    cancellationPolicy: "Cancel before pickup start",
    lastVerifiedAt: "2026-08-10T09:00:00.000Z",
    status: "live",
    ...overrides,
  };
}

describe("mapMarketplaceOfferV2ToOffer", () => {
  it("maps public v2 fields onto the buyer Offer view model without leaking private fields", () => {
    const offer = mapMarketplaceOfferV2ToOffer(buildOfferV2());

    expect(offer.id).toBe("offer-1");
    expect(offer.title).toBe("Bakery rescue box");
    expect(offer.restaurant).toBe("Chorsu Corner Market");
    expect(offer.location).toEqual({
      lat: 41.3111,
      lng: 69.2797,
      address: "12 Chorsu Street, Tashkent",
    });
    expect(offer.quantityAvailable).toBe(4);
    expect(offer.contents).toEqual(["bread", "pastry"]);
    expect(offer.allergens).toEqual(["gluten"]);
    expect(offer.dietaryBadges).toEqual(["vegetarian"]);
    expect(offer.pickupInstructions).toBe("Ask at the counter");
    expect(offer.cancellationPolicy).toBe("Cancel before pickup start");
    expect(offer.source).toBe("seller");
    expect(offer.sellerId).toBe("store-1");
    expect(offer.rating).toBe(0);
    expect(offer.reviews).toBe(0);

    const serialized = JSON.stringify(offer);
    expect(serialized).not.toContain("onHand");
    expect(serialized).not.toContain("confidence");
    expect(serialized).not.toContain("supplier");
    expect(serialized).not.toContain("cost");
    expect(serialized).not.toContain("staff");
  });

  it("converts the pickup window into Asia/Tashkent clock labels", () => {
    const offer = mapMarketplaceOfferV2ToOffer(
      buildOfferV2({
        pickupStart: "2026-08-10T12:00:00.000Z",
        pickupEnd: "2026-08-10T15:00:00.000Z",
      })
    );

    // Asia/Tashkent is a fixed UTC+5 offset with no daylight saving.
    expect(offer.pickupStart).toBe("17:00");
    expect(offer.endTime).toBe("20:00");
  });

  it("produces no discount claim when the reference price is unsupported", () => {
    const offer = mapMarketplaceOfferV2ToOffer(
      buildOfferV2({ referencePriceUzs: null, discountPercent: null })
    );

    expect(offer.discount).toBe(0);
    expect(offer.oldPrice).toBe(offer.newPrice);
    expect(offer.oldPrice).toBe(20000);
  });

  it("defaults a missing optional image and empty contents without fabricating placeholders", () => {
    const offer = mapMarketplaceOfferV2ToOffer(
      buildOfferV2({ imageUrl: null, contents: [] })
    );

    expect(offer.image).toBe("");
    expect(offer.contents).toEqual([]);
  });

  it("fails visibly instead of silently rendering an offer with an unrecognized status", () => {
    const withUnknownStatus = buildOfferV2({
      status: "archived" as unknown as MarketplaceOfferV2["status"],
    });

    expect(() => mapMarketplaceOfferV2ToOffer(withUnknownStatus)).toThrow(
      UnknownOfferStatusError
    );
  });

  it("normalizes free text seller categories onto the fixed buyer category set", () => {
    expect(mapMarketplaceOfferV2ToOffer(buildOfferV2({ category: "bakery" })).category).toBe(
      "Baked Goods"
    );
    expect(mapMarketplaceOfferV2ToOffer(buildOfferV2({ category: "dairy" })).category).toBe(
      "Groceries"
    );
  });

  it("computes a distance label from the supplied user location and leaves it blank otherwise", () => {
    const withLocation = mapMarketplaceOfferV2ToOffer(buildOfferV2(), {
      userLocation: { lat: 41.3111, lng: 69.2797 },
    });
    const withoutLocation = mapMarketplaceOfferV2ToOffer(buildOfferV2());

    expect(withLocation.distance).toBe("0.0 km");
    expect(withoutLocation.distance).toBe("");
  });
});

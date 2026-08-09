import { mapPublishedSellerOfferToOffer } from "@/lib/marketplace-mappers";

describe("mapPublishedSellerOfferToOffer", () => {
  it("normalizes a published seller row into the buyer offer shape", () => {
    expect(
      mapPublishedSellerOfferToOffer({
        address: "12 Market Street",
        business_name: "Night Bakery",
        business_type: "shop",
        allergens: ["Contains gluten"],
        cancellation_policy: "Cancel before the pickup window starts.",
        category: "Baked Goods",
        contents: ["Croissant", "Baguette"],
        discount: 45,
        dietary_badges: ["Vegetarian"],
        distance_text: "0.8 km",
        id: "seller-offer-1",
        image: null,
        latitude: 41.3111,
        longitude: 69.2797,
        new_price: 5,
        old_price: 9,
        pickup_end: "20:30",
        pickup_instructions: "Ask at the bakery counter.",
        pickup_start: "18:00",
        quantity_available: 3,
        rating: 4.8,
        reviews: 124,
        source: "seller",
        seller_id: "seller-1",
        title: "Closing-time pastry bag",
      })
    ).toEqual({
      businessType: "shop",
      category: "Baked Goods",
      allergens: ["Contains gluten"],
      cancellationPolicy: "Cancel before the pickup window starts.",
      contents: ["Croissant", "Baguette"],
      discount: 45,
      dietaryBadges: ["Vegetarian"],
      distance: "0.8 km",
      endTime: "20:30",
      id: "seller-offer-1",
      image: "",
      location: {
        address: "12 Market Street",
        lat: 41.3111,
        lng: 69.2797,
      },
      newPrice: 5,
      oldPrice: 9,
      pickupInstructions: "Ask at the bakery counter.",
      pickupStart: "18:00",
      quantityAvailable: 3,
      rating: 4.8,
      restaurant: "Night Bakery",
      reviews: 124,
      source: "seller",
      sellerId: "seller-1",
      title: "Closing-time pastry bag",
      translations: undefined,
    });
  });
});

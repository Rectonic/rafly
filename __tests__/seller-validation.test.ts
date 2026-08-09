import { getSellerOfferValidationError } from "@/lib/seller/validation";

describe("getSellerOfferValidationError", () => {
  const validInput = {
    contents: ["Pasta tray", "Garlic bread"],
    newPrice: 6,
    oldPrice: 12,
    pickupEnd: "21:00",
    quantity: 4,
    title: "Closing-time pasta bundle",
  };

  it("accepts discounted offers with positive quantity", () => {
    expect(getSellerOfferValidationError(validInput)).toBeNull();
  });

  it("rejects malformed pickup end times", () => {
    expect(
      getSellerOfferValidationError({
        ...validInput,
        pickupEnd: "not-a-time",
      })
    ).toBe("missing-fields");
  });

  it("rejects non-string contents items without throwing", () => {
    expect(
      getSellerOfferValidationError({
        ...validInput,
        contents: [1] as unknown as string[],
      })
    ).toBe("missing-fields");
  });
});

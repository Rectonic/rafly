export const INVALID_SELLER_OFFER_ERROR = "Invalid seller offer.";

export type SellerOfferValidationError =
  | "missing-fields"
  | "invalid-pricing"
  | "invalid-quantity";

export type SellerOfferValidationInput = {
  title: unknown;
  oldPrice: unknown;
  newPrice: unknown;
  quantity: unknown;
  pickupEnd: unknown;
  contents: unknown;
};

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasContents(value: unknown) {
  return Array.isArray(value) && value.some((item) => isNonEmptyString(item));
}

export function getSellerOfferValidationError(
  input: SellerOfferValidationInput | null | undefined
): SellerOfferValidationError | null {
  if (!input) {
    return "missing-fields";
  }

  if (
    !isNonEmptyString(input.title) ||
    !isNonEmptyString(input.pickupEnd) ||
    !TIME_PATTERN.test(input.pickupEnd) ||
    !hasContents(input.contents)
  ) {
    return "missing-fields";
  }

  const oldPrice =
    typeof input.oldPrice === "number" ? input.oldPrice : Number.NaN;
  const newPrice =
    typeof input.newPrice === "number" ? input.newPrice : Number.NaN;

  if (
    !Number.isFinite(oldPrice) ||
    !Number.isFinite(newPrice) ||
    oldPrice <= 0 ||
    newPrice <= 0 ||
    newPrice >= oldPrice
  ) {
    return "invalid-pricing";
  }

  if (
    typeof input.quantity !== "number" ||
    !Number.isInteger(input.quantity) ||
    input.quantity <= 0
  ) {
    return "invalid-quantity";
  }

  return null;
}

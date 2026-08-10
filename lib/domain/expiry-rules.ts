import type { StockConfidenceV2 } from "@/lib/contracts";

export type ExpiryActionV2 =
  | "снять с полки"
  | "уценка 50"
  | "уценка 30"
  | "уценка 15 + кандидат в оффер"
  | "наблюдение";

export const OFFER_CANDIDATE_EXPIRY_ACTION: ExpiryActionV2 =
  "уценка 15 + кандидат в оффер";

export interface ExpiryActionSuggestionV2 {
  action: ExpiryActionV2;
  discountPercent: number | null;
  requiresRecount: boolean;
}

export function suggestExpiryAction(
  daysToExpiry: number,
  confidence: StockConfidenceV2
): ExpiryActionSuggestionV2 {
  const requiresRecount = confidence !== "high";

  if (daysToExpiry <= 0) {
    return { action: "снять с полки", discountPercent: null, requiresRecount };
  }
  if (daysToExpiry === 1) {
    return { action: "уценка 50", discountPercent: 50, requiresRecount };
  }
  if (daysToExpiry <= 3) {
    return { action: "уценка 30", discountPercent: 30, requiresRecount };
  }
  if (daysToExpiry <= 7) {
    return {
      action: OFFER_CANDIDATE_EXPIRY_ACTION,
      discountPercent: 15,
      requiresRecount,
    };
  }
  return { action: "наблюдение", discountPercent: null, requiresRecount };
}

import { suggestExpiryAction } from "@/lib/domain/expiry-rules";

describe("suggestExpiryAction", () => {
  it.each([
    [-1, "снять с полки", null],
    [0, "снять с полки", null],
    [1, "уценка 50", 50],
    [2, "уценка 30", 30],
    [3, "уценка 30", 30],
    [4, "уценка 15 + кандидат в оффер", 15],
    [7, "уценка 15 + кандидат в оффер", 15],
    [8, "наблюдение", null],
  ] as const)(
    "maps %i days at high confidence to %s",
    (daysToExpiry, action, discountPercent) => {
      expect(suggestExpiryAction(daysToExpiry, "high")).toEqual({
        action,
        discountPercent,
        requiresRecount: false,
      });
    }
  );

  it.each(["medium", "low"] as const)(
    "requires a recount for %s confidence without changing the base action",
    (confidence) => {
      expect(suggestExpiryAction(1, confidence)).toEqual({
        action: "уценка 50",
        discountPercent: 50,
        requiresRecount: true,
      });
    }
  );
});

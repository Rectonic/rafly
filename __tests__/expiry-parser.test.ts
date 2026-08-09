import { parseExpiryDate } from "@/lib/seller/expiry-parser";

describe("parseExpiryDate", () => {
  it("parses exact expiry dates after Russian keywords", () => {
    expect(parseExpiryDate("Срок годности: 15.04.2026")).toEqual({
      confidence: "high",
      date: "2026-04-15",
      raw: "Срок годности: 15.04.2026",
    });
  });

  it("parses month-level expiry and defaults to month end", () => {
    expect(parseExpiryDate("годен до 04/2026")).toEqual({
      confidence: "low",
      date: "2026-04-30",
      raw: "годен до 04/2026",
    });
  });

  it("returns null when no date is found", () => {
    expect(parseExpiryDate("freshly baked today")).toEqual({
      confidence: "low",
      date: null,
      raw: "freshly baked today",
    });
  });
});

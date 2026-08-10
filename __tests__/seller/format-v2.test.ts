import { formatIsoTimestampV2, isExpiredV2 } from "@/lib/seller/format-v2";

/**
 * Fix round 1, finding 1. The Shop Seller beta contracts fix the
 * marketplace timezone at Asia/Tashkent (UTC+05:00), a seller approving a
 * pickup window must see the same wall clock time a buyer will see for the
 * same offer, not a bare UTC slice.
 */
describe("formatIsoTimestampV2", () => {
  it("renders a known UTC instant in Asia/Tashkent, five hours ahead of UTC", () => {
    expect(formatIsoTimestampV2("2026-08-10T09:00:00.000Z")).toBe("2026-08-10 14:00");
  });

  it("rolls the calendar date forward across the UTC to Tashkent midnight boundary", () => {
    expect(formatIsoTimestampV2("2026-08-10T20:30:00.000Z")).toBe("2026-08-11 01:30");
  });

  it("falls back to the raw string for an unparseable timestamp", () => {
    expect(formatIsoTimestampV2("not-a-timestamp")).toBe("not-a-timestamp");
  });
});

describe("isExpiredV2", () => {
  it("treats a batch as expired once its date is strictly before today", () => {
    expect(isExpiredV2("2026-08-09", "2026-08-10T09:00:00.000Z")).toBe(true);
  });

  it("does not treat a batch expiring today as already expired", () => {
    expect(isExpiredV2("2026-08-10", "2026-08-10T09:00:00.000Z")).toBe(false);
  });

  it("does not treat a future expiry date as expired", () => {
    expect(isExpiredV2("2026-08-12", "2026-08-10T09:00:00.000Z")).toBe(false);
  });

  it("treats a product with no expiry date as never expired", () => {
    expect(isExpiredV2(null, "2026-08-10T09:00:00.000Z")).toBe(false);
  });
});

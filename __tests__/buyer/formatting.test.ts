import {
  formatFullPickupWindow,
  formatFullTimestamp,
  formatShortTime,
} from "@/lib/buyer/formatting";

describe("buyer v2 timestamp formatting", () => {
  it("formats a short 24 hour clock label in Asia/Tashkent regardless of locale", () => {
    expect(formatShortTime("2026-08-10T12:00:00.000Z")).toBe("17:00");
  });

  it("formats a full localized date and time for English and Russian", () => {
    const en = formatFullTimestamp("2026-08-10T12:00:00.000Z", "en");
    const ru = formatFullTimestamp("2026-08-10T12:00:00.000Z", "ru");

    expect(en).toContain("2026");
    expect(en).toContain("17:00");
    expect(en).toMatch(/aug/i);
    expect(ru).toContain("2026");
    expect(ru).toContain("17:00");
    expect(ru).not.toBe(en);
  });

  it("combines pickup start and end into one full localized window", () => {
    const window = formatFullPickupWindow(
      "2026-08-10T12:00:00.000Z",
      "2026-08-10T15:00:00.000Z",
      "en"
    );

    expect(window).toContain("17:00");
    expect(window).toContain("20:00");
    expect(window).toContain(" - ");
  });
});

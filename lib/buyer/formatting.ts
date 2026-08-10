import type { Locale } from "@/i18n/types";

/**
 * Locale-aware timestamp helpers shared by the buyer v2 feed, offer detail,
 * and reservation views. The marketplace contract always carries full ISO
 * datetimes in Asia/Tashkent, these helpers turn that into either a short
 * clock label (for the legacy Offer view model, which the feed sorts as
 * hours and minutes) or a full localized date and time string for detail
 * screens, matching the Buyer rule that pickup windows use full localized
 * timestamps rather than a bare clock reading.
 */

const DEFAULT_TIME_ZONE = "Asia/Tashkent";

function toIntlLocale(locale: Locale): string {
  return locale === "ru" ? "ru-RU" : "en-US";
}

/**
 * A 24 hour HH:MM label in the given time zone. Used for fields that plug
 * into existing Offer-shaped list and sort logic which expects a short clock
 * string, this format is locale invariant by design so it matches the
 * existing seed and seller-published offer data already flowing through
 * lib/filters.ts.
 */
export function formatShortTime(
  isoDateTime: string,
  timeZone: string = DEFAULT_TIME_ZONE
): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    timeZone,
  }).format(new Date(isoDateTime));
}

/**
 * A full localized date and time string, for example "Aug 10, 2026, 17:00"
 * in English or a Russian equivalent. Used anywhere the buyer needs to see
 * the complete pickup or verification moment rather than a bare clock label.
 */
export function formatFullTimestamp(
  isoDateTime: string,
  locale: Locale,
  timeZone: string = DEFAULT_TIME_ZONE
): string {
  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    day: "numeric",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "short",
    timeZone,
    year: "numeric",
  }).format(new Date(isoDateTime));
}

/**
 * A full localized pickup window combining the start and end timestamps,
 * for example "Aug 10, 2026, 17:00 - 20:00".
 */
export function formatFullPickupWindow(
  pickupStart: string,
  pickupEnd: string,
  locale: Locale,
  timeZone: string = DEFAULT_TIME_ZONE
): string {
  const start = formatFullTimestamp(pickupStart, locale, timeZone);
  const end = formatShortTime(pickupEnd, timeZone);
  return `${start} - ${end}`;
}

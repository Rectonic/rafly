/**
 * Small shared formatting helpers for the Shop Seller beta screens. The
 * contracts fix the marketplace timezone at Asia/Tashkent, every timestamp
 * a seller approves here must render in that same zone, not the device or
 * server UTC offset, otherwise a manager approving a pickup window sees a
 * different wall clock time than the buyer who will actually show up.
 */

const DEFAULT_TIME_ZONE_V2 = "Asia/Tashkent";

function tashkentPartsMap(date: Date, timeZone: string): Record<string, string> {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) {
    map[part.type] = part.value;
  }
  return map;
}

/**
 * Renders an ISO instant in the store's own Asia/Tashkent wall clock
 * (UTC+05:00), the same zone MarketplaceOfferV2.timezone always carries and
 * the same one lib/buyer/formatting.ts renders for buyers on the other
 * surface. "2026-08-10T09:00:00.000Z" becomes "2026-08-10 14:00", not
 * "2026-08-10 09:00", a naive UTC string slice would put a manager's
 * approval screen five hours off the exact pickup window a buyer sees for
 * the same offer.
 */
export function formatIsoTimestampV2(
  iso: string,
  timeZone: string = DEFAULT_TIME_ZONE_V2
): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  const parts = tashkentPartsMap(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

/** Splits a multiline draft field into a trimmed, blank line free list. */
export function parseLinesV2(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * Whether an inventory batch's expiry date has already fully passed, using
 * the same coarse whole day UTC date comparison the backend itself applies
 * in approveAndPublishOfferV2 (product.expiryDate < today's UTC date). This
 * is a client side convenience filter only, meant to keep an obviously
 * expired batch out of the publish picker before a seller wastes a trip
 * through the form. The backend's own check at publish time stays the
 * final authority regardless of what this returns, nothing here skips that
 * check or assumes it will agree in every edge case.
 */
export function isExpiredV2(
  expiryDate: string | null,
  nowIso: string = new Date().toISOString()
): boolean {
  if (!expiryDate) return false;
  return expiryDate < nowIso.slice(0, 10);
}

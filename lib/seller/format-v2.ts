/**
 * Small shared formatting helpers for the Shop Seller beta screens. Kept
 * intentionally simple, no timezone library, the contracts already fix the
 * marketplace timezone at Asia/Tashkent and every timestamp here is for a
 * seller who is physically at the store, not a cross timezone buyer.
 */

/** "2026-08-10T09:00:00.000Z" becomes "2026-08-10 09:00". */
export function formatIsoTimestampV2(iso: string): string {
  const [datePart, timePart] = iso.split("T");
  if (!timePart) {
    return iso;
  }
  return `${datePart} ${timePart.slice(0, 5)}`;
}

/**
 * Small opaque id helper for buyer v2 client generated ids, installation
 * ids, client reservation ids, and cancellation idempotency keys. This
 * mirrors the existing repo convention in lib/reservations.ts
 * (buildReservationCode), a time component plus Math.random derived
 * segments, no crypto dependency required for ids that only need to be
 * practically unique per device and per action rather than cryptographically
 * unguessable.
 */
function randomSegment(): string {
  return Math.floor(Math.random() * 0xffffffff)
    .toString(16)
    .padStart(8, "0");
}

export function generateOpaqueId(prefix: string): string {
  return `${prefix}-${Date.now().toString(16)}-${randomSegment()}-${randomSegment()}`;
}

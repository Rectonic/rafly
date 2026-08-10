/**
 * Small opaque id helper for seller v2 client generated ids: count session
 * ids and per action idempotency keys. The buyer surface has an identical
 * helper at lib/buyer/id.ts, it is intentionally duplicated rather than
 * imported, the architecture boundary rule keeps the seller surface free
 * of lib/buyer imports so the two surfaces can be split into separate
 * deployables later without disentangling shared utility imports.
 */
function randomSegment(): string {
  return Math.floor(Math.random() * 0xffffffff)
    .toString(16)
    .padStart(8, "0");
}

export function generateOpaqueIdV2(prefix: string): string {
  return `${prefix}-${Date.now().toString(16)}-${randomSegment()}-${randomSegment()}`;
}

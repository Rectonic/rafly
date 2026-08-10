/**
 * Small opaque id helper for buyer v2 client generated ids, installation
 * ids, client reservation ids, and cancellation idempotency keys.
 *
 * The installation id these back is a bearer secret, anyone holding one can
 * read and cancel that installation's reservations, so the random segments
 * come from crypto.getRandomValues wherever a runtime offers it. React
 * Native, Hermes and modern JSC all do, and so does Node under Jest.
 *
 * Math.random is the fallback for a runtime with no global crypto at all. It
 * is not a cryptographically strong source and an id minted through that path
 * is only practically unique rather than unguessable. Nothing in the app can
 * tell the two apart afterwards, which is why the fallback is last resort
 * rather than the design.
 */
function randomSegment(): string {
  const source = globalThis.crypto;
  if (source && typeof source.getRandomValues === "function") {
    const buffer = new Uint32Array(1);
    source.getRandomValues(buffer);
    return buffer[0].toString(16).padStart(8, "0");
  }

  return Math.floor(Math.random() * 0xffffffff)
    .toString(16)
    .padStart(8, "0");
}

export function generateOpaqueId(prefix: string): string {
  return `${prefix}-${Date.now().toString(16)}-${randomSegment()}-${randomSegment()}`;
}

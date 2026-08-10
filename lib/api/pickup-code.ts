/**
 * Pickup code issuing and hashing.
 *
 * The raw code is generated on the device, never by the database. The reserve
 * RPC receives the plaintext, the lowercase hex sha256 of it, and a two
 * character hint, then recomputes the digest itself and rejects the call when
 * either the digest or the hint disagrees with the plaintext. Everything the
 * server stores afterwards is the digest and the hint, so the plaintext exists
 * exactly once, in the response of the call that created the reservation.
 *
 * sha256 is implemented here rather than pulled in as a dependency. React
 * Native ships no node crypto and expo-crypto has no synchronous digest, so a
 * small self contained implementation is the shortest honest path. It is
 * pinned against the published FIPS vectors in the test suite.
 */

/**
 * Six characters from a 32 symbol alphabet is about 30 bits of entropy, which
 * is far more than a single store needs to keep two live pickup codes apart.
 * I, O, 0 and 1 are left out so a code read aloud at a counter or copied off a
 * screen cannot be misheard or mistyped.
 */
export const PICKUP_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const PICKUP_CODE_LENGTH = 6;

/**
 * Random bytes for one code. getRandomValues is the right source and is
 * present on every runtime this app targets. The Math.random fallback exists
 * for older JavaScriptCore builds that predate the global crypto object. It is
 * weaker, and it is only ever reached when the platform offers nothing better.
 */
function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  const source = globalThis.crypto;

  if (source && typeof source.getRandomValues === "function") {
    source.getRandomValues(bytes);
    return bytes;
  }

  for (let index = 0; index < length; index += 1) {
    bytes[index] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

/**
 * A fresh pickup code. 256 divides evenly by the 32 symbol alphabet, so the
 * modulo below draws every symbol with the same probability and needs no
 * rejection sampling.
 */
export function generatePickupCode(): string {
  const bytes = randomBytes(PICKUP_CODE_LENGTH);
  let code = "";

  for (let index = 0; index < PICKUP_CODE_LENGTH; index += 1) {
    code += PICKUP_CODE_ALPHABET[bytes[index] % PICKUP_CODE_ALPHABET.length];
  }

  return code;
}

/**
 * The safe hint, which is the only part of a code any list read ever shows.
 * The reserve RPC checks this against the last two characters of the
 * plaintext, so the rule lives in one place on the client too.
 */
export function pickupCodeHint(code: string): string {
  return code.slice(-2);
}

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotateRight(value: number, amount: number): number {
  return (value >>> amount) | (value << (32 - amount));
}

/** UTF-8 bytes of a string, without depending on TextEncoder being present. */
function utf8Bytes(text: string): Uint8Array {
  const bytes: number[] = [];

  for (let index = 0; index < text.length; index += 1) {
    let codePoint = text.charCodeAt(index);

    if (codePoint >= 0xd800 && codePoint <= 0xdbff && index + 1 < text.length) {
      const low = text.charCodeAt(index + 1);
      if (low >= 0xdc00 && low <= 0xdfff) {
        codePoint = ((codePoint - 0xd800) << 10) + (low - 0xdc00) + 0x10000;
        index += 1;
      }
    }

    if (codePoint < 0x80) {
      bytes.push(codePoint);
    } else if (codePoint < 0x800) {
      bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
    } else if (codePoint < 0x10000) {
      bytes.push(
        0xe0 | (codePoint >> 12),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f)
      );
    } else {
      bytes.push(
        0xf0 | (codePoint >> 18),
        0x80 | ((codePoint >> 12) & 0x3f),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f)
      );
    }
  }

  return Uint8Array.from(bytes);
}

/** Lowercase hex sha256 of a string, matching encode(digest(x, 'sha256'), 'hex'). */
export function sha256Hex(text: string): string {
  const message = utf8Bytes(text);
  const bitLength = message.length * 8;
  const paddedLength = (((message.length + 8) >> 6) + 1) << 6;
  const padded = new Uint8Array(paddedLength);
  padded.set(message);
  padded[message.length] = 0x80;

  // The length field is 64 bits big endian. Inputs long enough to overflow the
  // low 32 bits are not reachable from this app, so the high word is written
  // from a float divide rather than from bigint arithmetic.
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false);
  view.setUint32(paddedLength - 4, bitLength >>> 0, false);

  const hash = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
    0x1f83d9ab, 0x5be0cd19,
  ]);
  const w = new Uint32Array(64);

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      w[index] = view.getUint32(offset + index * 4, false);
    }
    for (let index = 16; index < 64; index += 1) {
      const s0 =
        rotateRight(w[index - 15], 7) ^
        rotateRight(w[index - 15], 18) ^
        (w[index - 15] >>> 3);
      const s1 =
        rotateRight(w[index - 2], 17) ^
        rotateRight(w[index - 2], 19) ^
        (w[index - 2] >>> 10);
      w[index] = (w[index - 16] + s0 + w[index - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = hash;

    for (let index = 0; index < 64; index += 1) {
      const s1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + K[index] + w[index]) >>> 0;
      const s0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
    hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0;
    hash[7] = (hash[7] + h) >>> 0;
  }

  let hex = "";
  for (let index = 0; index < hash.length; index += 1) {
    hex += hash[index].toString(16).padStart(8, "0");
  }
  return hex;
}

/**
 * Pickup code and hash tests.
 *
 * The reserve RPC recomputes the hash server side and checks the hint against
 * the last two characters of the plaintext, so a drift in either helper turns
 * every reservation into validation_failed. These tests pin the alphabet, the
 * length, the hint rule and the digest against published vectors.
 */

import {
  PICKUP_CODE_ALPHABET,
  generatePickupCode,
  pickupCodeHint,
  sha256Hex,
} from "@/lib/api/pickup-code";

describe("generatePickupCode", () => {
  it("issues six characters drawn only from the unambiguous alphabet", () => {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const code = generatePickupCode();

      expect(code).toHaveLength(6);
      expect(code).toMatch(/^[A-Z0-9]{6}$/);
      for (const character of code) {
        expect(PICKUP_CODE_ALPHABET).toContain(character);
      }
    }
  });

  it("keeps the ambiguous characters out of the alphabet", () => {
    expect(PICKUP_CODE_ALPHABET).toBe("ABCDEFGHJKLMNPQRSTUVWXYZ23456789");
    expect(PICKUP_CODE_ALPHABET).toHaveLength(32);
    for (const ambiguous of ["I", "O", "0", "1"]) {
      expect(PICKUP_CODE_ALPHABET).not.toContain(ambiguous);
    }
  });

  it("does not repeat itself across a small batch", () => {
    const codes = new Set<string>();
    for (let attempt = 0; attempt < 64; attempt += 1) {
      codes.add(generatePickupCode());
    }

    expect(codes.size).toBeGreaterThan(50);
  });

  it("falls back to Math.random on a runtime with no crypto", () => {
    const realCrypto = globalThis.crypto;
    Object.defineProperty(globalThis, "crypto", {
      value: undefined,
      configurable: true,
    });

    try {
      const code = generatePickupCode();

      expect(code).toHaveLength(6);
      expect(code).toMatch(/^[A-Z0-9]{6}$/);
    } finally {
      Object.defineProperty(globalThis, "crypto", {
        value: realCrypto,
        configurable: true,
      });
    }
  });
});

describe("pickupCodeHint", () => {
  it("is the last two characters of the plaintext code", () => {
    expect(pickupCodeHint("LB2345")).toBe("45");

    const code = generatePickupCode();
    expect(pickupCodeHint(code)).toBe(code.slice(-2));
    expect(pickupCodeHint(code)).toHaveLength(2);
  });
});

describe("sha256Hex", () => {
  it("matches the published vectors", () => {
    expect(sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
    expect(sha256Hex("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
    expect(
      sha256Hex(
        "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"
      )
    ).toBe("248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1");
  });

  it("is stable for a pickup code shaped input", () => {
    expect(sha256Hex("LB2345")).toBe(
      "c67a5a992f3a9a366a467df845e099bd0dfe01f5ea701ac3a3ae17d8f198f563"
    );
  });

  it("digests a long input that crosses several blocks", () => {
    expect(sha256Hex("a".repeat(1000000).slice(0, 1000))).toHaveLength(64);
    expect(sha256Hex("a".repeat(119))).toBe(
      "31eba51c313a5c08226adf18d4a359cfdfd8d2e816b13f4af952f7ea6584dcfb"
    );
  });

  it("hashes non ascii text by its utf8 bytes", () => {
    expect(sha256Hex("é")).toBe(
      "4a99557e4033c3539de2eb65472017cad5f9557f7a0625a09f1c3f6e2ba69c4c"
    );
  });

  it("returns lowercase hex of a fixed width", () => {
    const digest = sha256Hex(generatePickupCode());

    expect(digest).toHaveLength(64);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });
});

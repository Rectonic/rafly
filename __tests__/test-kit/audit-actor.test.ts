/**
 * Pins the hand written sha256 in lib/test-kit/audit-actor.ts against
 * node:crypto.
 *
 * That implementation exists because the module is reachable from a demo
 * build of the app, where node:crypto is absent and WebCrypto only offers an
 * async digest. A hand written hash is only worth trusting if something keeps
 * checking it, and the audit actor references it produces have to match what
 * pgcrypto computes inside reserve_offer_v2 and cancel_reservation_v2 byte for
 * byte, so a silent divergence here would quietly stop the fake and the real
 * backend from agreeing.
 */

import { createHash } from "node:crypto";

import { installationAuditActor, sha256Hex } from "@/lib/test-kit/audit-actor";

function reference(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

describe("sha256Hex", () => {
  const cases: [string, string][] = [
    ["empty string", ""],
    ["short ascii", "abc"],
    ["an installation id", "installation-a"],
    ["a uuid shaped id", "installation-a-3f1c0a5e-2b7d-4c19-9d0f-7a5b1c2d3e4f"],
    ["exactly 55 bytes", "a".repeat(55)],
    ["exactly 56 bytes, the padding boundary", "a".repeat(56)],
    ["exactly 64 bytes, one whole block", "a".repeat(64)],
    ["two blocks and a bit", "a".repeat(130)],
    ["multi byte utf8", "магазин Чорсу, пекарня"],
    ["astral plane characters, exercising the surrogate pair path", "bag \u{1F35E} of \u{1F950} bread"],
  ];

  for (const [name, input] of cases) {
    it(`matches node:crypto for ${name}`, () => {
      expect(sha256Hex(input)).toBe(reference(input));
    });
  }

  it("matches node:crypto across a spread of lengths", () => {
    for (let length = 0; length < 200; length += 7) {
      const input = Array.from({ length }, (_, index) =>
        String.fromCharCode(32 + (index % 90))
      ).join("");
      expect(sha256Hex(input)).toBe(reference(input));
    }
  });
});

describe("installationAuditActor", () => {
  it("emits the prefix plus the first twelve hex characters of the digest", () => {
    const actor = installationAuditActor("installation-a");

    expect(actor).toBe(`installation:${reference("installation-a").slice(0, 12)}`);
    expect(actor).toMatch(/^installation:[0-9a-f]{12}$/);
  });

  it("never contains the raw installation id", () => {
    const installationId = "installation-a-secret-bearer-value";

    expect(installationAuditActor(installationId)).not.toContain(installationId);
  });

  it("is stable for one installation and different across two", () => {
    expect(installationAuditActor("installation-a")).toBe(
      installationAuditActor("installation-a")
    );
    expect(installationAuditActor("installation-a")).not.toBe(
      installationAuditActor("installation-b")
    );
  });
});
